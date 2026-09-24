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

function weeksFor(target, weeklyRate) {
  if (target <= 0) return 0;
  if (!(weeklyRate > 0) || !Number.isFinite(weeklyRate)) return null;
  return Math.ceil(target / weeklyRate);
}

function renderResults(data) {
  const results = document.getElementById('results');
  const statusClass = data.canAfford ? 'result-good' : 'result-caution';
  const statusTitle = data.canAfford ? 'This purchase stays above your buffer' : 'This purchase would dip below your buffer';
  const gapText = data.gap > 0 ? `You would need to save ${money(data.gap)} more to reach the purchase price and buffer.` : 'The purchase price and your buffer are covered by your current savings.';
  const baseTimeline = data.weeks === null ? 'A timeline cannot be estimated from the weekly surplus entered.' : data.weeks === 0 ? 'You already meet the savings target.' : `Estimated time: <strong>${data.weeks} week${data.weeks === 1 ? '' : 's'}</strong>`;
  const scenarioRows = [25, 50, 100, 200].map(extra => {
    const weeks = weeksFor(data.gap, data.weeklySurplus + extra);
    const text = weeks === null ? 'No positive surplus' : weeks === 0 ? 'Already covered' : `${weeks} week${weeks === 1 ? '' : 's'}`;
    return `<div class="scenario-row"><span>Save an extra ${money(extra)} / week</span><strong>${text}</strong></div>`;
  }).join('');

  results.innerHTML = `<div class="result-status ${statusClass}"><span class="result-icon">${data.canAfford ? '✓' : '!'}</span><div><p class="eyebrow">Your estimate</p><h2>${statusTitle}</h2><p>${gapText}</p></div></div>
    <div class="metric-grid"><div class="metric"><span>Current savings</span><strong>${money(data.savings)}</strong></div><div class="metric"><span>After purchase</span><strong>${money(data.afterPurchase)}</strong></div><div class="metric"><span>Weekly surplus</span><strong>${money(data.weeklySurplus)}</strong></div><div class="metric"><span>Desired buffer</span><strong>${money(data.buffer)}</strong></div></div>
    <div class="timeline"><h3>Saving timeline</h3><p>${baseTimeline}</p><p class="muted">${data.gap > 0 ? `Your target is ${money(data.purchase + data.buffer)} in total savings.` : 'No additional saving is needed for the entered target.'}</p></div>
    <div class="breakdown"><h3>How this was calculated</h3><ul><li>Weekly income: <strong>${money(data.weeklyIncome)}</strong></li><li>Weekly expenses: <strong>${money(data.weeklyExpenses)}</strong></li><li>Weekly surplus + optional saving: <strong>${money(data.weeklySurplus)}</strong></li><li>Current savings − purchase price: <strong>${money(data.afterPurchase)}</strong></li></ul></div>
    <div class="scenarios"><h3>What if you save a little extra?</h3><p class="muted">These scenarios add to the weekly surplus above.</p>${scenarioRows}</div>
    <p class="result-note">This is an estimate, not financial advice. It only reflects the information entered and does not guarantee affordability.</p>`;
}

function setupCalculator() {
  const form = document.getElementById('affordability-form');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const error = document.getElementById('form-error');
    const names = ['income', 'savings', 'housing', 'food', 'transport', 'bills', 'entertainment', 'debt', 'other', 'purchase', 'buffer', 'extra'];
    const values = Object.fromEntries(names.map(name => [name, readAmount(form, name)]));
    const weeklyExpenses = ['housing', 'food', 'transport', 'bills', 'entertainment', 'debt', 'other'].reduce((sum, name) => sum + (weeklyAmount(form, name, `${name}Frequency`) ?? NaN), 0);
    const weeklyIncome = values.income === null ? null : values.income * (frequencyToWeekly[form.elements.incomeFrequency.value] || 0);
    const invalid = Object.values(values).some(value => value === null) || !Number.isFinite(weeklyExpenses) || !Number.isFinite(weeklyIncome);
    if (invalid) { error.hidden = false; return; }
    error.hidden = true;
    const weeklySurplus = weeklyIncome - weeklyExpenses + values.extra;
    const afterPurchase = values.savings - values.purchase;
    const gap = Math.max(0, values.purchase + values.buffer - values.savings);
    renderResults({ savings: values.savings, purchase: values.purchase, buffer: values.buffer, afterPurchase, gap, weeklyIncome, weeklyExpenses, weeklySurplus, canAfford: afterPurchase >= values.buffer, weeks: weeksFor(gap, weeklySurplus) });
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

document.addEventListener('DOMContentLoaded', () => { setupCalculator(); setupMenu(); });
