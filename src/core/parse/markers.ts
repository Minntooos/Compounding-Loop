// DONE.md / BLOCKED.md detection from a plain list of repo-relative file paths. Pure.

import { normalizePath } from '../lanes.js';

export interface StopMarkers {
  rootDone: boolean;
  rootBlocked: boolean;
  /** `.ai/PAUSED` exists: the owner paused every lane. */
  paused: boolean;
  /** Lane names with a `.ai/lanes/<lane>/DONE.md`. */
  doneLanes: string[];
  /** Lane names with a `.ai/lanes/<lane>/BLOCKED.md`. */
  blockedLanes: string[];
}

export function parseStopMarkers(files: readonly string[]): StopMarkers {
  const markers: StopMarkers = { rootDone: false, rootBlocked: false, paused: false, doneLanes: [], blockedLanes: [] };
  for (const file of files.map(normalizePath)) {
    if (file === 'DONE.md') markers.rootDone = true;
    else if (file === 'BLOCKED.md') markers.rootBlocked = true;
    else if (file === '.ai/PAUSED') markers.paused = true;
    else {
      const match = /^\.ai\/lanes\/([^/]+)\/(DONE|BLOCKED)\.md$/.exec(file);
      if (match) (match[2] === 'DONE' ? markers.doneLanes : markers.blockedLanes).push(match[1] as string);
    }
  }
  return markers;
}
