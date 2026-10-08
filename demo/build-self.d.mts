import type { HealthCheck, LoopDetail } from '../src/core/types.js';

export const ROUND_ONE_COMMIT: string;
export const ROUND_ONE_LANES: string[];
export function parseRun(taskText: string): { run: number; limit: number };
export function laneOfCommit(subject: string, body?: string): string | undefined;
export function buildSelf(repoDir: string): Promise<{ loop: LoopDetail; checks: HealthCheck[] }>;
