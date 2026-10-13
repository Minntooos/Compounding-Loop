/** The optional `reason` string in `.ai/policy.json` (the control room writes it when it changes the pace); core's parser drops unknown keys. */
export function policyNote(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  try {
    const reason: unknown = (JSON.parse(text) as { reason?: unknown } | null)?.reason;
    return typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
}
