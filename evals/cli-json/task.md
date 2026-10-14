Add a `stats` subcommand to this small Node CLI.

- `notes stats --dir <folder>` counts the notes (`.txt` files) in the folder and the words in all of them, and prints `2 notes, 7 words` (singular `1 note`, `1 word`). With `--json` it prints only `{"notes":2,"words":7}` (pretty-printed JSON is fine) and nothing else on stdout.
- A folder that does not exist is an error: print a one-line message to stderr, nothing to stdout, exit code 1. An empty folder is not an error.
- Put the counting in a pure function that returns a plain object, add unit tests in `tests/`, and list the command in `--help`.
- `npm test` must pass. Follow how the existing `list` command is built.
