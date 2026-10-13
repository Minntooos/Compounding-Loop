import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Notice } from './components/QueryState';
import { needsYouCount } from './lib/lanes';
import { api, hasServer } from './api/client';
import { CommandPalette } from './components/CommandPalette';
import { Fleet } from './components/Fleet';
import { Health } from './components/Health';
import { Inbox } from './components/Inbox';
import { LoopDetail } from './components/LoopDetail';
import { NewLoop } from './components/NewLoop';
import { Settings } from './components/Settings';
import { onToast, Toasts, type Toast } from './components/Toasts';
import { WelcomeStrip } from './components/WelcomeStrip';
import { getLive, liveStore } from './api/live';
import { mockSnapshot } from './api/mock';
import { indicatorText, LIVE_TTL_MS } from './lib/liveCache';
import { newestActivity, shortDateUtc } from './lib/format';
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

/** Header chip: live/snapshot state in demo mode (DESIGN.md "States"). Without live mode it stays the plain snapshot label. */
function SourceChip({ snapshotDate }: { snapshotDate: string }) {
  const live = useSyncExternalStore(liveStore.subscribe, liveStore.get);
  const { label, tone } = live ? indicatorText(live, Date.now()) : { label: `Snapshot from ${snapshotDate}`, tone: 'calm' as const };
  const dot = tone === 'live' ? 'var(--done)' : tone === 'stale' ? 'var(--blocked)' : 'var(--muted)';
  return (
    <p role="status" className="order-2 ml-auto flex items-center gap-1.5 text-[12px] md:order-3 md:ml-0" style={{ color: 'var(--muted)' }}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dot }} />
      {live ? label : <>Snapshot <span className="hidden md:inline">from&nbsp;</span>{snapshotDate}</>}
    </p>
  );
}

/** Explains the fallback once the header chip has said it briefly (DESIGN.md "States"). */
function PausedLiveNotice() {
  const live = useSyncExternalStore(liveStore.subscribe, liveStore.get);
  if (live?.kind !== 'rate-limited') return null;
  const at = live.resetAt ? new Date(live.resetAt) : undefined;
  const resume = at && !Number.isNaN(at.getTime()) ? ` The live view resumes about ${at.toISOString().slice(11, 16)} UTC.` : '';
  return <Notice>Live view paused: GitHub lets a browser make 60 requests an hour without signing in. The snapshot below is complete, just older.{resume}</Notice>;
}

function Shell() {
  const route = useRoute();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const loops = useQuery({ queryKey: ['loops'], queryFn: api.loops });
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
  // Same list as the fleet banner, so the badge and the banner always agree (A4).
  const attention = needsYouCount(loops.data ?? [], inbox.data ?? []);
  const snapshotDate = shortDateUtc(newestActivity(loops.data ?? [], mockSnapshot.generatedAt));
  const qc = useQueryClient();
  useEffect(() => {
    if (server.data !== false) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void getLive(snapshotDate, true).then(() => qc.invalidateQueries());
    };
    const id = window.setInterval(refresh, LIVE_TTL_MS);
    return () => window.clearInterval(id);
  }, [server.data, snapshotDate, qc]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5_000);
  }, []);
  useLiveUpdates(server.data, notify);
  useEffect(() => onToast(notify), [notify]);
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 md:gap-x-6 md:py-3">
          <a href="#/" className="order-1 flex items-center gap-2 text-[15px] font-semibold"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={22} height={22} />Compounding Loop</a>
          <nav aria-label="Main" className="order-3 -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 md:order-2 md:mx-0 md:w-auto md:flex-1 md:overflow-visible md:px-0">
            {NAV.map((n) => (
              <a key={n.label} href={href(n.route)} aria-current={current === n.route.name ? 'page' : undefined}
                className="flex min-h-11 shrink-0 items-center whitespace-nowrap rounded px-3 py-1.5 aria-[current=page]:bg-[var(--border)] md:min-h-0">
                {n.label}{n.route.name === 'inbox' && attention > 0 ? <span data-testid="nav-attention" className="ml-1.5 rounded-full px-1.5 text-[12px]" style={{ background: 'var(--blocked)', color: 'var(--bg)' }}>{attention}</span> : null}
              </a>
            ))}
          </nav>
          {server.data === false && <SourceChip snapshotDate={snapshotDate} />}
          <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} className={`order-2 rounded p-2 md:order-3 ${server.data === false ? '' : 'ml-auto md:ml-0'}`}>
            {theme === 'dark' ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {server.data === false && route.name === 'fleet' && <WelcomeStrip />}
        <h1 className="mb-5 text-[28px] font-semibold">{route.name === 'fleet' ? 'Your loops' : route.name === 'loop' ? route.id : NAV.find((n) => n.route.name === route.name)?.label}</h1>
        <PausedLiveNotice />
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
