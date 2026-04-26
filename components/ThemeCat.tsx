'use client';

import React, { useState, useEffect } from 'react';

export default function ThemeCat() {
  const [showChat, setShowChat] = useState(false);
  const [themePos, setThemePos] = useState(15);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your ThothCraft AI assistant. How can I help you today?' }
  ]);

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

  function toggleChat() {
    setShowChat(!showChat);
  }

  function sendMessage() {
    if (!chatInput.trim()) return;

    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    const userMessage = chatInput;
    setChatInput('');

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `I received your message: "${userMessage}". This is a demo response. Connect to the Research Portal API for real AI assistance.`
      }]);
    }, 1000);
  }

  return (
    <>
      {/* Theme Slider in Top Bar - this component will be placed in the layout header */}
      <div className="theme-slider-top">
        <span className="theme-label">Theme</span>
        <input
          type="range"
          min="0"
          max="100"
          value={themePos}
          className="theme-knob-input"
          onChange={handleThemeChange}
        />
        <button
          onClick={toggleChat}
          className="chat-btn"
          title="Open AI Assistant"
        >
          💬
        </button>
      </div>

      {/* Chat Side Panel */}
      {showChat && (
        <div className="chat-side-panel">
          <div className="chat-side-header">
            <h3>🐱 ThothCraft AI Assistant</h3>
            <button className="close-button" onClick={toggleChat}>×</button>
          </div>
          <div className="chat-messages">
            {chatMessages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Type your message..."
              rows={2}
            />
            <button onClick={sendMessage} disabled={!chatInput.trim()}>Send</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .theme-slider-top {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 16px;
        }

        .theme-label {
          font-size: 12px;
          color: var(--text-muted, #8a8a84);
          font-weight: 500;
        }

        .chat-btn {
          margin-left: 8px;
          padding: 8px 12px;
          background: var(--accent, #6b7f4a);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
        }

        .chat-btn:hover {
          background: var(--accent-hover, #7d9456);
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
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent, #6b7f4a);
          border: 2px solid var(--bg-card, #ffffff);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .theme-knob-input::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--accent, #6b7f4a);
          border: 2px solid var(--bg-card, #ffffff);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
        }

        .chat-side-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 400px;
          height: 100vh;
          background: var(--bg-card, #ffffff);
          border-left: 1px solid var(--border-color, rgba(0,0,0,0.06));
          box-shadow: -4px 0 24px var(--shadow-medium, rgba(0,0,0,0.08));
          display: flex;
          flex-direction: column;
          z-index: 10000;
          animation: slideInRight 0.3s ease;
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .chat-side-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.06));
        }

        .chat-side-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #1e1e1e);
        }

        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          color: var(--text-muted, #8a8a84);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .close-button:hover {
          background: var(--bg-secondary, #e8e6e3);
          color: var(--text-primary, #1e1e1e);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 16px;
          animation: messageSlide 0.2s ease;
        }

        @keyframes messageSlide {
          from {
            transform: translateY(10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .message.user {
          align-self: flex-end;
          background: var(--accent, #6b7f4a);
          color: white;
        }

        .message.assistant {
          align-self: flex-start;
          background: var(--bg-secondary, #e8e6e3);
          color: var(--text-primary, #1e1e1e);
          border: 1px solid var(--border-color, rgba(0,0,0,0.06));
        }

        .message-content {
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .chat-input {
          padding: 16px 20px;
          border-top: 1px solid var(--border-color, rgba(0,0,0,0.06));
          display: flex;
          gap: 12px;
        }

        .chat-input textarea {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid var(--border-color, rgba(0,0,0,0.06));
          border-radius: 12px;
          background: var(--bg-secondary, #e8e6e3);
          color: var(--text-primary, #1e1e1e);
          font-size: 14px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .chat-input textarea:focus {
          border-color: var(--accent, #6b7f4a);
        }

        .chat-input button {
          padding: 10px 20px;
          background: var(--accent, #6b7f4a);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .chat-input button:hover:not(:disabled) {
          background: var(--accent-hover, #7d9456);
          transform: translateY(-1px);
        }

        .chat-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
