import type { DemoSnapshot, HealthCheck, LoopDetail } from '../src/core/types.js';

export function scrubText(text: string): string;
export function toLoopDetail(raw: unknown): LoopDetail;
export function toChecks(raw: unknown): HealthCheck[];
export function buildDemo(referenceDir: string): Promise<DemoSnapshot>;
