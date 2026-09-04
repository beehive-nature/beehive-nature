// member-pay.mjs — THE MEMBER'S WALLET (ethers), outside the estate binary.
// Reads payment-payload.json (from ant-extsig prepare), pays the merkle tree
// on the devnet's EVM (Anvil RPC from the manifest) with ITS OWN key, writes
// winner-hashes.json + payer-address.txt. The estate never sees the key.
// Standing in for WAGMI/MetaMask: same signing, same custody boundary.
import { Wallet, JsonRpcProvider, Contract } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";

const STATE = "/tmp/ant-extsig-state";
const manifest = JSON.parse(readFileSync(`${STATE}/manifest.json`, "utf8"));
const payload = JSON.parse(readFileSync(`${STATE}/payment-payload.json`, "utf8"));
const rpc = manifest.evm.rpc_url;
const vault = manifest.evm.payment_vault_address;
const token = manifest.evm.payment_token_address;

// the MEMBER key: on the devnet, the funded key stands in for the member's
// own wallet (on mainnet this is the member's WAGMI wallet; the estate
// binary still never holds it)
const memberKey = readFileSync(`${STATE}/funded-key.txt`, "utf8").trim();
const provider = new JsonRpcProvider(rpc);
const wallet = new Wallet(memberKey.startsWith("0x") ? memberKey : "0x" + memberKey, provider);
console.log("MEMBER payer address:", wallet.address);

const ERC20_ABI = ["function approve(address,uint256)", "function allowance(address,address) view returns (uint256)"];
const VAULT_ABI = ["function payForMerkleTree(uint8 depth, (address rewards, uint96 amount)[] commitments, uint64 timestamp) returns (bytes32)"];

const tokenC = new Contract(token, ERC20_ABI, wallet);
const vaultC = new Contract(vault, VAULT_ABI, wallet);

const winners = [];
for (const [i, b] of payload.batches.entries()) {
  const commitments = b.pool_commitments.map((c) => ({ rewards: c.rewards, amount: BigInt(c.amount_atto) }));
  const total = commitments.reduce((a, c) => a + c.amount, 0n);
  // approve the vault for this batch total (idempotent raise)
  const apr = await tokenC.approve(vault, total);
  await apr.wait();
  console.log(`batch ${i}: approved ${total} atto`);
  const tx = await vaultC.payForMerkleTree(b.depth, commitments, BigInt(b.timestamp));
  const rc = await tx.wait();
  // the winner hash: the MerklePayment event's tree/winner id
  const evt = rc.logs.map((l) => { try { return vaultC.interface.parseLog(l); } catch { return null; } })
    .find((l) => l && l.name && /merkle/i.test(l.name));
  const winner = evt ? evt.args[evt.args.length - 1] : rc.transactionHash;
  console.log(`batch ${i}: PAID, winner ${winner}`);
  winners.push(String(winner));
}
writeFileSync(`${STATE}/winner-hashes.json`, JSON.stringify(winners, null, 2));
writeFileSync(`${STATE}/payer-address.txt`, wallet.address + "\n");
console.log("member payment complete — winner-hashes.json + payer-address.txt written");
