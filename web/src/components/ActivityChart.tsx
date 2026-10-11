import type { LoopCommit } from '@core/types';
import { commitsPerDay, dayHeading } from '../lib/timeline';

const W = 600;
const H = 80;

/** Commits per day as hand-written SVG bars. The summary in aria-label and the per-bar titles are the text alternative. */
export function ActivityChart({ commits }: { commits: LoopCommit[] }) {
  const days = commitsPerDay(commits);
  if (days.length < 2) return null;
  const max = Math.max(...days.map((d) => d.count));
  const step = W / days.length;
  const total = days.reduce((n, d) => n + d.count, 0);
  const label = `Commits per day, ${dayHeading(days[0]!.day)} to ${dayHeading(days[days.length - 1]!.day)}: ${total} in total, busiest day ${max}.`;
  return (
    <figure data-testid="activity-chart" className="rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <figcaption className="mb-1 text-[12px]" style={{ color: 'var(--muted)' }}>Commits per day (UTC)</figcaption>
      <svg role="img" aria-hidden="false" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="h-20 w-full">
        {days.map((d, i) => {
          const h = d.count === 0 ? 1 : Math.max(2, (d.count / max) * (H - 4));
          return (
            <rect key={d.day} x={i * step + 1} y={H - h} width={Math.max(step - 2, 1)} height={h} fill={d.count === 0 ? 'var(--border)' : 'var(--accent)'}>
              <title>{`${dayHeading(d.day)}: ${d.count} ${d.count === 1 ? 'commit' : 'commits'}`}</title>
            </rect>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Commits per day (UTC)</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Commits</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.day}><td>{dayHeading(d.day)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
