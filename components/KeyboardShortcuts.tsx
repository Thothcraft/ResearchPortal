'use client';
import { X, Keyboard } from 'lucide-react';
import { useEffect } from 'react';

interface Shortcut {
  key: string;
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  { key: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { key: 'N', description: 'Create new dataset', category: 'Datasets' },
  { key: 'D', description: 'Go to Devices', category: 'Navigation' },
  { key: 'T', description: 'Go to Training', category: 'Navigation' },
  { key: 'H', description: 'Go to Home', category: 'Navigation' },
  { key: 'Escape', description: 'Close modal', category: 'General' },
  { key: 'Enter', description: 'Confirm action', category: 'General' },
  { key: 'Ctrl/Cmd + K', description: 'Quick search', category: 'General' },
];

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    if (isOpen) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-2xl border border-slate-700 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xl font-semibold text-white">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {categories.map(category => {
          const categoryShortcuts = shortcuts.filter(s => s.category === category);
          return (
            <div key={category} className="mb-6">
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">{category}</h4>
              <div className="space-y-2">
                {categoryShortcuts.map(shortcut => (
                  <div key={shortcut.key} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                    <span className="text-slate-300">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-slate-700 text-slate-200 text-xs font-mono rounded border border-slate-600">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
