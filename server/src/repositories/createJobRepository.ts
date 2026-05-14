import type { JobRepository } from './jobRepository.js';
import { SQLiteJobRepository } from './sqliteJobRepository.js';

export function createJobRepository(): JobRepository {
  return new SQLiteJobRepository();
}
