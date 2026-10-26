const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../src/lib/job-flow.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const flow = { exports: {} };
new Function("exports", "module", compiled)(flow.exports, flow);
const { needsAction, jobGroup, visibleJobs, nextStep } = flow.exports;
const job = (status, extra = {}) => ({ id: status, status, requestedAt: "2026-10-16", ...extra });

test("both sides are asked to confirm the chat agreement before work starts", () => {
  for (const status of ["accepted", "quoted"]) {
    assert.equal(needsAction(job(status), "worker"), true);
    assert.equal(needsAction(job(status), "customer"), true);
    assert.equal(needsAction(job(status, { workerAgreedAt: "now" }), "worker"), false);
    assert.equal(needsAction(job(status, { consumerAgreedAt: "now" }), "customer"), false);
  }
  assert.equal(needsAction(job("requested"), "worker"), true);
  assert.equal(needsAction(job("in_progress"), "worker"), false);
});

test("worker completed jobs go to history without a wallet settlement", () => {
  assert.equal(jobGroup(job("completed"), "worker"), "history");
  assert.equal(visibleJobs([job("completed")], "worker", "all").length, 0);
  assert.equal(visibleJobs([job("completed")], "worker", "history").length, 1);
  assert.equal(needsAction(job("completed"), "worker"), false);
});

test("worker stats and guides use agreement and completion steps", () => {
  assert.match(nextStep(job("accepted"), "worker").title, /Agree in chat/);
  assert.match(nextStep(job("accepted"), "customer").title, /Agree in chat/);
  assert.match(nextStep(job("in_progress"), "worker").detail, /confirmed the plan in chat/i);
  assert.match(nextStep(job("completed"), "worker").title, /All done/);
});

test("actionable requests sort first without mutating the live snapshot", () => {
  const rows = [job("requested", { requestedAt: "2026-10-16" }), job("accepted", { requestedAt: "2026-10-14" }), job("reviewed")];
  assert.deepEqual(visibleJobs(rows, "worker", "all").map((row) => row.id), ["requested", "accepted"]);
  assert.equal(rows[0].id, "requested");
  assert.deepEqual(visibleJobs(rows, "worker", "action").map((row) => row.id), ["requested", "accepted"]);
});
