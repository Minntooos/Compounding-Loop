import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, hasServer } from './api/client';
import { CommandPalette } from './components/CommandPalette';
import { Fleet } from './components/Fleet';
import { Health } from './components/Health';
import { Inbox } from './components/Inbox';
import { LoopDetail } from './components/LoopDetail';
import { NewLoop } from './components/NewLoop';
import { Settings } from './components/Settings';
import { Toasts, type Toast } from './components/Toasts';
import { href, useRoute, type Route } from './lib/route';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: false } } });
const NAV: { label: string; route: Route }[] = [
  { label: 'Fleet', route: { name: 'fleet' } }, { label: 'Inbox', route: { name: 'inbox' } },
  { label: 'Health', route: { name: 'health' } }, { label: 'New loop', route: { name: 'new' } }, { label: 'Settings', route: { name: 'settings' } },
];

type Theme = 'dark' | 'light';
function initialTheme(): Theme {
  try { const t = localStorage.getItem('theme'); if (t === 'dark' || t === 'light') return t; } catch { /* storage blocked */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function Page({ route, theme, setTheme }: { route: Route; theme: Theme; setTheme: (t: Theme) => void }) {
  switch (route.name) {
    case 'fleet': return <Fleet />;
    case 'loop': return <LoopDetail id={route.id} />;
    case 'inbox': return <Inbox />;
    case 'health': return <Health />;
    case 'new': return <NewLoop />;
    case 'settings': return <Settings theme={theme} setTheme={setTheme} />;
  }
}

/** Server-sent events (.ai/contracts.md): refetch what changed. No server, no stream. */
function useLiveUpdates(connected: boolean | undefined, notify: (text: string) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!connected) return;
    const es = new EventSource('/api/events');
    const refetch = (...keys: string[]) => keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));
    es.addEventListener('loop-updated', () => { refetch('loops', 'loop'); notify('A loop was updated'); });
    es.addEventListener('inbox-changed', () => { refetch('inbox', 'loops'); notify('Your inbox changed'); });
    es.addEventListener('checks-changed', () => refetch('checks'));
    return () => es.close();
  }, [connected, qc, notify]);
}

function Shell() {
  const route = useRoute();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5_000);
  }, []);
  useLiveUpdates(server.data, notify);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  const go = (r: Route) => () => { window.location.hash = href(r); };
  const palette = [
    ...NAV.map((n) => ({ label: `Go to ${n.label}`, run: go(n.route) })),
    { label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
  ];
  const current = route.name === 'loop' ? 'fleet' : route.name;
  return (
    <>
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <a href="#/" className="flex items-center gap-2 text-[15px] font-semibold"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={22} height={22} />Compounding Loop</a>
          <nav aria-label="Main" className="flex flex-1 gap-1">
            {NAV.map((n) => (
              <a key={n.label} href={href(n.route)} aria-current={current === n.route.name ? 'page' : undefined}
                className="rounded px-3 py-1.5 aria-[current=page]:bg-[var(--border)]">
                {n.label}{n.route.name === 'inbox' && inbox.data?.length ? <span className="ml-1.5 rounded-full px-1.5 text-[12px]" style={{ background: 'var(--blocked)', color: 'var(--bg)' }}>{inbox.data.length}</span> : null}
              </a>
            ))}
          </nav>
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className="rounded p-2">
            {theme === 'dark' ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
          </button>
        </div>
      </header>
      {server.data === false && <p role="status" className="px-4 py-2 text-center text-[13px]" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>Sample data: no dashboard server is running, so this shows the five-site demo.</p>}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-5 text-[28px] font-semibold">{route.name === 'fleet' ? 'Compounding Loop' : route.name === 'loop' ? route.id : NAV.find((n) => n.route.name === route.name)?.label}</h1>
        <Page route={route} theme={theme} setTheme={setTheme} />
      </main>
      <Toasts toasts={toasts} />
      <CommandPalette items={palette} />
    </>
  );
}

export function App() {
  return <QueryClientProvider client={queryClient}><Shell /></QueryClientProvider>;
}
