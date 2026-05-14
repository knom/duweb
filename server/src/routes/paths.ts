import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Router } from 'express';
import { expandHomePath } from '../utils/path.js';

export function registerPathRoutes(api: Router) {
  api.get('/paths/suggest', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    console.debug(`[Paths] Suggest query: "${query}"`);
    const expanded = expandHomePath(query);

    let baseDir = expanded;
    let fragment = '';

    if (!expanded) {
      baseDir = path.parse(process.cwd()).root || '/';
    } else if (expanded.endsWith(path.sep)) {
      baseDir = expanded;
    } else {
      baseDir = path.dirname(expanded);
      fragment = path.basename(expanded);
    }

    if (!path.isAbsolute(baseDir)) {
      baseDir = path.resolve(baseDir);
    }

    try {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      const search = fragment.toLowerCase();
      const suggestions = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => name.toLowerCase().startsWith(search))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 20)
        .map((name) => path.join(baseDir, name));

      console.debug(`[Paths] Found ${suggestions.length} suggestions in ${baseDir}`);
      res.json({ suggestions });
    } catch (error) {
      console.warn(`[Paths] Error reading directory ${baseDir}:`, error instanceof Error ? error.message : error);
      res.json({ suggestions: [] as string[] });
    }
  });
}
