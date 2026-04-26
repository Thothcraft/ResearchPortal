'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeSlider() {
  const [themePos, setThemePos] = useState(15);

  // Load theme position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('thoth-theme-pos');
    if (saved) {
      setThemePos(parseInt(saved));
      applyTheme(parseInt(saved));
    }
  }, []);

  function lerp(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
  }

  function hexFromRGB(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function applyTheme(pos: number) {
    const t = pos / 100;
    const root = document.documentElement.style;

    root.setProperty('--bg-primary', hexFromRGB(lerp(242, 30, t), lerp(240, 30, t), lerp(237, 30, t)));
    root.setProperty('--bg-secondary', hexFromRGB(lerp(232, 24, t), lerp(230, 24, t), lerp(227, 24, t)));
    root.setProperty('--bg-card', hexFromRGB(lerp(255, 38, t), lerp(255, 38, t), lerp(255, 36, t)));
    root.setProperty('--bg-accent', hexFromRGB(lerp(184, 61, t), lerp(196, 74, t), lerp(160, 42, t)));
    root.setProperty('--text-primary', hexFromRGB(lerp(30, 240, t), lerp(30, 240, t), lerp(30, 237, t)));
    root.setProperty('--text-secondary', hexFromRGB(lerp(90, 180, t), lerp(90, 180, t), lerp(86, 170, t)));
    root.setProperty('--text-muted', hexFromRGB(lerp(138, 140, t), lerp(138, 140, t), lerp(132, 130, t)));
    root.setProperty('--accent', hexFromRGB(lerp(107, 130, t), lerp(127, 160, t), lerp(74, 75, t)));
    root.setProperty('--accent-hover', hexFromRGB(lerp(125, 145, t), lerp(148, 175, t), lerp(86, 88, t)));
    root.setProperty('--border-color', `rgba(${t > 0.5 ? '255,255,255' : '0,0,0'},${lerp(6, 15, t) / 100})`);
    root.setProperty('--shadow-light', `rgba(0,0,0,${lerp(4, 20, t) / 200})`);
    root.setProperty('--shadow-medium', `rgba(0,0,0,${lerp(4, 20, t) / 100})`);
    root.setProperty('--theme-pos', String(pos));

    localStorage.setItem('thoth-theme-pos', String(pos));
  }

  function handleThemeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const pos = parseInt(e.target.value);
    setThemePos(pos);
    applyTheme(pos);
  }

  return (
    <div className="theme-slider-wrapper">
      <input
        type="range"
        min="0"
        max="100"
        value={themePos}
        className="theme-knob-input"
        onChange={handleThemeChange}
      />
      <style jsx>{`
        .theme-slider-wrapper {
          display: flex;
          align-items: center;
          padding: 8px 12px;
        }

        .theme-knob-input {
          -webkit-appearance: none;
          appearance: none;
          width: 100px;
          height: 6px;
          border-radius: 3px;
          background: linear-gradient(90deg, #e8e6e3, #b8c4a0, #5a6b3a, #1e1e1e);
          outline: none;
          cursor: pointer;
        }

        .theme-knob-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent, #6b7f4a);
          border: 2px solid var(--bg-card, #ffffff);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .theme-knob-input::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent, #6b7f4a);
          border: 2px solid var(--bg-card, #ffffff);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
