const frequencyToWeekly = { week: 1, fortnight: 0.5, month: 12 / 52, year: 1 / 52 };

function money(value) {
  const safe = Number.isFinite(value) ? value : 0;
  return `$${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function readAmount(form, name) {
  const input = form.elements[name];
  if (!input) return 0;
  const raw = input.value.trim();
  if (raw === '') return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1000000000 ? value : null;
}

function weeklyAmount(form, name, frequencyName) {
  const amount = readAmount(form, name);
  if (amount === null) return null;
  const frequency = form.elements[frequencyName].value;
  return amount * (frequencyToWeekly[frequency] || 0);
}

function weeksFor(amountStillNeeded, weeklySavingAmount) {
  if (amountStillNeeded <= 0) return 0;
  if (!(weeklySavingAmount > 0) || !Number.isFinite(weeklySavingAmount)) return null;

  const weeks = amountStillNeeded / weeklySavingAmount;
  return Number.isFinite(weeks) && weeks >= 0 ? weeks : null;
}

function roundedNumber(value) {
  return Number(value.toFixed(1));
}

function formatTime(weeks) {
  if (weeks === null || !Number.isFinite(weeks) || weeks < 0) {
    return 'Not currently reachable';
  }
  if (weeks === 0) return 'Already covered';

  if (weeks < 1) {
    const days = roundedNumber(weeks * 7);
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  const roundedWeeks = roundedNumber(weeks);
  return `${roundedWeeks} week${roundedWeeks === 1 ? '' : 's'}`;
}

function renderResults(data) {
  const results = document.getElementById('results');
  const statusClass = data.canAfford ? 'result-good' : 'result-caution';
  const statusTitle = data.canAfford ? 'This purchase stays above your buffer' : 'This purchase would dip below your buffer';
  const gapText = data.amountStillNeeded > 0
    ? `You would need to save ${money(data.amountStillNeeded)} more to reach the purchase price and buffer.`
    : 'The purchase price and your buffer are covered by your current savings.';
  const baseTimeline = data.estimatedWeeks === null
    ? 'Not currently reachable — you have no positive weekly saving available for this target.'
    : data.estimatedWeeks === 0
      ? 'You already meet the savings target.'
      : `Estimated time: <strong>${formatTime(data.estimatedWeeks)}</strong>`;
  const scenarioRows = [25, 50, 100, 200].map(extraWeeklySaving => {
    const scenarioWeeklySaving = data.normalWeeklySurplus + extraWeeklySaving;
    const estimatedWeeks = weeksFor(data.amountStillNeeded, scenarioWeeklySaving);
    return `<div class="scenario-row"><span>Save ${money(extraWeeklySaving)} more per week</span><strong>${formatTime(estimatedWeeks)}</strong></div>`;
  }).join('');

  results.innerHTML = `<div class="result-status ${statusClass}"><span class="result-icon">${data.canAfford ? '✓' : '!'}</span><div><p class="eyebrow">Your estimate</p><h2>${statusTitle}</h2><p>${gapText}</p></div></div>
    <div class="metric-grid"><div class="metric"><span>Current savings</span><strong>${money(data.savings)}</strong></div><div class="metric"><span>After purchase</span><strong>${money(data.afterPurchase)}</strong></div><div class="metric"><span>Weekly surplus</span><strong>${money(data.normalWeeklySurplus)}</strong></div></div>
    <div class="timeline"><h3>Saving timeline</h3><p>${baseTimeline}</p><p class="muted">${data.amountStillNeeded > 0 ? `Your target is ${money(data.targetSavings)} in total savings.` : 'No additional saving is needed to meet your target.'}</p></div>
    <div class="breakdown"><h3>How this was calculated</h3><ul><li>Weekly income: <strong>${money(data.weeklyIncome)}</strong></li><li>Weekly expenses: <strong>${money(data.weeklyExpenses)}</strong></li><li>Normal weekly surplus: <strong>${money(data.normalWeeklySurplus)}</strong></li><li>Projected weekly saving with your additional saving: <strong>${money(data.projectedWeeklySaving)}</strong></li></ul></div>
    <div class="scenarios"><h3>What if you save more each week?</h3><p class="muted">These are separate scenarios — choose the amount you could realistically save. Each option adds only that amount to your normal weekly surplus.</p>${scenarioRows}</div>
    <p class="result-note">This is an estimate, not financial advice. It only reflects the information entered and does not guarantee affordability.</p>`;
}

const expenseNames = ['housing', 'food', 'transport', 'bills', 'entertainment', 'debt', 'other'];

function readCalculatorInputs(form) {
  const names = ['income', 'savings', ...expenseNames, 'purchase', 'buffer', 'extra'];
  const values = Object.fromEntries(names.map(name => [name, readAmount(form, name)]));
  const weeklyExpenses = expenseNames
    .reduce((sum, name) => sum + (weeklyAmount(form, name, `${name}Frequency`) ?? NaN), 0);
  const weeklyIncome = values.income === null
    ? null
    : values.income * (frequencyToWeekly[form.elements.incomeFrequency.value] || 0);
  const invalid = Object.values(values).some(value => value === null)
    || !Number.isFinite(weeklyExpenses)
    || !Number.isFinite(weeklyIncome);
  return invalid ? null : { values, weeklyIncome, weeklyExpenses };
}

function signedMoney(value) {
  return value < 0 ? `-${money(-value)}` : money(value);
}

function roundCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function weeksLabel(weeks) {
  return `${weeks} week${weeks === 1 ? '' : 's'}`;
}

function timeframePlan({ purchase, buffer, savings, weeklyIncome, weeklyExpenses, weeks }) {
  const amountStillNeeded = roundCents(Math.max(0, purchase + buffer - savings));
  const requiredWeekly = roundCents(amountStillNeeded / weeks);
  const availableWeekly = roundCents(weeklyIncome - weeklyExpenses);
  const weeklyShortfall = roundCents(Math.max(0, requiredWeekly - availableWeekly));
  const goalReached = amountStillNeeded === 0;
  const canMeet = goalReached || (availableWeekly > 0 && weeklyShortfall === 0);
  return { amountStillNeeded, weeks, requiredWeekly, availableWeekly, weeklyShortfall, goalReached, canMeet };
}

function renderTimeframeResults(container, plan) {
  if (!plan) {
    container.innerHTML = '<h3>Your timeframe estimate</h3><p class="muted">Enter your income, expenses, savings and purchase price to see what you need to save each week.</p>';
    return;
  }
  const rows = `<div class="scenario-row"><span>Amount still needed</span><strong>${money(plan.amountStillNeeded)}</strong></div>
    <div class="scenario-row"><span>Selected timeframe</span><strong>${weeksLabel(plan.weeks)}</strong></div>
    <div class="scenario-row"><span>Required weekly savings</span><strong>${money(plan.requiredWeekly)}</strong></div>
    <div class="scenario-row"><span>Available weekly savings</span><strong>${signedMoney(plan.availableWeekly)}</strong></div>`;
  let message;
  if (plan.goalReached) {
    message = 'You have already reached this goal — your current savings cover the purchase price and your buffer, so no weekly saving is required ($0.00/week).';
  } else if (plan.availableWeekly <= 0) {
    message = `Your budget leaves no money to save each week (${signedMoney(plan.availableWeekly)}), so this goal can't be reached through regular saving. Increase your income or reduce your expenses.`;
  } else if (plan.weeklyShortfall > 0) {
    message = `Your current budget cannot meet this deadline. You are short by ${money(plan.weeklyShortfall)} per week. Choose a longer timeframe, increase your income or reduce your expenses.`;
  } else {
    message = `Your current budget can meet this deadline: you need ${money(plan.requiredWeekly)} per week and have ${money(plan.availableWeekly)} available.`;
  }
  container.innerHTML = `<h3>Your timeframe estimate</h3>${rows}<p class="timeframe-status ${plan.canMeet ? 'result-good' : 'result-caution'}">${message}</p>`;
}

