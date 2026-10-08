import { useState } from 'react';
import { lintBrief, MIN_BRIEF_SCORE } from '@core/brief';
import { newLoopCommand, RUNNERS, slugName, TEMPLATES } from '../lib/newLoop';

const STEPS = ['Brief', 'Template', 'Runner', 'Command'] as const;

function Choice<T extends { id: string; label: string; blurb: string }>({ name, options, value, onChange }: { name: string; options: readonly T[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={o.id} className="cursor-pointer rounded-lg border p-3 has-[:checked]:border-[var(--accent)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <input type="radio" name={name} className="mr-2" checked={value === o.id} onChange={() => onChange(o.id)} />
          <span className="font-medium">{o.label}</span><span className="block pl-6" style={{ color: 'var(--muted)' }}>{o.blurb}</span>
        </label>
      ))}
    </div>
  );
}

export function NewLoop() {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState('');
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<string>(TEMPLATES[0].id);
  const [runner, setRunner] = useState<string>(RUNNERS[0].id);
  const lint = lintBrief(brief);
  const passes = lint.score >= MIN_BRIEF_SCORE;
  const command = newLoopCommand(template, name);
  return (
    <div className="max-w-2xl space-y-5">
      <ol className="flex flex-wrap gap-x-4 text-[13px]" aria-label="Steps">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className="aria-[current=step]:font-semibold" style={{ color: i === step ? 'var(--text)' : 'var(--muted)' }}>{i + 1}. {s}</li>)}
      </ol>
      {step === 0 && (
        <section className="space-y-3">
          <label className="block">Brief: what should be built, for whom, must-haves, done-when, out of scope
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={10} className="mt-1 w-full rounded border p-2 font-mono" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} />
          </label>
          <p role="status" className="font-medium" style={{ color: passes ? 'var(--done)' : 'var(--blocked)' }} data-testid="brief-score">Brief score {lint.score}/100 {passes ? '(ready)' : `(needs ${MIN_BRIEF_SCORE})`}</p>
          <ul className="list-disc pl-5" style={{ color: 'var(--muted)' }}>{lint.gaps.map((g) => <li key={g.id}>{g.message}</li>)}</ul>
        </section>
      )}
      {step === 1 && <Choice name="Template" options={TEMPLATES} value={template} onChange={setTemplate} />}
      {step === 2 && <Choice name="Runner" options={RUNNERS} value={runner} onChange={setRunner} />}
      {step === 3 && (
        <section className="space-y-3">
          <label className="block">Name <input value={name} onChange={(e) => setName(e.target.value)} className="ml-2 rounded border px-2 py-1" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} /></label>
          {name && slugName(name) !== name && <p style={{ color: 'var(--muted)' }}>Folder name will be “{slugName(name)}”.</p>}
          <pre className="overflow-x-auto rounded-lg border p-3 font-mono" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} data-testid="new-command">{command}</pre>
          <p style={{ color: 'var(--muted)' }}>Run this in your terminal, put your brief in the new folder’s BRIEF.md, then set up the {RUNNERS.find((r) => r.id === runner)?.label} runner from its <code>runners/</code> folder. The dashboard never creates repos for you.</p>
        </section>
      )}
      <div className="flex gap-3">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="rounded border px-3 py-1.5 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Back</button>
        {step < STEPS.length - 1 && <button type="button" onClick={() => setStep(step + 1)} className="rounded px-3 py-1.5 font-medium" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Next</button>}
      </div>
    </div>
  );
}
