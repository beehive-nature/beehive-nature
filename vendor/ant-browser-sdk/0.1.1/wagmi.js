import { getBindings } from "./internal/runtime.js";
import { getConnectorClient, getPublicClient } from "@wagmi/core";
import { maxUint256, decodeFunctionData, } from "viem";
import { sendTransaction, readContract, waitForTransactionReceipt, writeContract } from "viem/actions";
import { abortable, throwIfAborted } from "./internal/abort.js";
import { assertPaymentChainId } from "./internal/payment-network.js";
import { createPaymentSubmission, confirmedPayment } from "./payment.js";
const TOKEN_ABI = [
    {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
    },
    {
        type: "function",
        name: "approve",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
    },
];
const VAULT_ABI = [
    {
        type: "function",
        name: "payForQuotes",
        stateMutability: "nonpayable",
        inputs: [
            {
                name: "payments",
                type: "tuple[]",
                components: [
                    { name: "rewardsAddress", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "quoteHash", type: "bytes32" },
                ],
            },
        ],
        outputs: [],
    },
];
/** Create the optional Wagmi v3/Viem payment adapter used by paid uploads. */
export function createWagmiPaymentProvider(options) {
    const approval = options.approval ?? "unlimited";
    const submit = async (network, quotes, context, merkle) => {
        throwIfAborted(context.signal);
        if (quotes.length === 0 && !merkle)
            return { totalAmount: "0" };
        assertPaymentChainId(network.chainId);
        const configuredClient = getPublicClient(options.config, { chainId: network.chainId });
        if (!configuredClient)
            throw new Error(`Configure a Wagmi public client for payment chain ${network.chainId}`);
        const publicClient = configuredClient;
        const [chainId, connectorClient] = await abortable(Promise.all([
            publicClient.getChainId(),
            getConnectorClient(options.config),
        ]), context.signal);
        if (chainId !== network.chainId) {
            throw new Error(`Payment RPC is on chain ${chainId}; expected payment chain ${network.chainId}`);
        }
        const walletClient = connectorClient;
        if (walletClient.chain.id !== network.chainId) {
            throw new Error(`Connected wallet is on chain ${walletClient.chain.id}; switch to payment chain ${network.chainId}`);
        }
        const walletAddress = walletClient.account.address;
        const tokenAddress = network.paymentTokenAddress;
        const vaultAddress = network.paymentVaultAddress;
        const totalAmount = merkle ? BigInt(merkle.maximumAmount) : quotes.reduce((total, quote) => total + BigInt(quote.amount), 0n);
        throwIfAborted(context.signal);
        const allowance = await abortable(readContract(publicClient, {
            address: tokenAddress,
            abi: TOKEN_ABI,
            functionName: "allowance",
            args: [walletAddress, vaultAddress],
        }), context.signal);
        if (allowance < totalAmount) {
            context.report(`Approving the payment vault from wallet ${walletAddress}`, { phase: "approval" });
            throwIfAborted(context.signal);
            const amount = approval === "exact" ? totalAmount : maxUint256;
            const transactionHash = await writeContract(walletClient, {
                address: tokenAddress,
                abi: TOKEN_ABI,
                functionName: "approve",
                args: [vaultAddress, amount],
            });
            await requireSuccessfulReceipt(publicClient, transactionHash, "Payment-token approval transaction reverted");
        }
        const payments = quotePayments(quotes);
        throwIfAborted(context.signal);
        context.report(merkle ? "Submitting batch storage payment" : `Submitting one payment for ${payments.length} storage quote(s)`, { phase: "payment" });
        throwIfAborted(context.signal);
        const transactionHash = merkle ? await sendTransaction(walletClient, {
            to: vaultAddress, data: merkle.calldata,
        }) : await writeContract(walletClient, {
            address: vaultAddress,
            abi: VAULT_ABI,
            functionName: "payForQuotes",
            args: [payments],
        });
        const submission = createPaymentSubmission({ transactionHash, walletAddress, totalAmount: totalAmount.toString() }, async () => {
            try {
                const confirmedHash = await requireSuccessfulReceipt(publicClient, transactionHash, "Storage payment transaction reverted");
                if (merkle) {
                    const mined = await publicClient.getTransactionReceipt({ hash: confirmedHash });
                    const settlement = context.decodeReceipt(mined.logs);
                    return { status: "confirmed", receipt: { transactionHash: confirmedHash, walletAddress, ...settlement } };
                }
                return { status: "confirmed", receipt: { transactionHash: confirmedHash, walletAddress, totalAmount: totalAmount.toString() } };
            }
            catch (error) {
                if (error instanceof FailedTransaction)
                    return { status: "failed", reason: error.message, cause: error };
                throw error;
            }
        });
        try {
            context.submitted(submission);
        }
        catch { /* Continue observing the transaction. */ }
        const receipt = await confirmedPayment(submission);
        const confirmedTransactionHash = receipt.transactionHash;
        try {
            if (!context.signal?.aborted)
                context.report(`Payment confirmed in ${confirmedTransactionHash}`);
        }
        catch { /* The receipt is already confirmed. */ }
        return receipt;
    };
    const recover = async (network, quotes, attempt, context, merkle) => {
        const client = getPublicClient(options.config, { chainId: network.chainId });
        if (!client || await client.getChainId() !== network.chainId)
            throw new Error("Recovery RPC is on the wrong payment chain");
        const journal = attempt;
        const hashes = [...new Set([...(journal?.submissions ?? []).flatMap(entry => [entry.transactionHash, ...Object.values(entry.transactionHashes ?? {})]), journal?.receipt?.transactionHash,
                ...Object.values(journal?.receipt?.transactionHashes ?? {})].filter((hash) => typeof hash === "string" && /^0x[0-9a-f]{64}$/iu.test(hash)))];
        const transactions = {};
        for (const hash of hashes) {
            throwIfAborted(context.signal);
            const transaction = await client.getTransaction({ hash });
            const receipt = await client.getTransactionReceipt({ hash });
            if (receipt.status !== "success" || transaction.to?.toLowerCase() !== network.paymentVaultAddress.toLowerCase())
                continue;
            if (merkle) {
                if (transaction.input.toLowerCase() !== merkle.calldata.toLowerCase())
                    continue;
                const decode = getBindings().decodeMerklePaymentReceipt;
                if (!decode)
                    throw new Error("WASM receipt decoder unavailable");
                const result = decode(merkle, network.paymentVaultAddress, receipt.logs);
                return { transactionHash: hash, ...result };
            }
            const decoded = decodeFunctionData({ abi: VAULT_ABI, data: transaction.input });
            for (const quote of quotes) {
                if (decoded.args[0].some(paid => paid.quoteHash.toLowerCase().replace(/^0x/u, "") === quote.quoteHash.toLowerCase().replace(/^0x/u, "") &&
                    paid.rewardsAddress.toLowerCase() === quote.rewardsAddress.toLowerCase() && paid.amount === BigInt(quote.amount)))
                    transactions[quote.quoteHash] = hash;
            }
        }
        if (merkle || quotes.some(quote => !transactions[quote.quoteHash]) || !quotes.length)
            throw new Error("Payment outcome unknown; no new transaction was sent");
        return { transactionHash: Object.values(transactions)[0], transactionHashes: transactions,
            totalAmount: quotes.reduce((total, quote) => total + BigInt(quote.amount), 0n).toString() };
    };
    return {
        pay: (network, quotes, context) => submit(network, quotes, context),
        recover: (network, quotes, attempt, context) => recover(network, quotes, attempt, context),
        recoverMerkle: async (network, request, attempt, context) => await recover(network, [], attempt, context, request),
        payMerkle: async (network, request, context) => await submit(network, [], context, request),
    };
}
class FailedTransaction extends Error {
}
async function requireSuccessfulReceipt(publicClient, hash, errorMessage) {
    let replaced = false;
    const receipt = await waitForTransactionReceipt(publicClient, {
        hash,
        onReplaced: ({ reason }) => {
            if (reason !== "repriced")
                replaced = true;
        },
    });
    if (replaced)
        throw new FailedTransaction("Wallet transaction was cancelled or replaced with a different transaction");
    if (receipt.status !== "success")
        throw new FailedTransaction(errorMessage);
    return receipt.transactionHash;
}
function quotePayments(quotes) {
    return quotes.map((quote) => ({
        rewardsAddress: quote.rewardsAddress,
        amount: BigInt(quote.amount),
        quoteHash: `0x${quote.quoteHash.replace(/^0x/iu, "")}`,
    }));
}
//# sourceMappingURL=wagmi.js.map