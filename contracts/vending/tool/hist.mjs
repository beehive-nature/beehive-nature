// page v1 history for an account and print a compact trace
import { writeFileSync } from "node:fs";
const acct = process.argv[2] || "bnrapolltest";
const out = [];
let pos = -1;
for (let page = 0; page < 6; page++) {
  const r = await fetch("https://jungle4.greymass.com/v1/history/get_actions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ account_name: acct, pos, offset: -25 }),
  }).then(r => r.json()).catch(() => ({ actions: [] }));
  const acts = r.actions || [];
  if (!acts.length) break;
  for (const a of acts) {
    const t = a.action_trace?.act || {};
    out.push([a.account_action_seq, t.account + "::" + t.name,
      t.data?.from ? "from=" + t.data.from : "", t.data?.quantity || "",
      "auth=" + (t.authorization || []).map(x => x.actor).join(",")].join(" "));
  }
  pos = acts[acts.length - 1].account_action_seq - 1;
  if (pos < 0) break;
}
out.sort((x, y) => parseInt(x) - parseInt(y));
console.log(out.join("\n"));
writeFileSync("hist-" + acct + ".txt", out.join("\n"));
