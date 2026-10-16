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

test("customer quote notifications clear on approval; reviews open only after settlement", () => {
  for (const status of ["requested", "accepted", "in_progress", "cancelled", "disputed", "reviewed"]) {
    assert.equal(needsAction(job(status), "customer"), false, status);
  }
  assert.equal(needsAction(job("quoted"), "customer"), true);
  assert.equal(needsAction(job("completed"), "customer"), false);
  assert.equal(needsAction(job("completed", { settledAt: "2026-10-16" }), "customer"), true);
});
test("worker actions follow acceptance, quoting and settlement without counting settled jobs", () => {
  for (const status of ["requested", "accepted", "completed"]) assert.equal(needsAction(job(status), "worker"), true);
  for (const status of ["quoted", "in_progress", "cancelled", "disputed", "reviewed"]) assert.equal(needsAction(job(status), "worker"), false);
  assert.equal(needsAction(job("completed", { settledAt: "2026-10-16" }), "worker"), false);
});
test("filters keep waiting jobs, disputes, active work and history distinct", () => {
  assert.equal(jobGroup(job("accepted"), "customer"), "waiting");
  assert.equal(jobGroup(job("quoted"), "worker"), "waiting");
  assert.equal(jobGroup(job("in_progress"), "worker"), "active");
  assert.equal(jobGroup(job("disputed"), "customer"), "waiting");
  assert.equal(jobGroup(job("completed", { settledAt: "2026-10-16" }), "worker"), "history");
  assert.equal(jobGroup(job("reviewed"), "customer"), "history");
});
test("actionable requests sort first without mutating the live snapshot", () => {
  const rows = [job("requested", { requestedAt: "2026-10-16" }), job("quoted", { requestedAt: "2026-10-14" }), job("reviewed")];
  assert.deepEqual(visibleJobs(rows, "customer", "all").map((j) => j.id), ["quoted", "requested", "reviewed"]);
  assert.equal(rows[0].id, "requested");
  assert.deepEqual(visibleJobs(rows, "customer", "action").map((j) => j.id), ["quoted"]);
});
test("guidance changes with role and settlement, so completed does not mean settled", () => {
  assert.match(nextStep(job("accepted"), "worker").title, /Send your quote/);
  assert.match(nextStep(job("accepted"), "customer").title, /Waiting/);
  assert.match(nextStep(job("completed"), "worker").title, /Settle/);
  assert.match(nextStep(job("completed", { settledAt: "2026-10-16" }), "customer").title, /Leave a review/);
});
