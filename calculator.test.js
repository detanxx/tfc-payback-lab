import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMinimumPayment, simulateRepayment } from './calculator.js';

test('minimum payment is the greater of $10 or 3% after interest', () => {
  assert.equal(calculateMinimumPayment(100_000, 0), 3000);
  assert.equal(calculateMinimumPayment(1000, 0), 1000);
  assert.equal(calculateMinimumPayment(1000, 20.99), 1000);
});

test('fixed payments amortize and total paid equals principal plus interest', () => {
  const result = simulateRepayment({ amount: 1000, apr: 20.99, payment: 100 });
  assert.equal(result.paidOff, true);
  assert.equal(result.months, 12);
  assert.equal(result.totalInterestCents, 10_887);
  assert.equal(result.totalPaidCents, 110_887);
  assert.equal(result.totalPaidCents, result.startingCents + result.totalInterestCents);
  assert.equal(result.rows.at(-1).balanceCents, 0);
});

test('minimum payment eventually clears the illustrative balance', () => {
  const result = simulateRepayment({ amount: 1000, strategy: 'minimum' });
  assert.equal(result.paidOff, true);
  assert.ok(result.totalInterestCents > 0);
});

test('paying in full uses the grace-period assumption and charges no interest', () => {
  const result = simulateRepayment({ amount: 300, apr: 20.99, strategy: 'full' });
  assert.equal(result.months, 1);
  assert.equal(result.totalInterestCents, 0);
  assert.equal(result.totalPaidCents, 30_000);
});

test('zero interest and very small balances work', () => {
  const zero = simulateRepayment({ amount: 100, apr: 0, payment: 25 });
  assert.equal(zero.totalInterestCents, 0);
  assert.equal(zero.months, 4);
  const tiny = simulateRepayment({ amount: 0.05, apr: 0, payment: 10 });
  assert.equal(tiny.rows[0].paymentCents, 5);
});

test('rejects payments below minimum and unsupported APR', () => {
  assert.throws(() => simulateRepayment({ amount: 1000, payment: 10 }), /Choose at least/);
  assert.throws(() => simulateRepayment({ amount: 1000, apr: 36, payment: 100 }), /between 0% and 35%/);
});

test('caps the final payment and rounds all payments to cents', () => {
  const result = simulateRepayment({ amount: 100, apr: 0, payment: 33.333 });
  assert.equal(result.totalPaidCents, 10_000);
  assert.equal(result.rows[0].paymentCents, 3333);
  assert.equal(result.rows.at(-1).paymentCents, 1);
});

test('high APR works, while fixed payments below the minimum are rejected', () => {
  const high = simulateRepayment({ amount: 100, apr: 35, payment: 40 });
  assert.equal(high.paidOff, true);
  assert.throws(() => simulateRepayment({ amount: 1000, apr: 35, payment: 10.01 }), /Choose at least/);
});

test('repayment duration is bounded to 600 months', () => {
  const result = simulateRepayment({ amount: 5000, apr: 35, strategy: 'minimum' });
  assert.equal(result.months, 600);
  assert.equal(result.paidOff, false);
});
