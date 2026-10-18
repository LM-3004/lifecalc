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

function calculateTargetPlan({ amountStillNeeded, weeklySurplus, targetTime, targetUnit }) {
  if (targetTime == null || String(targetTime).trim() === '') return null;

  const time = Number(targetTime);
  const weeksPerUnit = { week: 1, month: 52 / 12, year: 52 };
  const weeks = time * weeksPerUnit[targetUnit];
  if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(weeks) || weeks > 5200
    || !Number.isFinite(amountStillNeeded) || amountStillNeeded < 0
    || !Number.isFinite(weeklySurplus)) {
    return { valid: false };
  }

  const neededCents = Math.round(amountStillNeeded * 100);
  const weeklySurplusCents = Math.round(weeklySurplus * 100);
  const requiredWeeklyCents = neededCents === 0 ? 0 : Math.ceil(neededCents / weeks - 1e-10);
  const weeklyShortfallCents = Math.max(0, requiredWeeklyCents - weeklySurplusCents);

  return {
    valid: true,
    time,
    unit: targetUnit,
    weeks,
    amountStillNeeded: neededCents / 100,
    requiredWeekly: requiredWeeklyCents / 100,
    weeklySurplus: weeklySurplusCents / 100,
    weeklyShortfall: weeklyShortfallCents / 100,
    sufficient: neededCents === 0 || (weeklySurplusCents > 0 && weeklySurplusCents >= requiredWeeklyCents)
  };
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
  let targetPlanMarkup = '';
  if (data.targetPlan) {
    const plan = data.targetPlan;
    const timeframe = `${plan.time} ${plan.unit}${plan.time === 1 ? '' : 's'}`;
    const weeks = roundedNumber(plan.weeks);
    const weeksText = Number.isInteger(weeks) ? weeks : weeks.toFixed(1);
    const timeframeWithWeeks = plan.unit === 'week' ? timeframe : `${timeframe} (≈${weeksText} weeks)`;
    let status;
    if (plan.amountStillNeeded === 0) {
      status = 'Your target is already met; no additional saving is required.';
    } else if (plan.sufficient) {
      status = 'Your current weekly surplus is enough to meet this target.';
    } else {
      status = 'Your current budget is not sufficient to meet this target.';
    }
    const shortfallAdvice = plan.amountStillNeeded > 0 && !plan.sufficient
      ? `<p>You would need an additional ${money(plan.weeklyShortfall)} per week. Consider reducing expenses, increasing income, lowering the purchase price or buffer, or choosing a later date.${plan.weeklySurplus > 0 ? ` At your current surplus, the target would take approximately ${formatTime(plan.amountStillNeeded * 100 / Math.round(plan.weeklySurplus * 100))}.` : ' Your current surplus is zero or negative, so additional savings or a later date would be needed.'}</p>`
      : '';
    targetPlanMarkup = `<div class="timeline target-plan"><h3>Deadline savings plan</h3><ul><li>Amount still needed: <strong>${money(plan.amountStillNeeded)}</strong></li><li>Target timeframe: <strong>${timeframeWithWeeks}</strong></li><li>Required weekly savings: <strong>${money(plan.requiredWeekly)}</strong></li><li>Current weekly surplus after expenses: <strong>${money(plan.weeklySurplus)}</strong></li><li>${status}</li></ul>${shortfallAdvice}<p class="muted">This estimate assumes income and expenses stay consistent. It is an estimate, not financial advice.</p></div>`;
  }

  results.innerHTML = `<div class="result-status ${statusClass}"><span class="result-icon">${data.canAfford ? '✓' : '!'}</span><div><p class="eyebrow">Your estimate</p><h2>${statusTitle}</h2><p>${gapText}</p></div></div>
    <div class="metric-grid"><div class="metric"><span>Current savings</span><strong>${money(data.savings)}</strong></div><div class="metric"><span>After purchase</span><strong>${money(data.afterPurchase)}</strong></div><div class="metric"><span>Weekly surplus</span><strong>${money(data.normalWeeklySurplus)}</strong></div></div>
    <div class="timeline"><h3>Saving timeline</h3><p>${baseTimeline}</p><p class="muted">${data.amountStillNeeded > 0 ? `Your target is ${money(data.targetSavings)} in total savings.` : 'No additional saving is needed to meet your target.'}</p></div>
    <div class="breakdown"><h3>How this was calculated</h3><ul><li>Weekly income: <strong>${money(data.weeklyIncome)}</strong></li><li>Weekly expenses: <strong>${money(data.weeklyExpenses)}</strong></li><li>Normal weekly surplus: <strong>${money(data.normalWeeklySurplus)}</strong></li><li>Projected weekly saving with your additional saving: <strong>${money(data.projectedWeeklySaving)}</strong></li></ul></div>
    <div class="scenarios"><h3>What if you save more each week?</h3><p class="muted">These are separate scenarios — choose the amount you could realistically save. Each option adds only that amount to your normal weekly surplus.</p>${scenarioRows}</div>
    <p class="result-note">This is an estimate, not financial advice. It only reflects the information entered and does not guarantee affordability.</p>${targetPlanMarkup}`;
}

