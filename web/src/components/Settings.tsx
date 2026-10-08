import { useQuery } from '@tanstack/react-query';
import { api, hasServer } from '../api/client';
import { RUNNERS } from '../lib/newLoop';

type Theme = 'dark' | 'light';

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className="min-w-0 break-words">
        {value}
        {hint && <span className="block text-sm" style={{ color: 'var(--muted)' }}>{hint}</span>}
      </dd>
    </div>
  );
}

export function Settings({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const s = settings.data;
  const runner = RUNNERS.find((r) => r.id === s?.defaultRunner)?.label ?? s?.defaultRunner ?? '…';
  return (
    <div className="max-w-xl space-y-6">
      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">Theme</legend>
        {(['dark', 'light'] as const).map((t) => (
          <label key={t} className="mr-4 inline-flex items-center gap-2">
            <input type="radio" name="theme" checked={theme === t} onChange={() => setTheme(t)} />{t === 'dark' ? 'Dark' : 'Light'}
          </label>
        ))}
      </fieldset>
      <section className="space-y-3" aria-labelledby="server-heading">
        <h2 id="server-heading" className="font-semibold">Dashboard server</h2>
        {!server.data || s?.demo ? (
          <p style={{ color: 'var(--muted)' }}>{server.data ? 'Showing the built-in demo of five real loops.' : 'No server: showing the bundled demo.'} Point it at your loops with <code>loop dashboard --projects &lt;folder&gt;</code>.</p>
        ) : null}
        <dl className="space-y-2" aria-label="Server settings">
          <Row label="Projects folder" value={s?.projectsDir ?? 'none (demo)'} hint={s?.projectsDir ? 'Change it with loop dashboard --projects <folder>.' : undefined} />
          <Row label="GitHub account" value={s?.ghAccount ?? (s?.demo ? 'none (demo)' : 'not signed in')} hint={s && !s.demo && !s.ghAccount ? 'Run gh auth login to create repos from the wizard.' : undefined} />
          <Row label="Default runner" value={runner} />
        </dl>
      </section>
    </div>
  );
}
