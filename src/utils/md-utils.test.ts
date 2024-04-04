import assert from 'node:assert';
import { test } from 'node:test';
import * as md from './md-utils.js';

const input1 =
  '  ```txt\n' +
  '  aaa\n' +
  '  bbb\n' +
  '  ccc\n' +
  '  ddd\n' +
  '  eee\n' +
  '  fff\n' +
  '  ```';

const input2 =
  '```txt\n' +
  'aaa\n' +
  'bbb\n' +
  'ccc\n' +
  'ddd\n' +
  'eee\n' +
  'fff\n' +
  '```';

const input3 =
  '   ```txt filename=foo\n' +
  '     aaa\n' +
  '     bbb\n' +
  '   ccc\n' +
  '   ddd\n' +
  '   e  ee\n' +
  '   ff   f\n' +
  '   ```';

test('replace and restore code blocks', () => {
  const t = (input: string) => {
    const result = md.replaceCodeBlocks(input);
    const restored = md.restoreCodeBlocks(result.output, result.codeBlocks);
    assert.equal(restored, input);
  };
  t(input1);
  t(input2);
  t(input3);
});
