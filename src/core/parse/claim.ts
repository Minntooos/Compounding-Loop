// Lane claims: `.ai/lanes/<lane>/claim` holds one line, `name · expires <UTC ISO>`. Pure.

export interface Claim {
  name: string;
  expiresAt: Date;
}

const SEPARATOR = ' · ';

export function formatClaim(name: string, expiresAt: Date): string {
  return `${name}${SEPARATOR}expires ${expiresAt.toISOString()}\n`;
}

/** Parses a claim file; undefined when it is empty or malformed (a malformed claim counts as none). */
export function parseClaim(text: string): Claim | undefined {
  const line = text.split(/\r?\n/).find((l) => l.trim() !== '')?.trim();
  if (!line) return undefined;
  const match = /^(.+?)\s+·\s+expires\s+(\S+)$/.exec(line);
  if (!match) return undefined;
  const expiresAt = new Date(match[2] as string);
  if (Number.isNaN(expiresAt.getTime())) return undefined;
  return { name: (match[1] as string).trim(), expiresAt };
}

/** The claim if it is still in force at `now`; an expired or missing claim is no claim. */
export function activeClaim(text: string | undefined, now: Date = new Date()): Claim | undefined {
  const claim = text === undefined ? undefined : parseClaim(text);
  return claim && claim.expiresAt.getTime() > now.getTime() ? claim : undefined;
}
