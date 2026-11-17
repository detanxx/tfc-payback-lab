import { DEFAULT_APR, calculateMinimumPayment, dollars, simulateRepayment } from './calculator.js';

const $ = (selector) => document.querySelector(selector);
const money = (cents) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(dollars(cents));
const formatDuration = (months) => {
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years} ${years === 1 ? 'year' : 'years'}, ${remainder} ${remainder === 1 ? 'month' : 'months'}` : `${years} ${years === 1 ? 'year' : 'years'}`;
};
const durationFor = (result) => result.paidOff ? formatDuration(result.months) : '600+ months';
const state = { step: 1, amount: 0, item: '', strategy: 'minimum', payment: 100, baseline: null, current: null };
const panels = { 1: $('#step-1'), 2: $('#step-2'), 3: $('#step-3') };

function showStep(step) {
  state.step = step;
  Object.entries(panels).forEach(([n, panel]) => panel.classList.toggle('hidden', Number(n) !== step));
  document.querySelectorAll('[data-step-indicator]').forEach((el) => {
    const n = Number(el.dataset.stepIndicator);
    el.classList.toggle('current', n === step);
    el.classList.toggle('complete', n < step);
    if (n === step) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
  if (step > 1) panels[step].focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectPurchase(amount, item) {
  state.amount = Math.round(Number(amount) * 100) / 100;
  state.item = item || 'purchase';
  $('#purchase-summary').textContent = `You’re borrowing ${money(state.amount * 100)} for your ${state.item}.`;
  const firstMinimum = calculateMinimumPayment(state.amount * 100, DEFAULT_APR) / 100;
  const fixedInput = $('#fixed-payment');
  fixedInput.min = Math.ceil(firstMinimum);
  fixedInput.value = Math.max(100, Math.ceil(firstMinimum));
  $('#minimum-hint').textContent = `The smallest first payment would be about ${money(firstMinimum * 100)}. Actual card rules vary.`;
  document.querySelectorAll('.purchase-card').forEach((card) => card.classList.toggle('selected', Number(card.dataset.amount) === state.amount && card.dataset.name === item));
  $('#purchase-error').textContent = '';
  showStep(2);
}

document.querySelectorAll('.purchase-card').forEach((card) => card.addEventListener('click', () => selectPurchase(card.dataset.amount, card.dataset.name)));
$('#custom-purchase').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = Number($('#custom-amount').value);
  if (!Number.isFinite(value) || value < 100 || value > 5000) {
    $('#purchase-error').textContent = 'Enter an amount from $100 to $5,000.';
    $('#custom-amount').focus();
    return;
  }
  selectPurchase(value, 'purchase');
});

document.querySelectorAll('.choice-card').forEach((card) => card.addEventListener('click', () => {
  state.strategy = card.dataset.strategy;
  document.querySelectorAll('.choice-card').forEach((option) => {
    const selected = option === card;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
  $('#fixed-options').classList.toggle('hidden', state.strategy !== 'fixed');
  $('#payment-error').textContent = '';
}));

document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showStep(Number(button.dataset.back))));
document.querySelectorAll('[data-payment]').forEach((button) => button.addEventListener('click', () => {
  const amount = Number(button.dataset.payment);
  $('#fixed-payment').value = amount;
  $('#payment-error').textContent = amount < Number($('#fixed-payment').min)
    ? `For this purchase, the first payment needs to be at least ${$('#fixed-payment').min} dollars.`
    : '';
}));

$('#show-results').addEventListener('click', () => {
  state.payment = Number($('#fixed-payment').value || 100);
  if (state.strategy === 'fixed' && state.payment < Number($('#fixed-payment').min)) {
    $('#payment-error').textContent = `The first payment needs to be at least ${$('#fixed-payment').min} dollars.`;
    $('#fixed-payment').focus();
    return;
  }
  state.baseline = simulateRepayment({ amount: state.amount, apr: DEFAULT_APR, strategy: 'minimum' });
  showStep(3);
  const slider = $('#payment-slider');
  const lower = Math.ceil(calculateMinimumPayment(state.amount * 100, DEFAULT_APR) / 100);
  const initial = state.strategy === 'minimum' ? lower : state.strategy === 'full' ? Math.ceil(state.amount) : Math.max(lower, Math.ceil(state.payment));
  slider.min = lower;
  slider.max = Math.max(lower + 1, Math.min(1000, Math.ceil(state.amount)));
  slider.value = Math.min(Number(slider.max), initial);
  $('#slider-min-label').textContent = `Min. ${money(lower * 100)}`;
  $('#slider-max-label').textContent = `${money(Number(slider.max) * 100)} / month`;
  $('#slider-help').textContent = `At least ${money(lower * 100)} to meet the example minimum payment.`;
  updateResults();
});

function activePlan() {
  if (state.strategy === 'full') return { strategy: 'full' };
  if (state.strategy === 'fixed') return { strategy: 'fixed', payment: state.payment };
  return { strategy: 'minimum' };
}

function updateResults() {
  let result;
  try {
    result = simulateRepayment({ amount: state.amount, apr: DEFAULT_APR, ...activePlan() });
  } catch (error) {
    $('#result-message').textContent = error.message;
    return;
  }
  state.current = result;
  $('#result-interest').textContent = money(result.totalInterestCents);
  $('#result-total').textContent = money(result.totalPaidCents);
  $('#result-time').textContent = durationFor(result);
  $('#result-time-caption').textContent = result.paidOff ? 'Until it’s paid off' : 'Still not paid off';
  const interest = result.totalInterestCents;
  let message;
  if (state.strategy === 'full') message = `You paid ${money(state.amount * 100)} by the due date. With an eligible purchase and no older unpaid balance, this example charges no interest.`;
  else if (interest === 0) message = `Your ${state.item} costs the same as its price in this example. At 0% interest, no extra money is added.`;
  else if (state.strategy === 'minimum') message = `Paying the smallest amount keeps the bill manageable each month, but interest adds ${money(interest)} over time.`;
  else message = `Paying ${money(Math.round(state.payment * 100))} each month gets the balance down in ${result.months} ${result.months === 1 ? 'month' : 'months'} and adds ${money(interest)} in interest.`;
  $('#result-message').textContent = message;
  renderChart(state.baseline, result);
  renderMonthlyRows(result);
  updateLiveFeedback(result);
}

function renderChart(minimum, chosen) {
  const svg = $('#balance-chart');
  const width = 640, height = 280, left = 84, right = 14, top = 20, bottom = 58;
  const plotW = width - left - right, plotH = height - top - bottom;
  const horizon = Math.max(1, minimum.months, chosen.months);
  const max = state.amount * 100;
  const x = (m) => left + (m / horizon) * plotW;
  const y = (c) => top + plotH - (c / max) * plotH;
  const pointsFor = (data) => [{ month: 0, balanceCents: max }, ...data.rows];
  const line = (data) => pointsFor(data).map((point, index) => `${index ? 'L' : 'M'} ${x(point.month).toFixed(1)} ${y(point.balanceCents).toFixed(1)}`).join(' ');
  const area = (data) => {
    const points = pointsFor(data);
    const last = points.at(-1);
    const outline = points.map((point) => `L ${x(point.month).toFixed(1)} ${y(point.balanceCents).toFixed(1)}`).join(' ');
    return `M ${x(0).toFixed(1)} ${y(max).toFixed(1)} ${outline} L ${x(last.month).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  };
  const ticks = [...new Set([0, Math.round(horizon * 0.25), Math.round(horizon * 0.5), Math.round(horizon * 0.75), horizon])];
  const compareMinimum = state.strategy !== 'minimum';
  const chosenName = state.strategy === 'minimum' ? 'Smallest payment' : 'Your plan';
  $('#minimum-legend').classList.toggle('hidden', !compareMinimum);
  $('#chosen-legend-text').textContent = chosenName;
  $('#chart-svg-desc').textContent = compareMinimum
    ? `Balance over ${horizon} months. Your plan: ${durationFor(chosen)}. Smallest-payment plan: ${durationFor(minimum)}.`
    : `Your balance using the smallest-payment plan over ${horizon} months.`;
  const markers = (data, label) => {
    const finish = data.months;
    const sampleMonths = [...new Set([0, Math.round(finish * 0.25), Math.round(finish * 0.5), Math.round(finish * 0.75), finish])];
    return sampleMonths.map((month) => {
      const balance = month === 0 ? max : (data.rows[Math.min(month, data.rows.length) - 1]?.balanceCents ?? 0);
      const detail = `${label}, month ${month === 0 ? 'start' : month}: ${money(balance)} still owed`;
      return `<circle class="chart-point ${label === 'Smallest payment' ? 'minimum-point' : 'chosen-point'}" cx="${x(month)}" cy="${y(balance)}" r="4.5" tabindex="0" role="button" aria-label="${detail}"><title>${detail}</title></circle>`;
    }).join('');
  };
  const seriesSummary = (data, label) => data.paidOff
    ? `${label} reaches $0 in ${formatDuration(data.months)}.`
    : `${label} still has ${money(data.rows.at(-1)?.balanceCents ?? data.startingCents)} owing after 600 months.`;
  $('#chart-summary').textContent = compareMinimum
    ? `${seriesSummary(chosen, 'Your plan')} ${seriesSummary(minimum, 'Smallest-payment plan')}`
    : `${seriesSummary(chosen, 'Smallest-payment plan')} Each step is one month.`;
  svg.innerHTML = `<title id="chart-svg-title">Money owed over time</title><desc id="chart-svg-desc">${$('#chart-svg-desc').textContent}</desc>
    <line class="chart-grid" x1="${left}" y1="${y(max)}" x2="${width-right}" y2="${y(max)}"/><line class="chart-grid" x1="${left}" y1="${y(max/2)}" x2="${width-right}" y2="${y(max/2)}"/><line class="chart-grid" x1="${left}" y1="${y(0)}" x2="${width-right}" y2="${y(0)}"/>
    <text class="axis-title" transform="translate(15 ${top+plotH/2}) rotate(-90)" text-anchor="middle">Amount still owed (CAD)</text>
    <text class="axis-label" x="${left-8}" y="${y(max)+4}" text-anchor="end">${money(max)}</text><text class="axis-label" x="${left-8}" y="${y(max/2)+4}" text-anchor="end">${money(max/2)}</text><text class="axis-label" x="${left-8}" y="${y(0)+4}" text-anchor="end">$0 · paid off</text>
    ${ticks.map((tick) => `<text class="axis-label" x="${x(tick)}" y="${top+plotH+16}" text-anchor="${tick===0?'start':tick===horizon?'end':'middle'}">${tick===0?'Start':tick}</text>`).join('')}
    <text class="axis-title" x="${left+plotW/2}" y="${height-4}" text-anchor="middle">Months after purchase →</text>
    ${compareMinimum ? `<path class="chart-area minimum-area" d="${area(minimum)}"/><path class="chart-path minimum-line" d="${line(minimum)}"/>${markers(minimum, 'Smallest payment')}` : ''}<path class="chart-area chosen-area" d="${area(chosen)}"/><path class="chart-path chosen-line" d="${line(chosen)}"/>${markers(chosen, chosenName)}`;
  const detail = $('#chart-point-detail');
  detail.textContent = 'Tap or focus a point to see the amount still owed.';
  svg.querySelectorAll('.chart-point').forEach((point) => {
    const announce = () => { detail.textContent = point.getAttribute('aria-label'); };
    point.addEventListener('focus', announce);
    point.addEventListener('click', announce);
    point.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); announce(); }
    });
  });
}

