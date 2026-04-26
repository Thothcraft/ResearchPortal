'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';

export default function ThemeCat() {
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your ThothCraft AI assistant. How can I help you today?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const { post } = useApi();

  function toggleChat() {
    setShowChat(!showChat);
  }

  async function sendMessage() {
    if (!chatInput.trim() || isLoading) return;

    setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
    const userMessage = chatInput;
    setChatInput('');
    setIsLoading(true);

    try {
      const response = await post('/query', {
        query: userMessage,
        context: {},
      });

      if (response?.success && response.response) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response.response }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.'
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        if (chatMessagesRef.current) {
          chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
      }, 100);
    }
  }

  return (
    <>
      {/* Chat Cat Button (no theme slider) */}
      <div className="chat-cat-container">
        <button
          className="chat-cat-button"
          onClick={toggleChat}
          title="Click to chat"
        >
          <span className="cat-icon">🐱</span>
        </button>
      </div>

      {/* Chat Side Panel */}
      {showChat && (
        <div className="chat-side-panel">
          <div className="chat-side-header">
            <h3>🐱 ThothCraft AI Assistant</h3>
            <button className="close-button" onClick={toggleChat}>×</button>
          </div>
          <div className="chat-messages" ref={chatMessagesRef}>
            {chatMessages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">Thinking...</div>
              </div>
            )}
          </div>
          <div className="chat-input">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type your message..."
              rows={2}
            />
            <button onClick={sendMessage} disabled={!chatInput.trim() || isLoading}>Send</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .chat-cat-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
        }

        .chat-cat-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--bg-card, #ffffff);
          border: 2px solid var(--border-color, rgba(0,0,0,0.06));
          box-shadow: 0 4px 20px var(--shadow-medium, rgba(0,0,0,0.08));
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .chat-cat-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 24px var(--shadow-medium, rgba(0,0,0,0.08));
        }

        .cat-icon {
          font-size: 28px;
          transition: transform 0.3s ease;
        }

        .chat-cat-button:hover .cat-icon {
          transform: scale(1.2);
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
