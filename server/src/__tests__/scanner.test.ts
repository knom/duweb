import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DirectoryScanner } from '../scanner.js';

describe('DirectoryScanner', () => {
  let tempRoot = '';

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  it('scans nested directories, tracks progress, and hydrates percentages', async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'duweb-scan-'));

    const largeDir = path.join(tempRoot, 'large');
    const smallDir = path.join(tempRoot, 'small');
    await mkdir(largeDir);
    await mkdir(smallDir);

    await writeFile(path.join(tempRoot, 'root.bin'), Buffer.alloc(2));
    await writeFile(path.join(largeDir, 'large.bin'), Buffer.alloc(8));
    await writeFile(path.join(smallDir, 'small.bin'), Buffer.alloc(3));

    const progress = {
      directoriesVisited: 0,
      filesVisited: 0,
      startedAt: new Date().toISOString(),
    };

    const tree = await DirectoryScanner.scanDirectoryTree(tempRoot, progress);

    expect(progress.directoriesVisited).toBe(3);
    expect(progress.filesVisited).toBe(3);

    expect(tree.path).toBe(path.resolve(tempRoot));
    expect(tree.sizeBytes).toBe(13);
    expect(tree.percentOfRoot).toBe(100);
    expect(tree.children.map((child) => child.name)).toEqual(['large', 'small']);

    const large = tree.children[0];
    const small = tree.children[1];

    expect(large?.sizeBytes).toBe(8);
    expect(small?.sizeBytes).toBe(3);
    expect(large?.percentOfRoot ?? 0).toBeCloseTo((8 / 13) * 100, 5);
    expect(small?.percentOfRoot ?? 0).toBeCloseTo((3 / 13) * 100, 5);
  });

  it('ignores symbolic links while scanning', async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), 'duweb-scan-'));

    const realFilePath = path.join(tempRoot, 'real.bin');
    await writeFile(realFilePath, Buffer.alloc(4));

    const linkedFilePath = path.join(tempRoot, 'real-link.bin');
    await symlink(realFilePath, linkedFilePath);

    const progress = {
      directoriesVisited: 0,
      filesVisited: 0,
      startedAt: new Date().toISOString(),
    };

    const tree = await DirectoryScanner.scanDirectoryTree(tempRoot, progress);

    expect(tree.sizeBytes).toBe(4);
    expect(progress.filesVisited).toBe(1);
  });

  it('returns inaccessible node for unreadable root path', async () => {
    const missingPath = path.join(tmpdir(), `duweb-missing-${Date.now()}`);

    const progress = {
      directoriesVisited: 0,
      filesVisited: 0,
      startedAt: new Date().toISOString(),
    };

    const tree = await DirectoryScanner.scanDirectoryTree(missingPath, progress);

    expect(progress.directoriesVisited).toBe(1);
    expect(progress.filesVisited).toBe(0);
    expect(tree.path).toBe(path.resolve(missingPath));
    expect(tree.inaccessible).toBe(true);
    expect(tree.children).toEqual([]);
    expect(tree.sizeBytes).toBe(0);
    expect(tree.percentOfRoot).toBe(0);
  });
});
