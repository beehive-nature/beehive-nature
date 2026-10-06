import { getBindings } from "./internal/runtime.js";
import { Contract, Interface, JsonRpcProvider, MaxUint256, NonceManager, Wallet, isError, } from "ethers";
import { abortable, throwIfAborted } from "./internal/abort.js";
import { assertPaymentChainId } from "./internal/payment-network.js";
import { createPaymentSubmission, confirmedPayment } from "./payment.js";
import { errorMessage } from "./errors.js";
const TOKEN_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
];
const VAULT_ABI = [
    "function payForQuotes((address rewardsAddress,uint256 amount,bytes32 quoteHash)[] payments)",
];
/** Create the optional Ethers v6 payment adapter used by paid uploads. */
export function createEthersPaymentProvider(options) {
    if (Boolean(options.privateKey) === Boolean(options.getSigner)) {
        throw new TypeError("Provide exactly one of privateKey or getSigner");
    }
    if (options.privateKey) {
        if (!options.rpcUrl)
            throw new TypeError("Provide rpcUrl with privateKey");
        const rpc = new URL(options.rpcUrl);
        if (rpc.protocol !== "http:" && rpc.protocol !== "https:") {
            throw new TypeError("Payment rpcUrl must use HTTP or HTTPS");
        }
    }
    const approval = options.approval ?? "unlimited";
    const privateKeySigners = new Map();
    let privateKeyPayments = Promise.resolve();
    const privateKeySigner = (network) => {
        let signer = privateKeySigners.get(network.chainId);
        if (!signer) {
            signer = new NonceManager(new Wallet(options.privateKey, new JsonRpcProvider(options.rpcUrl)));
            privateKeySigners.set(network.chainId, signer);
        }
        return signer;
    };
    const serializePrivateKeyPayment = (task, signal) => {
        const payment = privateKeyPayments.then(async () => {
            throwIfAborted(signal);
            return task();
        });
        privateKeyPayments = payment.then(() => undefined, () => undefined);
        // Once submission starts, retain its eventual receipt even if the caller
        // stops waiting. The SDK observes this promise for upload recovery.
        return payment;
    };
    const submit = async (network, quotes, context, merkle) => {
        throwIfAborted(context.signal);
        if (quotes.length === 0 && !merkle)
            return { totalAmount: "0" };
        assertPaymentChainId(network.chainId);
        if (options.getSigner) {
            throwIfAborted(context.signal);
            const signer = await abortable(options.getSigner(network), context.signal);
            return submitPayment(signer, network, quotes, context, approval, merkle);
        }
        return serializePrivateKeyPayment(async () => {
            const signer = privateKeySigner(network);
            try {
                return await submitPayment(signer, network, quotes, context, approval, merkle);
            }
            finally {
                // NonceManager increments before estimation/broadcast can fail.
                // The next queued attempt must reload the chain's pending nonce.
                signer.reset();
            }
        }, context.signal);
    };
    const recover = async (network, quotes, attempt, context, merkle) => {
        throwIfAborted(context.signal);
        const signer = options.getSigner ? await options.getSigner(network) : privateKeySigner(network);
        const provider = signer.provider;
        if (!provider || (await provider.getNetwork()).chainId !== BigInt(network.chainId))
            throw new Error("Recovery provider is on the wrong payment chain");
        const journal = attempt;
        const hashes = [...new Set([...(journal?.submissions ?? []).flatMap(entry => [entry.transactionHash, ...Object.values(entry.transactionHashes ?? {})]), journal?.receipt?.transactionHash,
                ...Object.values(journal?.receipt?.transactionHashes ?? {})].filter((hash) => typeof hash === "string" && /^0x[0-9a-f]{64}$/iu.test(hash)))];
        if (!hashes.length)
            throw new Error("Payment outcome unknown: journal contains no valid transaction hash");
        const transactions = {};
        const abi = new Interface(VAULT_ABI);
        for (const hash of hashes) {
            throwIfAborted(context.signal);
            const transaction = await provider.getTransaction(hash);
            const receipt = await provider.getTransactionReceipt(hash);
            if (!transaction || !receipt || receipt.status !== 1)
                continue;
            if (transaction.to?.toLowerCase() !== network.paymentVaultAddress.toLowerCase() || transaction.chainId !== BigInt(network.chainId))
                continue;
            if (merkle) {
                if (transaction.data.toLowerCase() !== merkle.calldata.toLowerCase())
                    continue;
                const decode = getBindings().decodeMerklePaymentReceipt;
                if (!decode)
                    throw new Error("WASM receipt decoder unavailable");
                const result = decode(merkle, network.paymentVaultAddress, receipt.logs);
                return { transactionHash: hash, ...result };
            }
            const decoded = abi.parseTransaction({ data: transaction.data });
            if (decoded?.name !== "payForQuotes")
                continue;
            const payments = decoded.args[0];
            for (const quote of quotes) {
                if (payments.some(paid => paid.quoteHash.toLowerCase().replace(/^0x/u, "") === quote.quoteHash.toLowerCase().replace(/^0x/u, "") &&
                    paid.rewardsAddress.toLowerCase() === quote.rewardsAddress.toLowerCase() && paid.amount === BigInt(quote.amount))) {
                    transactions[quote.quoteHash] = hash;
                }
            }
        }
        if (merkle || quotes.some(quote => !transactions[quote.quoteHash]))
            throw new Error("Payment is unconfirmed or does not cover the prepared intent; no new transaction was sent");
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
async function submitPayment(signer, network, quotes, context, approval, merkle) {
    throwIfAborted(context.signal);
    if (!signer.provider)
        throw new Error("Payment signer must be connected to a provider");
    const signerNetwork = await abortable(signer.provider.getNetwork(), context.signal);
    if (signerNetwork.chainId !== BigInt(network.chainId)) {
        throw new Error(`Payment signer is on chain ${signerNetwork.chainId}; switch to payment chain ${network.chainId}`);
    }
    const walletAddress = await abortable(signer.getAddress(), context.signal);
    const totalAmount = merkle ? BigInt(merkle.maximumAmount) : quotes.reduce((total, quote) => total + BigInt(quote.amount), 0n);
    const token = new Contract(network.paymentTokenAddress, TOKEN_ABI, signer);
    const vault = new Contract(network.paymentVaultAddress, VAULT_ABI, signer);
    const allowance = (await abortable(token.getFunction("allowance")(walletAddress, network.paymentVaultAddress), context.signal));
    if (allowance < totalAmount) {
        throwIfAborted(context.signal);
        context.report(`Approving the payment vault from wallet ${walletAddress}`, { phase: "approval" });
        throwIfAborted(context.signal);
        const amount = approval === "exact" ? totalAmount : MaxUint256;
        // Once a transaction submission starts it cannot be cancelled. Keep this
        // task queued until its receipt settles so a later private-key payment
        // cannot race ahead with another signer or provider instance.
        const transaction = await token.getFunction("approve")(network.paymentVaultAddress, amount);
        await confirmedHash(transaction, "Payment-token approval transaction reverted");
    }
    throwIfAborted(context.signal);
    const payments = quotePayments(quotes);
    context.report(merkle ? "Submitting batch storage payment" : `Submitting one payment for ${payments.length} storage quote(s)`, { phase: "payment" });
    throwIfAborted(context.signal);
    const transaction = merkle
        ? await signer.sendTransaction({ to: network.paymentVaultAddress, data: merkle.calldata })
        : await vault.getFunction("payForQuotes")(payments);
    const submission = createPaymentSubmission({ transactionHash: transaction.hash, walletAddress, totalAmount: totalAmount.toString() }, async () => {
        try {
            const transactionHash = await confirmedHash(transaction, "Storage payment transaction reverted");
            if (merkle) {
                const mined = await signer.provider.getTransactionReceipt(transactionHash);
                if (!mined || mined.status !== 1)
                    throw new Error("Merkle transaction receipt is not available");
                const settlement = context.decodeReceipt(mined.logs);
                return { status: "confirmed", receipt: { transactionHash, walletAddress, ...settlement } };
            }
            return { status: "confirmed", receipt: { transactionHash, walletAddress, totalAmount: totalAmount.toString() } };
        }
        catch (error) {
            if (error instanceof RevertedTransaction || isError(error, "TRANSACTION_REPLACED") ||
                (isError(error, "CALL_EXCEPTION") && error.receipt?.status === 0)) {
                return { status: "failed", reason: errorMessage(error), cause: error };
            }
            throw error;
        }
    });
    // A UI callback must not interrupt observation after funds have been broadcast.
    try {
        context.submitted(submission);
    }
    catch { /* Continue observing the transaction. */ }
    const receipt = await confirmedPayment(submission);
    const transactionHash = receipt.transactionHash;
    try {
        if (!context.signal?.aborted)
            context.report(`Payment confirmed in ${transactionHash}`);
    }
    catch { /* The receipt is already confirmed. */ }
    return receipt;
}
class RevertedTransaction extends Error {
}
async function confirmedHash(transaction, failure) {
    try {
        const receipt = await transaction.wait();
        if (!receipt)
            throw new Error("Transaction receipt is not yet available");
        if (receipt.status !== 1)
            throw new RevertedTransaction(failure);
        return receipt.hash;
    }
    catch (error) {
        if (isError(error, "TRANSACTION_REPLACED") &&
            !error.cancelled && error.reason === "repriced" && error.receipt.status === 1) {
            return error.receipt.hash;
        }
        throw error;
    }
}
function quotePayments(quotes) {
    return quotes.map((quote) => ({
        rewardsAddress: quote.rewardsAddress,
        amount: quote.amount,
        quoteHash: `0x${quote.quoteHash.replace(/^0x/iu, "")}`,
    }));
}
//# sourceMappingURL=ethers.js.map