function setupTimeframe(form) {
  const slider = form.elements.timeframe;
  const label = document.getElementById('timeframe-value');
  const container = document.getElementById('timeframe-results');
  if (!slider || !label || !container) return;
  const update = () => {
    const weeks = Number(slider.value);
    const text = weeksLabel(weeks);
    label.textContent = text;
    slider.setAttribute('aria-valuetext', text);
    const inputs = readCalculatorInputs(form);
    const purchaseBlank = form.elements.purchase.value.trim() === '';
    renderTimeframeResults(container, inputs === null || purchaseBlank ? null : timeframePlan({
      purchase: inputs.values.purchase,
      buffer: inputs.values.buffer,
      savings: inputs.values.savings,
      weeklyIncome: inputs.weeklyIncome,
      weeklyExpenses: inputs.weeklyExpenses,
      weeks
    }));
  };
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  update();
}

function setupCalculator() {
  const form = document.getElementById('affordability-form');
  if (!form) return;
  setupTimeframe(form);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('form-error');
    const inputs = readCalculatorInputs(form);
    const invalid = inputs === null;
    if (invalid) { error.hidden = false; return; }
    error.hidden = true;
    const { values, weeklyIncome, weeklyExpenses } = inputs;

    const normalWeeklySurplus = weeklyIncome - weeklyExpenses;
    const projectedWeeklySaving = normalWeeklySurplus + values.extra;
    const targetSavings = values.purchase + values.buffer;
    const amountStillNeeded = Math.max(0, targetSavings - values.savings);
    const afterPurchase = values.savings - values.purchase;
    const estimatedWeeks = weeksFor(amountStillNeeded, projectedWeeklySaving);

    renderResults({
      savings: values.savings,
      purchase: values.purchase,
      buffer: values.buffer,
      afterPurchase,
      targetSavings,
      amountStillNeeded,
      weeklyIncome,
      weeklyExpenses,
      normalWeeklySurplus,
      projectedWeeklySaving,
      estimatedWeeks,
      canAfford: afterPurchase >= values.buffer
    });
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function setupMenu() {
  document.querySelectorAll('.menu-toggle').forEach(button => button.addEventListener('click', () => {
    const nav = document.getElementById(button.getAttribute('aria-controls'));
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  }));
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => { setupCalculator(); setupMenu(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { timeframePlan, weeksLabel, roundCents };
}
