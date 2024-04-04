import assert from 'node:assert';
import { test } from 'node:test';
import { extractPlaceholders, resolveOutFilePath } from './fs-utils.js';

test('extractPlaceholders', () => {
  const p1 = extractPlaceholders('/prj/src/tutorial/index.js', '/prj/src');
  assert.deepStrictEqual(p1, {
    dir: '/prj/src/tutorial',
    main: '/prj/src/tutorial/index',
    basename: 'index',
    filename: 'index.js',
    ext: 'js',
    basedir: '/prj/src',
    reldir: 'tutorial',
    relmain: 'tutorial/index'
  });

  const p2 = extractPlaceholders('/path/to/foo', null);
  assert.deepStrictEqual(p2, {
    dir: '/path/to',
    main: '/path/to/foo',
    basename: 'foo',
    filename: 'foo',
    ext: ''
  });
});

test('resolveOutFilePath', () => {
  assert.equal(
    resolveOutFilePath('/prj/src/tutorial/index.md', null, null),
    '/prj/src/tutorial/index.md'
  );

  assert.equal(
    resolveOutFilePath('/prj/src/tutorial/index.md', null, '/tmp/out.md'),
    '/tmp/out.md'
  );

  assert.equal(
    resolveOutFilePath(
      '/prj/src/tutorial/index.md',
      '/prj/src',
      '{dir}/{basename}-ja.{ext}'
    ),
    '/prj/src/tutorial/index-ja.md'
  );

  assert.equal(
    resolveOutFilePath(
      '/prj/src/tutorial/index.md',
      '/prj/src',
      '{basedir}/i18n/ja/{relmain}-ja.{ext}'
    ),
    '/prj/src/i18n/ja/tutorial/index-ja.md'
  );

  assert.equal(
    resolveOutFilePath(
      '/prj/src/tutorial/index.md',
      null,
      '{basedir}/{dummy}/{test}'
    ),
    '{basedir}/{dummy}/{test}'
  );
});
