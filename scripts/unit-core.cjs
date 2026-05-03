const assert = require('node:assert/strict');

function mse(actual, predicted) {
  return actual.reduce((sum, value, i) => sum + (value - predicted[i]) ** 2, 0) / actual.length;
}
function rmse(actual, predicted) { return Math.sqrt(mse(actual, predicted)); }
function mae(actual, predicted) { return actual.reduce((sum, value, i) => sum + Math.abs(value - predicted[i]), 0) / actual.length; }
function rSquared(actual, predicted) {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssTot = actual.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const ssRes = actual.reduce((sum, value, i) => sum + (value - predicted[i]) ** 2, 0);
  return 1 - ssRes / ssTot;
}

assert.equal(mse([1, 2, 3], [1, 2, 3]), 0);
assert.equal(rmse([1, 2, 3], [1, 2, 3]), 0);
assert.equal(mae([1, 2, 3], [1, 2, 3]), 0);
assert.equal(rSquared([1, 2, 3], [1, 2, 3]), 1);
assert.equal(mse([1, 2, 3], [2, 2, 2]), 2 / 3);

console.log('Core unit smoke passed for metrics formulas.');
