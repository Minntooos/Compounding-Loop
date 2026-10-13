import { Check, Copy, X } from 'lucide-react';
import { useState } from 'react';

export const INSTALL_COMMAND = 'npx compounding-loop dashboard';
const DISMISS_KEY = 'welcome-dismissed';
const REPO_URL = 'https://github.com/Minntooos/Compounding-Loop';

function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; /* storage blocked: show it */ }
}

/** Copies with the Clipboard API; without it (insecure context, old browser) selects the text so Ctrl+C works. */
export async function copyText(text: string, fallbackEl: HTMLElement | null): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  if (fallbackEl) {
    const range = document.createRange();
    range.selectNodeContents(fallbackEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return false;
}

/** First-visit strip for the hosted demo. Never rendered when a local dashboard server is running (App decides). */
export function WelcomeStrip() {
  const [hidden, setHidden] = useState(wasDismissed);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState('');
  if (hidden) return null;
  const copy = async () => {
    const el = document.getElementById('install-command');
    if (await copyText(INSTALL_COMMAND, el)) { setHint(''); setCopied(true); window.setTimeout(() => setCopied(false), 1_500); } else setHint('Selected: press Ctrl+C to copy.');
  };
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked: hidden for this visit only */ }
  };
  return (
    <section aria-label="About this dashboard" className="relative mb-6 rounded-lg border p-4 pr-12 md:p-5 md:pr-14" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="max-w-3xl text-[15px] leading-relaxed">
        Compounding Loop runs Claude Code build loops unattended and checks every result; this page shows the repo that built it and five sites it built.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border py-1 pl-3 pr-1" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <code id="install-command" className="font-mono text-[13px]">{INSTALL_COMMAND}</code>
          <button type="button" onClick={() => void copy()} className="flex min-h-11 items-center gap-1.5 rounded px-3 text-[13px] md:min-h-8">
            {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span role="status" className="text-[12px]" style={{ color: 'var(--muted)' }}>{hint}</span>
        <a href={REPO_URL} className="text-[13px] underline underline-offset-2" style={{ color: 'var(--accent)' }}>View on GitHub</a>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss this introduction" className="absolute right-1 top-1 flex size-11 items-center justify-center rounded">
        <X aria-hidden size={16} />
      </button>
    </section>
  );
}
