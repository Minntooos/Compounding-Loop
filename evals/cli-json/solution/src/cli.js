import { listNotes, noteStats } from './notes.js';

const HELP = `Usage: notes <command> [options]

Commands:
  list --dir <folder> [--json]   List the notes in a folder
  stats --dir <folder> [--json]  Count the notes and their words
  --help                         Show this help
`;

const option = (args, name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

/** Runs the CLI with injected output so tests need no child process. Returns the exit code. */
export async function main(args, io) {
  const [command] = args;
  if (!command || command === '--help' || command === '-h') {
    io.out(HELP);
    return 0;
  }
  if (command === 'list') {
    try {
      const notes = listNotes(option(args, '--dir') ?? '.');
      io.out(args.includes('--json') ? JSON.stringify({ notes }, null, 2) + '\n' : notes.map((n) => n.name).join('\n') + (notes.length ? '\n' : ''));
      return 0;
    } catch (error) {
      io.err(`notes: ${error.message}\n`);
      return 1;
    }
  }
  if (command === 'stats') {
    try {
      const stats = noteStats(option(args, '--dir') ?? '.');
      const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
      io.out(args.includes('--json') ? JSON.stringify(stats, null, 2) + '\n' : `${plural(stats.notes, 'note')}, ${plural(stats.words, 'word')}\n`);
      return 0;
    } catch (error) {
      io.err(`notes: ${error.message}\n`);
      return 1;
    }
  }
  io.err(`notes: unknown command "${command}". Run notes --help.\n`);
  return 1;
}
