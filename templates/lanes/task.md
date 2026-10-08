# Lane: {{lane}}

Run: 0 / {{limit}}
Status: not started
Created: {{date}}

## Contract
**Goal:** <one sentence: what this lane delivers for {{name}}>
**Owns:** {{owns}}
**Done when:**
- `npm test` passes (or the project's test command from CLAUDE.md).
- <a checkable line per deliverable, each provable by a command>
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything.
**Out of scope:** <what belongs to another lane>

## Units, in order
1. **Audit** (`.ai/audit/{{lane}}.md`): review your area as a demanding specialist; findings ranked blocker / major / minor, each with evidence and a one-line fix.
2. <first real unit>

## Decisions
<decision → reason. Written instead of asking a human.>

## Confirmed
<fact → how we know>

## Guesses
<assumption → what would prove it. Never treat a GUESS from an earlier window as fact.>

## Tried
<attempt → exact error → why it failed>

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, or publish anything.

## Handoff
<Rewritten at the end of every run: commit, whether the tree is clean, the single next step, what to read first.>
