'use client';

import { useEffect, useMemo, useRef } from 'react';

export type CaptureTimelineItem = {
  id: string;
  state?: 'current' | 'occupied' | 'empty' | 'missing' | 'collecting';
  disabled?: boolean;
  label?: string;
};

type Props = {
  items: CaptureTimelineItem[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onOpen?: (id: string) => void;
};

function dotColor(state?: CaptureTimelineItem['state']) {
  if (state === 'current' || state === 'collecting') return '#2563eb';
  if (state === 'occupied') return '#168653';
  if (state === 'empty') return '#d3463b';
  return '#9b978f';
}

export default function CaptureRangeTimeline({ items, selected, onSelectionChange, onOpen }: Props) {
  const ordered = useMemo(() => items.map((item) => item.id), [items]);
  const anchor = useRef<number | null>(null);
  const drag = useRef<{ anchor: number; base: Set<string> } | null>(null);

  useEffect(() => {
    const finish = () => { drag.current = null; };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  const range = (from: number, to: number, base = new Set<string>()) => {
    const next = new Set(base);
    for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1) {
      if (items[index] && !items[index].disabled) next.add(items[index].id);
    }
    onSelectionChange(next);
  };

  return (
    <div className="overflow-x-auto border border-slate-300 bg-white px-3 py-4" aria-label="Capture timeline">
      <div className="relative flex min-w-max items-start gap-4 before:absolute before:left-4 before:right-4 before:top-[7px] before:h-px before:bg-slate-300">
        {items.map((item, index) => {
          const active = selected.has(item.id);
          const adjacent = active && index > 0 && selected.has(items[index - 1].id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              aria-pressed={active}
              aria-label={`${active ? 'Deselect' : 'Select'} ${item.label || item.id}`}
              title={`${item.id} · click/drag, Shift for range, Ctrl/Cmd to toggle · double-click to view`}
              className={`relative z-[1] w-12 select-none text-center text-[10px] font-mono disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'font-bold text-slate-950' : 'text-slate-500'} ${adjacent ? 'before:absolute before:-left-4 before:top-[-3px] before:h-5 before:w-4 before:bg-cyan-100' : ''}`}
              onPointerDown={(event) => {
                if (event.button !== 0 || item.disabled) return;
                event.preventDefault();
                const additive = event.ctrlKey || event.metaKey;
                if (event.shiftKey && anchor.current != null) {
                  range(anchor.current, index, additive ? selected : new Set());
                  drag.current = { anchor: anchor.current, base: additive ? new Set(selected) : new Set() };
                } else if (additive) {
                  const next = new Set(selected);
                  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                  onSelectionChange(next);
                  anchor.current = index;
                  drag.current = { anchor: index, base: next };
                } else {
                  anchor.current = index;
                  drag.current = { anchor: index, base: new Set() };
                  range(index, index);
                }
              }}
              onPointerEnter={() => {
                if (drag.current) range(drag.current.anchor, index, drag.current.base);
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onDoubleClick={() => onOpen?.(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpen?.(item.id);
                if (event.key !== ' ') return;
                event.preventDefault();
                if (event.shiftKey && anchor.current != null) {
                  range(anchor.current, index, event.ctrlKey || event.metaKey ? selected : new Set());
                  return;
                }
                const next = new Set(selected);
                next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                anchor.current = index;
                onSelectionChange(next);
              }}
            >
              <span
                className={`relative z-[2] mx-auto mb-2 block h-3 w-3 rounded-full ring-4 ring-white ${active ? 'outline outline-2 outline-offset-2 outline-slate-950' : ''}`}
                style={{ background: dotColor(item.state) }}
              />
              <span className="block">{item.id.slice(9, 11)}:{item.id.slice(11, 13)}</span>
              <span className="mt-1 block text-[9px] text-slate-400">{item.id.slice(4, 6)}/{item.id.slice(6, 8)}</span>
            </button>
          );
        })}
        {!items.length && <div className="py-4 text-xs text-slate-500">No captured minutes yet.</div>}
      </div>
    </div>
  );
}