function renderMonthlyRows(result) {
  $('#month-rows').innerHTML = result.rows.map((row) => `<tr><td>${row.month}</td><td>${money(row.paymentCents)}</td><td>${money(row.interestCents)}</td><td>${money(row.balanceCents)}</td></tr>`).join('');
}

function updateLiveFeedback(result) {
  const slider = $('#payment-slider');
  const payment = Number(slider.value);
  $('#slider-value').textContent = money(payment * 100);
  const baseline = state.baseline;
  const saved = Math.max(0, baseline.totalInterestCents - result.totalInterestCents);
  if (result.totalInterestCents === 0) $('#live-feedback').textContent = `No interest in this example. You’d pay ${money(result.totalPaidCents)} altogether.`;
  else $('#live-feedback').textContent = `This plan takes ${durationFor(result)} and adds ${money(result.totalInterestCents)} in interest. ${saved > 0 ? `That’s ${money(saved)} less interest than the smallest payments.` : 'Try a larger monthly amount to finish sooner.'}`;
}

$('#payment-slider').addEventListener('input', () => {
  state.strategy = 'fixed';
  state.payment = Number($('#payment-slider').value);
  updateResults();
});
$('#start-over').addEventListener('click', () => {
  state.amount = 0;
  state.item = '';
  state.strategy = 'minimum';
  $('#custom-amount').value = '';
  document.querySelectorAll('.purchase-card').forEach((card) => card.classList.remove('selected'));
  document.querySelectorAll('.choice-card').forEach((option) => {
    const selected = option.dataset.strategy === 'minimum';
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', String(selected));
  });
  $('#fixed-options').classList.add('hidden');
  showStep(1);
});

