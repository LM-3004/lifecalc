const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const { calculateTargetPlan, frequencyToWeekly, readAmount, weeklyAmount } = require('../script.js');

function closeTo(actual, expected, tolerance = 0.005) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

function runCalculator(values) {
  const elements = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value: String(value) }]));
  const form = {
    elements,
    addEventListener(type, handler) {
      if (type === 'submit') this.submit = handler;
    }
  };
  const results = { innerHTML: '', scrollIntoView() {} };
  const error = {
    hidden: true,
    textContent: 'Please enter valid amounts of zero or more. Values must be no larger than $1,000,000,000.'
  };
  const document = {
    addEventListener(type, handler) {
      if (type === 'DOMContentLoaded') this.ready = handler;
    },
    getElementById(id) {
      return id === 'affordability-form' ? form : id === 'results' ? results : id === 'form-error' ? error : null;
    },
    querySelectorAll() {
      return [];
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../script.js'), 'utf8'), { document, window: {} });
  document.ready();
  form.submit({ preventDefault() {} });
  return { error, results };
}

const baselineInputs = {
  income: 4000, incomeFrequency: 'month', savings: 2000,
  housing: 1500, housingFrequency: 'month', food: 400, foodFrequency: 'month',
  transport: 200, transportFrequency: 'month', bills: 150, billsFrequency: 'month',
  entertainment: 200, entertainmentFrequency: 'month', debt: 0, debtFrequency: 'month',
  other: 150, otherFrequency: 'month', purchase: 1500, buffer: 1000, extra: 0,
  targetTime: '', targetUnit: 'week'
};

test('deadline works with the existing mixed-frequency budget conversion', () => {
  const weeklyIncome = 4000 * frequencyToWeekly.month;
  const weeklyExpenses = 1500 * frequencyToWeekly.month + 100 + 50 + 150 * frequencyToWeekly.month
    + 50 + 0 + 150 * frequencyToWeekly.month;
  const result = calculateTargetPlan({
    amountStillNeeded: 1500 + 1000 - 2000,
    weeklySurplus: weeklyIncome - weeklyExpenses,
    targetTime: '8',
    targetUnit: 'week'
  });

  closeTo(weeklyIncome - weeklyExpenses, 307.6923076923);
  assert.equal(result.requiredWeekly, 62.5);
  assert.equal(result.weeklyShortfall, 0);
  assert.equal(result.sufficient, true);
});

test('deadline shortfall is calculated from a low positive surplus', () => {
  const result = calculateTargetPlan({
    amountStillNeeded: 3000 + 1000 - 0,
    weeklySurplus: (2000 - 1800) * frequencyToWeekly.month,
    targetTime: '4',
    targetUnit: 'week'
  });

  assert.equal(result.amountStillNeeded, 4000);
  assert.equal(result.requiredWeekly, 1000);
  assert.equal(result.weeklyShortfall, 953.85);
  assert.equal(result.sufficient, false);
});

test('target already met needs no further saving, even with zero surplus', () => {
  const result = calculateTargetPlan({
    amountStillNeeded: 0, weeklySurplus: 0, targetTime: '2', targetUnit: 'week'
  });
  assert.equal(result.requiredWeekly, 0);
  assert.equal(result.weeklyShortfall, 0);
  assert.equal(result.sufficient, true);
});

test('zero and negative surplus never satisfy an unmet target', () => {
  const zeroSurplus = calculateTargetPlan({
    amountStillNeeded: 4000, weeklySurplus: 0, targetTime: '4', targetUnit: 'week'
  });
  const negativeSurplus = calculateTargetPlan({
    amountStillNeeded: 4000, weeklySurplus: -20, targetTime: '4', targetUnit: 'week'
  });

  assert.equal(zeroSurplus.sufficient, false);
  assert.equal(zeroSurplus.weeklyShortfall, 1000);
  assert.equal(negativeSurplus.sufficient, false);
  assert.equal(negativeSurplus.weeklyShortfall, 1020);
});

test('blank timeframe opts out and invalid timeframes are rejected', () => {
  assert.equal(calculateTargetPlan({
    amountStillNeeded: 500, weeklySurplus: 100, targetTime: '', targetUnit: 'week'
  }), null);

  for (const [targetTime, targetUnit] of [
    ['0', 'week'], ['-1', 'week'], ['NaN', 'week'], ['5201', 'week'], ['101', 'year'], ['1', 'decade']
  ]) {
    assert.equal(calculateTargetPlan({
      amountStillNeeded: 500, weeklySurplus: 100, targetTime, targetUnit
    }).valid, false, `${targetTime} ${targetUnit} should be invalid`);
  }
});

test('months and years convert to their correct number of weeks', () => {
  assert.equal(calculateTargetPlan({
    amountStillNeeded: 500, weeklySurplus: 100, targetTime: '6', targetUnit: 'month'
  }).weeks, 26);
  assert.equal(calculateTargetPlan({
    amountStillNeeded: 500, weeklySurplus: 100, targetTime: '1', targetUnit: 'year'
  }).weeks, 52);
});

test('empty optional expenses retain their zero-value behavior', () => {
  const form = { elements: { other: { value: '' }, otherFrequency: { value: 'month' } } };
  assert.equal(readAmount(form, 'other'), 0);
  assert.equal(weeklyAmount(form, 'other', 'otherFrequency'), 0);
});

test('required savings round up to the next cent', () => {
  const result = calculateTargetPlan({
    amountStillNeeded: 100, weeklySurplus: 0, targetTime: '3', targetUnit: 'week'
  });
  assert.equal(result.requiredWeekly, 33.34);
  assert.equal(result.weeklyShortfall, 33.34);
});

test('blank timeframe preserves the existing results output byte-for-byte', () => {
  const { error, results } = runCalculator(baselineInputs);
  assert.equal(error.hidden, true);
  assert.equal(crypto.createHash('sha256').update(results.innerHTML).digest('hex'),
    '4844926d9fac4b0f3cf5b8505e68c8800209fd25acf73bd941b8ad7902a12bb7');
});

test('submitted deadline renders the new plan without counting extra savings', () => {
  const { error, results } = runCalculator({
    ...baselineInputs,
    food: 100, foodFrequency: 'week', transport: 50, transportFrequency: 'week',
    entertainment: 50, entertainmentFrequency: 'week',
    extra: 100000, targetTime: '8', targetUnit: 'week'
  });

  assert.equal(error.hidden, true);
  assert.match(results.innerHTML, /Deadline savings plan/);
  assert.match(results.innerHTML, /Amount still needed: <strong>\$500\.00/);
  assert.match(results.innerHTML, /Required weekly savings: <strong>\$62\.50/);
  assert.match(results.innerHTML, /Current weekly surplus after expenses: <strong>\$307\.69/);
  assert.match(results.innerHTML, /current weekly surplus is enough/);
});

test('insufficient deadline results include the shortfall and practical advice', () => {
  const { error, results } = runCalculator({
    ...baselineInputs,
    income: 2000, savings: 0, housing: 1800, housingFrequency: 'month',
    food: '', transport: '', bills: '', entertainment: '', debt: '', other: '',
    purchase: 3000, buffer: 1000, extra: 0, targetTime: '4', targetUnit: 'week'
  });

  assert.equal(error.hidden, true);
  assert.match(results.innerHTML, /Required weekly savings: <strong>\$1,000\.00/);
  assert.match(results.innerHTML, /Current weekly surplus after expenses: <strong>\$46\.15/);
  assert.match(results.innerHTML, /additional \$953\.85 per week/);
  assert.match(results.innerHTML, /reducing expenses, increasing income, lowering the purchase price or buffer, or choosing a later date/);
});

test('invalid submitted timeframe shows an error and does not render results', () => {
  const { error, results } = runCalculator({ ...baselineInputs, targetTime: '0' });
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /greater than zero/);
  assert.equal(results.innerHTML, '');
});
