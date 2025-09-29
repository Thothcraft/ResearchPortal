"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch(
        "https://web-production-d7d37.up.railway.app/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username, password }),
        }
      );

      if (!res.ok) {
        setError("Invalid username or password");
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      localStorage.setItem(
        "user",
        JSON.stringify({ username, token: data.access_token })
      );
      localStorage.setItem("token", data.access_token);
      router.push("/home");
    } catch (err) {
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-400 via-indigo-300 to-pink-400">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-10 py-12 flex flex-col items-center">
        <h1 className="text-3xl font-extrabold text-indigo-800 mb-8">Login</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 text-center shadow">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="w-full space-y-6">
          {/* Username Field */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-indigo-700 mb-2"
            >
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400">
                {/* User icon */}
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M16 21v-2a4 4 0 0 0-8 0v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </span>
              <input
                type="text"
                id="username"
                className="w-full pl-10 pr-4 py-3 text-base border-b border-indigo-200 focus:border-pink-400 focus:outline-none bg-transparent placeholder-indigo-300 transition"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Type your username"
                autoComplete="username"
              />
            </div>
          </div>
          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-indigo-700"
              >
                Password
              </label>
              <a href="#" className="text-indigo-400 text-xs hover:underline">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              {/* Static lock icon on the left */}
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
              {/* Eye icon for toggling password visibility on the right */}
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 focus:outline-none"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={0}
              >
                {showPassword ? (
                  // Eye icon for visible
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  // Eye-off icon for hidden
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.77 21.77 0 0 1 5.06-6.06M1 1l22 22" />
                    <path d="M9.53 9.53A3 3 0 0 0 12 15a3 3 0 0 0 2.47-5.47" />
                  </svg>
                )}
              </button>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                className="w-full pl-10 pr-10 py-3 text-base border-b border-indigo-200 focus:border-pink-400 focus:outline-none bg-transparent placeholder-indigo-300 transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Type your password"
                autoComplete="current-password"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-2 rounded-full font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Logging in..." : "LOGIN"}
          </button>
        </form>
        <div className="my-8 text-indigo-400 text-sm text-center w-full">
          Or Sign Up Using
        </div>
        <div className="flex space-x-6 mb-8">
          <a
            href="#"
            className="bg-blue-700 hover:bg-blue-800 text-white rounded-full p-3 shadow transition"
            aria-label="LinkedIn"
          >
            {/* LinkedIn icon */}
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-9h3v9zm-1.5-10.29c-.97 0-1.75-.79-1.75-1.75s.78-1.75 1.75-1.75 1.75.79 1.75 1.75-.78 1.75-1.75 1.75zm13.5 10.29h-3v-4.5c0-1.08-.02-2.47-1.5-2.47-1.5 0-1.73 1.17-1.73 2.39v4.58h-3v-9h2.89v1.23h.04c.4-.75 1.37-1.54 2.82-1.54 3.01 0 3.57 1.98 3.57 4.56v4.75z" />
            </svg>
          </a>
          <a
            href="#"
            className="bg-gray-900 hover:bg-gray-800 text-white rounded-full p-3 shadow transition"
            aria-label="GitHub"
          >
            {/* GitHub icon */}
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.809 1.304 3.495.997.108-.775.418-1.305.762-1.605-2.665-.305-5.466-1.332-5.466-5.931 0-1.31.469-2.381 1.236-3.221-.124-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.018.005 2.045.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.873.119 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.803 5.624-5.475 5.921.43.372.823 1.102.823 2.222v3.293c0 .322.218.694.825.576C20.565 21.796 24 17.297 24 12c0-6.63-5.373-12-12-12z" />
            </svg>
          </a>
          <a
            href="#"
            className="bg-pink-500 hover:bg-pink-600 text-white rounded-full p-3 shadow transition"
            aria-label="Google"
          >
            {/* Google icon */}
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.23-1.41 3.6-5.27 3.6-3.17 0-5.76-2.62-5.76-5.82s2.59-5.82 5.76-5.82c1.81 0 3.03.77 3.73 1.43l2.54-2.47C17.09 3.98 15.23 3 13.17 3 7.88 3 3.5 7.48 3.5 12.7c0 5.22 4.38 9.7 9.67 9.7 5.59 0 9.27-3.92 9.27-9.46 0-.64-.07-1.13-.17-1.64z"></path>
            </svg>
          </a>
        </div>
        <div className="text-indigo-400 text-sm text-center w-full mb-2">
          Don't have an account?
        </div>
        <Link
          href="/auth/signup"
          className="text-pink-500 font-bold hover:underline"
        >
          Create a new account
        </Link>
      </div>
    </div>
  );
}
