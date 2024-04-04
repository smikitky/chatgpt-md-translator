import assert from 'node:assert';
import { test } from 'node:test';
import formatTime from './formatTime.js';

test('formatTime', () => {
  assert.strictEqual(formatTime(500), '0 seconds');
  assert.strictEqual(formatTime(1_500), '1 second');
  assert.strictEqual(formatTime(5_200), '5 seconds');
  assert.strictEqual(formatTime(90_000), '1:30');
  assert.strictEqual(formatTime(60_000), '1:00');
  assert.strictEqual(formatTime(600_000), '10:00');
});
