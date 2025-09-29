"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  // State hooks for form fields and UI state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const router = useRouter();

  // Handles the registration form submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validate phone number: must be 11 digits and numeric
    if (!/^\d{11}$/.test(phone)) {
      setError("Phone number must be exactly 11 digits.");
      setIsLoading(false);
      return;
    }

    // Check if both terms are agreed
    if (!agreedTerms || !agreedPrivacy) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      setIsLoading(false);
      return;
    }

    try {
      // Send registration request to backend
      const res = await fetch(
        "https://web-production-d7d37.up.railway.app/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, phone_number: phone }),
        }
      );

      // Handle error response from backend
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to register user");
        setIsLoading(false);
        return;
      }

      // On success, redirect to login page
      router.push("/auth/login");
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-400 via-indigo-300 to-pink-400">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl px-10 py-12 flex flex-col items-center">
        {/* Title */}
        <h1 className="text-3xl font-extrabold text-indigo-800 mb-8">
          Sign Up
        </h1>
        {/* Registration Form */}
        <form onSubmit={handleRegister} className="w-full space-y-6">
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
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
          </div>
          {/* Password Field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-indigo-700 mb-2"
            >
              Password
            </label>
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
                placeholder="Create a password"
                autoComplete="new-password"
              />
            </div>
          </div>
          {/* Phone Number Field */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-indigo-700 mb-2"
            >
              Phone Number
            </label>
            <input
              type="text"
              id="phone"
              className="w-full px-4 py-3 text-base border-b border-indigo-200 focus:border-pink-400 focus:outline-none bg-transparent placeholder-indigo-300 transition"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/, ""))}
              required
              placeholder="11-digit phone number"
              maxLength={11}
              pattern="\d{11}"
              inputMode="numeric"
            />
          </div>
          {/* Terms and Privacy Checkbox */}
          <div className="flex items-center mb-2">
            <input
              id="terms-privacy"
              type="checkbox"
              checked={agreedTerms && agreedPrivacy}
              onChange={(e) => {
                setAgreedTerms(e.target.checked);
                setAgreedPrivacy(e.target.checked);
              }}
              className="h-4 w-4 text-pink-500 border-gray-300 rounded focus:ring-pink-400"
            />
            <label
              htmlFor="terms-privacy"
              className="ml-2 block text-sm text-gray-600"
            >
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-500 underline hover:text-pink-600"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-500 underline hover:text-pink-600"
              >
                Privacy Policy
              </a>
            </label>
          </div>
          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !agreedTerms || !agreedPrivacy}
            className="w-full py-3 mt-2 rounded-full font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        {/* Link to Login */}
        <div className="mt-8 text-indigo-400 text-sm text-center w-full">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-pink-500 font-bold hover:underline"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
