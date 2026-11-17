export const DEFAULT_APR = 20.99;
export const MAX_MONTHS = 600;

const toCents = (dollars) => Math.round(Number(dollars) * 100);
const toDollars = (cents) => cents / 100;

export function calculateMinimumPayment(balanceCents, apr = DEFAULT_APR) {
  if (balanceCents <= 0) return 0;
  const afterInterest = balanceCents + Math.round(balanceCents * (apr / 1200));
  return Math.min(afterInterest, Math.max(1000, Math.round(afterInterest * 0.03)));
}

/** Monthly-interest teaching model. All balances and payments are integer cents. */
export function simulateRepayment({ amount, apr = DEFAULT_APR, strategy = 'fixed', payment }) {
  const startingCents = toCents(amount);
  if (!Number.isFinite(startingCents) || startingCents <= 0) throw new Error('Purchase amount must be greater than $0.');
  if (!Number.isFinite(apr) || apr < 0 || apr > 35) throw new Error('Yearly interest rate must be between 0% and 35%.');

  if (strategy === 'full') {
    return { startingCents, totalInterestCents: 0, totalPaidCents: startingCents, months: 1, rows: [{ month: 1, paymentCents: startingCents, interestCents: 0, balanceCents: 0 }], paidOff: true };
  }

  const requestedPayment = strategy === 'minimum' ? null : toCents(payment);
  let balance = startingCents;
  let totalInterest = 0;
  let totalPaid = 0;
  const rows = [];

  for (let month = 1; month <= MAX_MONTHS && balance > 0; month += 1) {
    const interest = Math.round(balance * (apr / 1200));
    const amountOwed = balance + interest;
    const minimum = Math.min(amountOwed, Math.max(1000, Math.round(amountOwed * 0.03)));
    const paid = strategy === 'minimum' ? minimum : Math.min(requestedPayment, amountOwed);
    if (!Number.isFinite(paid) || paid < minimum) throw new Error(`Choose at least ${toDollars(minimum).toFixed(2)} for the first payment.`);
    const nextBalance = Math.max(0, amountOwed - paid);
    if (nextBalance >= balance && nextBalance > 0) {
      return { startingCents, totalInterestCents: totalInterest + interest, totalPaidCents: totalPaid, months: month, rows, paidOff: false };
    }
    totalInterest += interest;
    totalPaid += paid;
    balance = nextBalance;
    rows.push({ month, paymentCents: paid, interestCents: interest, balanceCents: balance });
  }

  return { startingCents, totalInterestCents: totalInterest, totalPaidCents: totalPaid, months: rows.length, rows, paidOff: balance === 0 };
}

export function dollars(cents) {
  return toDollars(cents);
}
