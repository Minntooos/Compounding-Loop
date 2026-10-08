import { Command } from 'cmdk';
import { useEffect, useState } from 'react';

export interface PaletteItem { label: string; run: () => void }

// Ctrl/⌘K opens it; cmdk handles arrow keys, filtering and Escape.
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette"
      className="fixed left-1/2 top-24 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border p-2 shadow-xl"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <Command.Input placeholder="Go to…" className="w-full rounded px-3 py-2 outline-none" style={{ background: 'var(--bg)' }} />
      <Command.List className="mt-2 max-h-72 overflow-auto">
        <Command.Empty className="px-3 py-2" style={{ color: 'var(--muted)' }}>No match</Command.Empty>
        {items.map((it) => (
          <Command.Item key={it.label} value={it.label} onSelect={() => { setOpen(false); it.run(); }} className="cursor-pointer rounded px-3 py-2 data-[selected=true]:bg-[var(--border)]">{it.label}</Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
