import { describe, expect, it } from 'vitest';
import { createJobRepository } from '../repositories/createJobRepository.js';
import { SQLiteJobRepository } from '../repositories/sqliteJobRepository.js';

describe('createJobRepository', () => {
  it('creates and returns a SQLiteJobRepository instance', () => {
    const repo = createJobRepository();

    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(SQLiteJobRepository);
  });
});
