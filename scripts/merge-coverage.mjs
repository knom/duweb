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

  const mergeMetric = (name) => {
    const server = serverTotal[name];
    const client = clientTotal[name];
    const total = server.total + client.total;
    const covered = server.covered + client.covered;

    return {
      total,
      covered,
      skipped: server.skipped + client.skipped,
      pct: (total === 0 ? 100 : (covered / total) * 100).toFixed(2),
    };
  };

  const merged = {
    total: {
      lines: mergeMetric('lines'),
      statements: mergeMetric('statements'),
      functions: mergeMetric('functions'),
      branches: mergeMetric('branches'),
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
