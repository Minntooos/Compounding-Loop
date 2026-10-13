import { useEffect, useState } from 'react';

// Hash routing: no server fallback rules needed, so the same build works under `vite preview` and the CLI's static server.
export type Route =
  | { name: 'fleet' } | { name: 'inbox' } | { name: 'health' } | { name: 'settings' } | { name: 'new' }
  | { name: 'loop'; id: string; focus?: RunFocus };

/** A heat-map cell's slot, opened in the loop's Runs tab (`#/loop/<id>?tab=Runs&run=<at>&lane=<lane>`). */
export interface RunFocus { lane: string; at: string }

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [first = '', second] = path.split('/');
  if (first === 'loop' && second) {
    const q = new URLSearchParams(query);
    const at = q.get('run');
    const lane = q.get('lane');
    return { name: 'loop', id: decodeURIComponent(second), ...(q.get('tab') === 'Runs' && at && lane && { focus: { lane, at } }) };
  }
  if (first === 'inbox' || first === 'health' || first === 'settings' || first === 'new') return { name: first };
  return { name: 'fleet' };
}

export const href = (r: Route): string => (r.name === 'loop' ? `#/loop/${encodeURIComponent(r.id)}` : r.name === 'fleet' ? '#/' : `#/${r.name}`);

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parseRoute(hash);
}
