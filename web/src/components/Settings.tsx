import { useQuery } from '@tanstack/react-query';
import { hasServer } from '../api/client';

type Theme = 'dark' | 'light';

export function Settings({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
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
      <section className="space-y-1">
        <h2 className="font-semibold">Dashboard server</h2>
        <p style={{ color: 'var(--muted)' }}>{server.data ? 'Connected. Projects folder, GitHub account and runner come from the CLI: run `loop dashboard --help`.' : 'No server: showing the bundled demo.'}</p>
      </section>
    </div>
  );
}
