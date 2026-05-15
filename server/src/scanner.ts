import { Dirent } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { DirectoryNode, ScanProgress } from './types.js';

interface ScanContext {
  progress: ScanProgress;
  visitedDirectories: Set<string>;
}

async function readEntries(dirPath: string): Promise<Dirent[] | null> {
  try {
    return await readdir(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }
}

async function walkDirectory(dirPath: string, context: ScanContext): Promise<DirectoryNode> {
  context.progress.directoriesVisited += 1;

  try {
    const canonicalPath = await realpath(dirPath);
    if (context.visitedDirectories.has(canonicalPath)) {
      return {
        name: path.basename(dirPath) || dirPath,
        path: dirPath,
        sizeBytes: 0,
        percentOfRoot: 0,
        children: [],
      };
    }
    context.visitedDirectories.add(canonicalPath);
  } catch {
    // Ignore realpath failures and continue with the resolved path.
  }

  const entries = await readEntries(dirPath);
  if (entries === null) {
    return {
      name: path.basename(dirPath) || dirPath,
      path: dirPath,
      sizeBytes: 0,
      percentOfRoot: 0,
      children: [],
      inaccessible: true,
    };
  }

  const children: DirectoryNode[] = [];
  let totalSize = 0;

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const child = await walkDirectory(entryPath, context);
      totalSize += child.sizeBytes;
      children.push(child);
      continue;
    }

    if (entry.isSymbolicLink()) {
      continue;
    }

    try {
      const info = await lstat(entryPath);
      if (info.isFile()) {
        context.progress.filesVisited += 1;
        totalSize += info.size;
      }
    } catch {
      // Ignore unreadable files and continue scanning.
    }
  }

  children.sort((a, b) => b.sizeBytes - a.sizeBytes);

  return {
    name: path.basename(dirPath) || dirPath,
    path: dirPath,
    sizeBytes: totalSize,
    percentOfRoot: 0,
    children,
  };
}

function hydratePercentages(root: DirectoryNode, rootSize: number): void {
  root.percentOfRoot = rootSize === 0 ? 0 : (root.sizeBytes / rootSize) * 100;
  for (const child of root.children) {
    hydratePercentages(child, rootSize);
  }
}

export async function scanDirectoryTree(rootPath: string, progress: ScanProgress): Promise<DirectoryNode> {
  const context: ScanContext = {
    progress,
    visitedDirectories: new Set<string>(),
  };

  const resolved = path.resolve(rootPath);
  const root = await walkDirectory(resolved, context);
  hydratePercentages(root, root.sizeBytes);
  return root;
}
