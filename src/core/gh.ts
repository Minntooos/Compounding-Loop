/** The only GitHub operations the CLI needs. Real calls shell out to `gh` (src/cli/gh.ts); tests use a fake. */
export interface Gh {
  /** Creates a repo from the current folder, pushes it, and returns its URL. */
  createRepoFromFolder(folder: string, name: string, options: { private: boolean }): Promise<string>;
}
