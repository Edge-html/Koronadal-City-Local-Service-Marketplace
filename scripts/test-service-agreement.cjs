const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("server requires both job parties to confirm before starting", () => {
  const source = read("src/app/api/marketplace/route.ts");
  const agreementBranch = source.split('if (operation === "confirmJobAgreement")')[1]?.split('if (operation === "approveQuote")')[0] ?? "";
  assert.match(agreementBranch, /\[job\.workerUid, job\.consumerId\]\.includes\(user\.uid\)/);
  assert.match(agreementBranch, /otherConfirmed/);
  assert.match(agreementBranch, /patch\.status = "in_progress"/);
});

test("wallet top-ups and quote approvals are retired on the server and in Firestore", () => {
  const api = read("src/app/api/marketplace/route.ts");
  const rules = read("firestore.rules");
  assert.match(api, /approveQuote.*submitJobPayment.*approveJobPayment.*settleJob.*approveTopUp/);
  assert.match(api, /Wallet, top-ups, and quote approval have been retired/);
  assert.match(rules, /match \/topupRequests\/\{requestId\}[\s\S]*?allow create, update, delete: if false/);
});

test("workers can manage services and opt into Pro without payment setup", () => {
  const data = read("src/lib/data.ts");
  const api = read("src/app/api/marketplace/route.ts");
  assert.match(data, /operation: "setWorkerServices"/);
  assert.match(api, /operation === "addService"/);
  assert.match(data, /operation: "setWorkerPro", workerId, isPro: enabled/);
  assert.match(api, /isPro: input\.isPro/);
});