function setupCalculator() {
  const form = document.getElementById('affordability-form');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('form-error');
    const names = ['income', 'savings', 'housing', 'food', 'transport', 'bills', 'entertainment', 'debt', 'other', 'purchase', 'buffer', 'extra'];
    const values = Object.fromEntries(names.map(name => [name, readAmount(form, name)]));
    const weeklyExpenses = ['housing', 'food', 'transport', 'bills', 'entertainment', 'debt', 'other']
      .reduce((sum, name) => sum + (weeklyAmount(form, name, `${name}Frequency`) ?? NaN), 0);
    const weeklyIncome = values.income === null
      ? null
      : values.income * (frequencyToWeekly[form.elements.incomeFrequency.value] || 0);
    const invalid = Object.values(values).some(value => value === null)
      || !Number.isFinite(weeklyExpenses)
      || !Number.isFinite(weeklyIncome);
    if (invalid) {
      error.textContent = 'Please enter valid amounts of zero or more. Values must be no larger than $1,000,000,000.';
      error.hidden = false;
      return;
    }

    const normalWeeklySurplus = weeklyIncome - weeklyExpenses;
    const projectedWeeklySaving = normalWeeklySurplus + values.extra;
    const targetSavings = values.purchase + values.buffer;
    const amountStillNeeded = Math.max(0, targetSavings - values.savings);
    const afterPurchase = values.savings - values.purchase;
    const estimatedWeeks = weeksFor(amountStillNeeded, projectedWeeklySaving);
    const targetPlan = calculateTargetPlan({
      amountStillNeeded,
      weeklySurplus: normalWeeklySurplus,
      targetTime: form.elements.targetTime.value,
      targetUnit: form.elements.targetUnit.value
    });
    if (targetPlan && !targetPlan.valid) {
      error.textContent = 'Please enter a target timeframe greater than zero and no longer than 100 years.';
      error.hidden = false;
      return;
    }
    error.textContent = 'Please enter valid amounts of zero or more. Values must be no larger than $1,000,000,000.';
    error.hidden = true;

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
      targetPlan,
      canAfford: afterPurchase >= values.buffer
    });
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function setupTargetPresets() {
  document.querySelectorAll('[data-target-time]').forEach(button => button.addEventListener('click', () => {
    const form = document.getElementById('affordability-form');
    form.elements.targetTime.value = button.getAttribute('data-target-time');
    form.elements.targetUnit.value = button.getAttribute('data-target-unit');
  }));
}

function setupMenu() {
  document.querySelectorAll('.menu-toggle').forEach(button => button.addEventListener('click', () => {
    const nav = document.getElementById(button.getAttribute('aria-controls'));
    const open = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
  }));
}

if (typeof window !== 'undefined') window.calculateTargetPlan = calculateTargetPlan;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateTargetPlan, frequencyToWeekly, money, readAmount, weeklyAmount };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => { setupCalculator(); setupTargetPresets(); setupMenu(); });
}
