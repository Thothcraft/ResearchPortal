'use client';

import { useState, useRef, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Trash2,
  Monitor,
  Database,
  Brain,
} from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type SystemStats = {
  devices: { total: number; online: number; offline: number };
  files: { total: number };
  training: { total_jobs: number; active_jobs: number; completed_jobs: number };
  models: { total: number; best_accuracy: number | null };
};

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your ThothCraft AI assistant. I can help you with questions about your devices, data analysis, training models, and more. Ask me things like "How many devices are online?" or "What\'s my best model accuracy?"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { post, get } = useApi();

  // Fetch system stats for context
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await get('/activity/stats');
        if (response?.success && response.stats) {
          setStats(response.stats);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context with current system stats
      const context: Record<string, any> = {};
      
      if (stats) {
        context.system_stats = {
          devices: {
            total: stats.devices.total,
            online: stats.devices.online,
            offline: stats.devices.offline,
            description: `User has ${stats.devices.total} registered devices, ${stats.devices.online} currently online`
          },
          files: {
            total: stats.files.total,
            description: `User has ${stats.files.total} data files uploaded to cloud storage`
          },
          training: {
            total_jobs: stats.training.total_jobs,
            active_jobs: stats.training.active_jobs,
            completed_jobs: stats.training.completed_jobs,
            description: `User has ${stats.training.total_jobs} training jobs (${stats.training.active_jobs} active, ${stats.training.completed_jobs} completed)`
          },
          models: {
            total: stats.models.total,
            best_accuracy: stats.models.best_accuracy,
            description: stats.models.best_accuracy 
              ? `User has ${stats.models.total} trained models, best accuracy: ${(stats.models.best_accuracy * 100).toFixed(1)}%`
              : `User has ${stats.models.total} trained models`
          }
        };
      }

      // Use the /query endpoint with context
      const response = await post('/query', { 
        query: userMessage.content,
        chat_id: chatId,
        context: context
      });
      
      // Store chat_id for conversation continuity
      if (response?.chat_id && !chatId) {
        setChatId(response.chat_id);
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response?.response || 'I apologize, but I couldn\'t process your request. Please try again.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I\'m sorry, I encountered an error processing your request. Please try again later.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setChatId(null); // Reset chat session
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Chat cleared. How can I help you?',
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-indigo-400" />
            AI Assistant
          </h1>
          <p className="text-slate-400">Chat with ThothCraft AI for help and insights</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick Stats */}
          {stats && (
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Monitor className="w-4 h-4" />
                <span>{stats.devices.online}/{stats.devices.total}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Database className="w-4 h-4" />
                <span>{stats.files.total}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Brain className="w-4 h-4" />
                <span>{stats.models.total}</span>
              </div>
            </div>
          )}
          <button
            onClick={clearChat}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-indigo-400" />
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700/50 text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="bg-slate-700/50 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
