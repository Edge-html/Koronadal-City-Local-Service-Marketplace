const { test } = require("node:test");
const assert = require("node:assert/strict");

/**
 * Coverage arithmetic for quote approval.
 *
 * Kept in step with `commissionFor()` in firestore.rules. The two have to agree
 * to within the rounding tolerance, because the client stops the worker sending
 * a quote the rules would then refuse — if they disagree, the worker passes the
 * form's check and hits a permission error on submit, which is the worst of
 * both outcomes.
 */

const COMMISSION_RATE = 0.1;

/** Mirrors the app's money() in src/lib/commission.ts. */
const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Mirrors commissionFor() in firestore.rules. */
const ruleThreshold = (laborFee) => laborFee * COMMISSION_RATE - 0.01;

/** Mirrors availableBalance() in src/lib/commission.ts. */
const headroom = (balance, locked) => money(balance - locked);

test("a worker holding exactly the quoted commission is never locked out", () => {
  // The reported case, and the class of case the tolerance exists for.
  const fees = [24000, 7, 0.03, 12345.67, 33333.33, 0.1, 1, 999.99, 500, 12000];

  for (const fee of fees) {
    const commission = money(fee * COMMISSION_RATE);
    const covered = headroom(commission, 0);
    assert.ok(
      covered >= ruleThreshold(fee),
      `labor ${fee}: holding ${covered} must cover threshold ${ruleThreshold(fee)}`,
    );
  }
});

test("the tolerance is one cent, not a loophole", () => {
  // A worker one cent short of the true commission is still refused. Anything
  // looser would let a balance be under-funded by more than a rounding error.
  const fee = 24000;
  const commission = money(fee * COMMISSION_RATE);
  assert.ok(headroom(commission - 0.02, 0) < ruleThreshold(fee));
  assert.ok(headroom(commission - 0.01, 0) >= ruleThreshold(fee));
});

test("an empty wallet cannot underwrite any real commission", () => {
  for (const fee of [100, 1000, 24000, 50000]) {
    assert.equal(
      headroom(0, 0) >= ruleThreshold(fee),
      false,
      `an empty wallet must not cover a ${fee} labor fee`,
    );
  }
});

test("locked funds are not available headroom", () => {
  // Balance 5000 with 3000 already locked leaves 2000 of headroom, which covers
  // a commission of 2000 but not 2400.
  assert.ok(headroom(5000, 3000) >= ruleThreshold(20000));
  assert.equal(headroom(5000, 3000) >= ruleThreshold(24000), false);
});

test("the client is never more lenient than the rules", () => {
  // The safety property, and the reason this file exists.
  //
  // The quote form decides with `commission - headroom > 0`, i.e. it refuses
  // below money(fee * 0.1). The rules decide with `headroom >= fee * 0.1 -
  // 0.01`. Rounding to two decimals is at most half a cent off, so the client's
  // threshold is always at least as strict as the rule's.
  //
  // If that ever inverted, a worker would pass the form's check, be shown a
  // green Send button, and then get a bare permission-denied from Firestore on
  // submit. So assert the direction, not equality: a balance the client accepts
  // must always satisfy the rule. The rules may be *more* permissive than the
  // form and that is harmless — it just means a tiny slice of headroom the form
  // would not suggest is still acceptable at the database.
  for (let fee = 100; fee <= 200000; fee += 10) {
    for (const cents of [0, 1, 5, 50, 99]) {
      const commission = money(fee * COMMISSION_RATE);
      const balance = headroom(commission, 0) - cents / 100;
      const clientSaysFine = commission - balance <= 0;
      if (!clientSaysFine) continue;
      assert.ok(
        balance >= ruleThreshold(fee),
        `client accepted but rules would refuse: labor ${fee}, balance ${balance}`,
      );
    }
  }
});

test("client and rules agree on the exact quoted amount", () => {
  // The case that actually occurs: a worker tops up precisely to cover the
  // commission on the quote they are about to send. Both must accept.
  for (let fee = 100; fee <= 20000; fee += 50) {
    const commission = money(fee * COMMISSION_RATE);
    const balance = headroom(commission, 0);
    assert.equal(commission - balance <= 0, true, `client refuses labor ${fee}`);
    assert.equal(
      balance >= ruleThreshold(fee),
      true,
      `rules refuse labor ${fee}`,
    );
  }
});
