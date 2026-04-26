'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeSlider() {
  const [isDark, setIsDark] = useState(false);

  // Load theme mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme-mode');
    const darkMode = saved === 'dark';
    setIsDark(darkMode);
    applyTheme(darkMode);
  }, []);

  function toggleTheme() {
    const newDark = !isDark;
    setIsDark(newDark);
    applyTheme(newDark);
    localStorage.setItem('theme-mode', newDark ? 'dark' : 'light');
  }

  function applyTheme(dark: boolean) {
    const root = document.documentElement.style;

    if (dark) {
      // Dark theme colors
      root.setProperty('--bg-primary', '#1e1e1e');
      root.setProperty('--bg-secondary', '#181818');
      root.setProperty('--bg-card', '#262626');
      root.setProperty('--bg-accent', '#2a2a2a');
      root.setProperty('--text-primary', '#f0f0f0');
      root.setProperty('--text-secondary', '#b0b0b0');
      root.setProperty('--text-muted', '#8a8a8a');
      root.setProperty('--accent', '#6b7f4a');
      root.setProperty('--accent-hover', '#7d9456');
      root.setProperty('--border-color', 'rgba(255,255,255,0.1)');
      root.setProperty('--shadow-light', 'rgba(0,0,0,0.3)');
      root.setProperty('--shadow-medium', 'rgba(0,0,0,0.5)');
    } else {
      // Light theme colors
      root.setProperty('--bg-primary', '#f2f0ed');
      root.setProperty('--bg-secondary', '#e8e6e3');
      root.setProperty('--bg-card', '#ffffff');
      root.setProperty('--bg-accent', '#b8c4a0');
      root.setProperty('--text-primary', '#1e1e1e');
      root.setProperty('--text-secondary', '#5a5a5a');
      root.setProperty('--text-muted', '#8a8a84');
      root.setProperty('--accent', '#6b7f4a');
      root.setProperty('--accent-hover', '#7d9456');
      root.setProperty('--border-color', 'rgba(0,0,0,0.06)');
      root.setProperty('--shadow-light', 'rgba(0,0,0,0.05)');
      root.setProperty('--shadow-medium', 'rgba(0,0,0,0.1)');
    }
  }

  return (
    <button className="theme-toggle-button" onClick={toggleTheme} title="Toggle theme">
      <span className="theme-icon">{isDark ? '☀️' : '🌙'}</span>
      <style jsx>{`
        .theme-toggle-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--bg-card, #ffffff);
          border: 2px solid var(--border-color, rgba(0,0,0,0.06));
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .theme-toggle-button:hover {
          transform: scale(1.1);
          background: var(--bg-accent, #b8c4a0);
        }

        .theme-icon {
          font-size: 18px;
          transition: transform 0.3s ease;
        }

        .theme-toggle-button:hover .theme-icon {
          transform: rotate(180deg);
        }
      `}</style>
    </button>
  );
}
