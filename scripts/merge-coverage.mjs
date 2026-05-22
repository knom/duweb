#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

/**
 * Merge coverage reports from client and server
 */
function mergeCoverageReports() {
  const serverSummary = JSON.parse(
    readFileSync('./server/coverage/coverage-summary.json', 'utf-8')
  );
  const clientSummary = JSON.parse(
    readFileSync('./client/coverage/coverage-summary.json', 'utf-8')
  );

  // Extract total stats from both
  const serverTotal = serverSummary.total;
  const clientTotal = clientSummary.total;

  // Merge by averaging the percentages
  const merged = {
    total: {
      lines: {
        total: serverTotal.lines.total + clientTotal.lines.total,
        covered: serverTotal.lines.covered + clientTotal.lines.covered,
        skipped: serverTotal.lines.skipped + clientTotal.lines.skipped,
        pct: (
          (serverTotal.lines.pct + clientTotal.lines.pct) / 2
        ).toFixed(2),
      },
      statements: {
        total: serverTotal.statements.total + clientTotal.statements.total,
        covered: serverTotal.statements.covered + clientTotal.statements.covered,
        skipped: serverTotal.statements.skipped + clientTotal.statements.skipped,
        pct: (
          (serverTotal.statements.pct + clientTotal.statements.pct) / 2
        ).toFixed(2),
      },
      functions: {
        total: serverTotal.functions.total + clientTotal.functions.total,
        covered: serverTotal.functions.covered + clientTotal.functions.covered,
        skipped: serverTotal.functions.skipped + clientTotal.functions.skipped,
        pct: (
          (serverTotal.functions.pct + clientTotal.functions.pct) / 2
        ).toFixed(2),
      },
      branches: {
        total: serverTotal.branches.total + clientTotal.branches.total,
        covered: serverTotal.branches.covered + clientTotal.branches.covered,
        skipped: serverTotal.branches.skipped + clientTotal.branches.skipped,
        pct: (
          (serverTotal.branches.pct + clientTotal.branches.pct) / 2
        ).toFixed(2),
      },
    },
  };

  // Create coverage directory and write merged report
  mkdirSync('coverage', { recursive: true });
  writeFileSync('coverage/coverage-summary.json', JSON.stringify(merged, null, 2));

  console.log(
    `✓ Merged coverage reports: ${merged.total.lines.pct}% (statements: ${merged.total.statements.pct}%)`
  );
}

mergeCoverageReports();
