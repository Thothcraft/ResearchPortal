"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  unread?: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<{ text: string; sender: string }[]>(
    []
  );
  const [username, setUsername] = useState<string>("");
  const router = useRouter();
  const [currentChatId, setCurrentChatId] = useState<string>("default-chat");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string>("");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    let uname = "";
    let tokenVal = token || "";
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        uname = user.username || "";
        if (!tokenVal && user.token) {
          tokenVal = user.token;
        }
      } catch {
        uname = "";
      }
    }

    setUsername(uname);
    setAuthToken(tokenVal);
    setMessages([
      { text: `Hello, ${uname}! How can I help you?`, sender: "ai" },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!authToken) return;

    const sendHeartbeat = () => {
      fetch("https://web-production-d7d37.up.railway.app/device/heartbeat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timestamp: Date.now() }),
      }).catch(() => {});
    };

    const interval = setInterval(sendHeartbeat, 30000); // every 30 seconds
    sendHeartbeat();

    return () => clearInterval(interval);
  }, [authToken]);

  const sendMessage = async (inputText: string) => {
    if (!inputText.trim()) return;
    if (!authToken) {
      setMessages((prev) => [
        ...prev,
        { text: "Please login to continue chatting", sender: "ai" },
      ]);
      return;
    }

    const newUserMessage = { text: inputText, sender: "user" };
    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);
    setInput("");

    try {
      const response = await fetch(
        "https://web-production-d7d37.up.railway.app/query",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            query: inputText,
            chat_id: currentChatId,
            model: "gpt-3.5-turbo",
            max_tokens: 1024,
            temperature: 0.7,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          setAuthToken("");
          throw new Error("Session expired. Please login again.");
        }
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { text: data.response, sender: "ai" }]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) => [
        ...prev,
        { text: `Error: ${errorMessage}`, sender: "ai" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleRefreshChat = () => {
    setMessages([
      { text: `Hello, ${username}! How can I help you?`, sender: "ai" },
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-pink-100 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-200 via-pink-200 to-indigo-200 px-8 py-6 flex items-center justify-between shadow">
        <div>
          <div className="text-2xl font-bold text-indigo-700">AI Assistant</div>
          <div className="text-xs text-indigo-400">Online</div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-semibold shadow hover:bg-indigo-600 transition"
        >
          ← Back to Homepage
        </button>
      </div>
      {/* Messages Chat */}
      <div className="flex-1 overflow-y-auto px-6 py-8 bg-indigo-50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex mb-3 ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-4 py-2 rounded-2xl shadow text-sm max-w-[70%] break-words
              ${
                msg.sender === "user"
                  ? "bg-gradient-to-r from-blue-200 to-pink-200 text-right text-indigo-900"
                  : "bg-white text-indigo-700 border border-indigo-100"
              }
            `}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {/* Input Bar */}
      <form
        onSubmit={handleSend}
        className="bg-indigo-50 px-6 py-4 flex items-center gap-3 border-t border-indigo-100"
      >
        <input
          type="text"
          className="flex-1 rounded-xl px-4 py-2 border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-pink-200 bg-white text-indigo-900"
          placeholder="Type message here"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-400 to-indigo-400 text-white font-semibold shadow hover:from-pink-500 hover:to-indigo-500 transition"
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </form>
      <button
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
        onClick={handleRefreshChat}
        type="button"
      >
        Refresh Chat
      </button>
    </div>
  );
}
