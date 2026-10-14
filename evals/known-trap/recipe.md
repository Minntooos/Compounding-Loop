---
id: R-node-csv-report
title: Summarise a CSV file in a small Node project
kind: feature
stack:
  - node@20
tags:
  - csv
  - report
  - parse
status: CONFIRMED
source: Minntooos/Compounding-Loop evals/known-trap, written for the eval
uses: 0
passes: 0
updated: 2026-10-14
---

## When to use

A small zero-dependency Node project needs a function that reads a CSV file and totals a column by another column.

## Steps

1. Read the file as text, split it into lines and drop blank lines. Proof: `npm test`.
2. Treat the first line as the header and look the columns up by name, not by position. Proof: `npm test`.
3. Test with the real data file as well as a string you wrote. Proof: `npm test`.

## Traps

- Check the real data file, not only a string you typed: it may differ from your sample in ways you did not expect.
- Convert `qty` with `Number` before adding.

## Checks

- `npm test`

## Start from

- An existing function in `src/` and its test in `tests/`.