$('#challenge-payment').addEventListener('input', () => {
  const payment = Number($('#challenge-payment').value);
  const feedback = $('#challenge-feedback');
  if (!Number.isFinite(payment) || payment < 10) { feedback.textContent = 'Enter a monthly amount of at least $10.'; return; }
  try {
    const challenge = simulateRepayment({ amount: 1000, apr: DEFAULT_APR, payment });
    const minimum = simulateRepayment({ amount: 1000, apr: DEFAULT_APR, strategy: 'minimum' });
    if (challenge.months <= 12) feedback.textContent = `You found it! ${money(payment * 100)} a month pays it off in ${challenge.months} ${challenge.months === 1 ? 'month' : 'months'}, with ${money(challenge.totalInterestCents)} interest. That’s ${money(Math.max(0, minimum.totalInterestCents - challenge.totalInterestCents))} less than the smallest payments.`;
    else feedback.textContent = `That would take ${challenge.months} months and add ${money(challenge.totalInterestCents)} in interest. Try a little more each month.`;
  } catch (error) { feedback.textContent = error.message; }
});

document.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key) || !event.target.matches('.choice-card')) return;
  event.preventDefault();
  const choices = [...document.querySelectorAll('.choice-card')];
  const index = choices.indexOf(event.target);
  const next = choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length];
  next.focus();
  next.click();
});
