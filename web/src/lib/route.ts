import { useEffect, useState } from 'react';

// Hash routing: no server fallback rules needed, so the same build works under `vite preview` and the CLI's static server.
export type Route =
  | { name: 'fleet' } | { name: 'inbox' } | { name: 'health' } | { name: 'settings' } | { name: 'new' }
  | { name: 'loop'; id: string };

export function parseRoute(hash: string): Route {
  const [first = '', second] = hash.replace(/^#\/?/, '').split('/');
  if (first === 'loop' && second) return { name: 'loop', id: decodeURIComponent(second) };
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
