'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'researcher'
  });
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Basic validation
    if (!formData.username || formData.username.length < 3) {
      alert('Username must be at least 3 characters');
      setLoading(false);
      return;
    }
    
    if (!formData.password || formData.password.length < 6) {
      alert('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      // Call backend authentication
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://web-production-d7d37.up.railway.app'}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store auth info from backend response
        localStorage.setItem('auth_token', data.access_token || 'demo-token-' + Date.now());
        localStorage.setItem('user_role', data.role || formData.role);
        localStorage.setItem('username', formData.username);
        
        // Redirect to main app
        router.push('/devices');
      } else {
        // Handle authentication failure
        const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }));
        alert(`Login failed: ${errorData.message || 'Invalid credentials'}`);
      }
    } catch (error) {
      console.error('Auth error:', error);
      
      // Demo mode with valid test credentials
      const validTestUsers = ['student1', 'researcher1', 'admin', 'testuser'];
      const validPasswords = ['password123', 'admin123', 'test123'];
      
      if (validTestUsers.includes(formData.username) && validPasswords.includes(formData.password)) {
        alert('Backend unavailable. Using demo mode with valid test credentials.');
        
        // Store demo auth info
        localStorage.setItem('auth_token', 'demo-token-' + Date.now());
        localStorage.setItem('user_role', formData.role);
        localStorage.setItem('username', formData.username);
        
        // Redirect to main app
        router.push('/devices');
      } else {
        alert('Invalid credentials. Try: student1/password123, researcher1/password123, admin/admin123, or testuser/test123');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    // Set guest credentials
    localStorage.setItem('auth_token', 'guest-token-' + Date.now());
    localStorage.setItem('user_role', 'guest');
    localStorage.setItem('username', 'guest');
    
    // Redirect to main app
    router.push('/devices');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Thoth Research</h1>
          <p className="text-gray-300">Access your IoT research platform</p>
        </motion.div>

        {/* Auth Form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 shadow-xl"
        >
          {/* Tab Switcher */}
          <div className="flex mb-6 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLogin
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isLogin
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Role Selection (for signup) */}
            {!isLogin && (
              <div>
                <label className="block text-sm text-gray-300 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
                >
                  <option value="researcher">Researcher</option>
                  <option value="developer">Developer</option>
                  <option value="student">Student</option>
                </select>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 text-white py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <>
                  <User className="w-5 h-5" />
                  {isLogin ? 'Sign In' : 'Create Account'}
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-white/20"></div>
            <span className="px-4 text-sm text-gray-400">or</span>
            <div className="flex-1 border-t border-white/20"></div>
          </div>

          {/* Guest Access */}
          <button
            onClick={handleGuestAccess}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 px-4 rounded-lg font-medium transition-colors border border-white/20 flex items-center justify-center gap-2"
          >
            <UserCheck className="w-5 h-5" />
            Continue as Guest
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Guest access provides limited functionality. Sign up for full features.
          </p>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6"
        >
          <p className="text-sm text-gray-400">
            Need help? <a href="#" className="text-blue-400 hover:text-blue-300">Contact Support</a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
