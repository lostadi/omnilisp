import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runLisp } from '../src/index.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = (...args) => spawnSync(process.execPath,
  ['--import', 'tsx', path.join(root, 'bin/omnilisp.js'), ...args],
  { cwd: root, encoding: 'utf8', timeout: 5000 });

for (const [file, expected] of [['factorial.lisp', '720'], ['closures.lisp', '42']]) {
  test(`browser evaluator and CLI agree on ${file}`, async () => {
    const source = await readFile(path.join(root, 'examples', file), 'utf8');
    assert.deepEqual((await runLisp(source)).output, [expected]);
    const result = cli('run', path.join('examples', file));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expected);
  });
}

test('an unbound symbol fails normally rather than being silently repaired', async () => {
  await assert.rejects(runLisp('(print missing-value)'), /Undefined symbol/);
  const result = cli('eval', '-e', '(print missing-value)');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Undefined symbol/);
});

test('unknown commands and unsupported source targets exit unsuccessfully', () => {
  assert.equal(cli('does-not-exist').status, 1);
  assert.equal(cli('build', 'examples/factorial.lisp', '--target', 'wasm').status, 1);
});

test('status and ping disclose their local simulation boundary', () => {
  assert.match(cli('status').stdout, /No native Ostadix/);
  assert.match(cli('ping').stdout, /SIMULATED PONG/);
});

test('the documented TypeScript build command produces executable factorial source', async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'omnilisp-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const output = path.join(temp, 'factorial.ts');
  const built = cli('build', 'examples/factorial.lisp', '--target', 'ts', '-o', output);
  assert.equal(built.status, 0, built.stderr);
  const result = spawnSync(process.execPath, ['--import', 'tsx', output],
    { cwd: root, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '720');
});

test('the Rust factorial output compiles and agrees with the interpreters', async t => {
  if (spawnSync('rustc', ['--version']).status !== 0) return t.skip('rustc is not installed');
  const temp = await mkdtemp(path.join(tmpdir(), 'omnilisp-rust-test-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'factorial.rs');
  const executable = path.join(temp, 'factorial');
  const built = cli('build', 'examples/factorial.lisp', '--target', 'rust', '-o', source);
  assert.equal(built.status, 0, built.stderr);
  const compiled = spawnSync('rustc', ['--edition=2021', source, '-o', executable],
    { encoding: 'utf8', timeout: 30000 });
  assert.equal(compiled.status, 0, compiled.stderr);
  const result = spawnSync(executable, [], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '720');
});
