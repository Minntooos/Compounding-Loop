---
id: R-cli-command-json
title: Add a CLI subcommand with --json output and tests
kind: feature
stack:
  - node@20
tags:
  - cli
  - json
  - subcommand
  - command
status: CONFIRMED
source: Minntooos/Compounding-Loop src/cli and tests/unit/cli, rounds 4 to 6
uses: 0
passes: 0
updated: 2026-10-14
---

## When to use

A Node command-line tool needs one more subcommand that reports something, for people (a table) and for scripts (`--json`). Not for commands that only wrap another tool.

## Steps

1. Write the logic as a pure function that takes its inputs and returns a plain object (no printing, no `process.exit`). Proof: `npm test` runs its unit test.
2. Test it first: the normal result, an empty or missing input, and a bad argument that throws a message saying how to fix it. Use a temp folder, never the real repo. Proof: `npm test`.
3. Register the subcommand with a one-line description and a `--json` option. With `--json` print only `JSON.stringify(result, null, 2)` to stdout; without it print the human text. Proof: a test runs the command and parses stdout.
4. Make errors short and actionable: print them to stderr and set `process.exitCode = 1` instead of exiting mid-stream. Proof: a test asserts the exit code and the message.
5. Add the command to `--help` and the README usage list. Proof: `node bin/<tool>.js --help`.
6. Run the whole suite. Proof: `npm test`.

## Traps

- Any extra `console.log` breaks `--json` for scripts; log progress to stderr.
- Build paths with `node:path`, never a hard-coded `/` (Windows).
- Start child processes with `execFile` and an argument array, never a shell string.
- Tests that use real temp folders can hit `EBUSY` on Windows at cleanup; pass `maxRetries` to `rm` (K-0002).
- A JSON shape is a contract: add fields, never rename them.

## Checks

- `npm test`
- `node bin/<tool>.js <command> --json`

## Start from

- An existing subcommand in the same file (copy its option handling) and its test file.
