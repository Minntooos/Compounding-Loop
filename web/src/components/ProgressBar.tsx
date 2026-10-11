/** 6 px track with a text label beside it; never a percent, so it does not imply precision. */
export function ProgressBar({ label, value, max, text, color }: { label: string; value: number; max: number; text: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuenow={value} aria-valuemax={max} aria-valuetext={text}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <span className="shrink-0 font-mono tabular-nums" style={{ color: 'var(--muted)' }}>{text}</span>
    </div>
  );
}
