import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

const script = fileURLToPath(new URL('./merge-coverage.mjs', import.meta.url));
let tempDir;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function merge(client, server) {
  tempDir = mkdtempSync(path.join(tmpdir(), 'duweb-coverage-'));
  for (const [name, total] of Object.entries({ client, server })) {
    const coverageDir = path.join(tempDir, name, 'coverage');
    mkdirSync(coverageDir, { recursive: true });
    writeFileSync(path.join(coverageDir, 'coverage-summary.json'), JSON.stringify({ total }));
  }
  execFileSync(process.execPath, [script], { cwd: tempDir });
  return JSON.parse(readFileSync(path.join(tempDir, 'coverage', 'coverage-summary.json'), 'utf8')).total;
}

test('weights coverage by combined totals for every metric', () => {
  const metric = (total, covered, skipped) => ({ total, covered, skipped, pct: 0 });
  const client = {
    lines: metric(10, 10, 1),
    statements: metric(10, 10, 1),
    functions: metric(10, 10, 1),
    branches: metric(10, 10, 1),
  };
  const server = {
    lines: metric(90, 0, 2),
    statements: metric(90, 0, 2),
    functions: metric(90, 0, 2),
    branches: metric(90, 0, 2),
  };

  const result = merge(client, server);
  for (const name of Object.keys(client)) {
    assert.deepEqual(result[name], { total: 100, covered: 10, skipped: 3, pct: '10.00' });
  }
});

test('handles empty metrics and rounds fractional percentages', () => {
  const empty = { total: 0, covered: 0, skipped: 0, pct: 100 };
  const fractional = { total: 3, covered: 1, skipped: 0, pct: 33.33 };
  const client = { lines: empty, statements: fractional, functions: empty, branches: empty };
  const server = { lines: empty, statements: empty, functions: empty, branches: empty };

  const result = merge(client, server);
  assert.equal(result.lines.pct, '100.00');
  assert.equal(result.statements.pct, '33.33');
});
