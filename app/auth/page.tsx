'use client';

import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
<<<<<<< HEAD
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');
=======
  const [isLogin, setIsLogin] = useState(true);
>>>>>>> 366169a (Add user registration to ResearchPortal auth page)
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
<<<<<<< HEAD
  const [customError, setCustomError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
=======
  const [successMessage, setSuccessMessage] = useState('');
>>>>>>> 366169a (Add user registration to ResearchPortal auth page)
  const router = useRouter();
  const { login, register, isLoading, error, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isSubmitting) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const redirectUrl = user.role === 1 ? '/admin' : '/home';
      router.push(redirectUrl);
    }
  }, [isAuthenticated, isSubmitting, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || formData.username.length < 3) {
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      return;
    }

<<<<<<< HEAD
    // Clear previous custom error
    setCustomError(null);
    
    // Validate credentials match the selected mode
    if (loginMode === 'admin' && formData.username !== 'admin') {
      setCustomError('Invalid credentials for admin mode. Use "admin" as username.');
      return;
    }
    
    if (loginMode === 'user' && formData.username === 'admin') {
      setCustomError('Invalid credentials for user mode. Admin cannot login in user mode.');
      return;
    }

    setIsSubmitting(true);
    const success = await login(formData.username, formData.password);
    
    setIsSubmitting(false);
    
    if (success) {
      // Redirect based on user role
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const redirectUrl = user.role === 1 ? '/admin' : '/home';
      router.push(redirectUrl);
=======
    if (isLogin) {
      const success = await login(formData.username, formData.password);
      if (success) {
        router.push('/devices');
      }
    } else {
      const result = await register(formData.username, formData.password);
      if (result.success) {
        setSuccessMessage(result.message);
        // Switch to login mode after successful registration
        setTimeout(() => {
          setIsLogin(true);
          setSuccessMessage('');
        }, 2000);
      }
>>>>>>> 366169a (Add user registration to ResearchPortal auth page)
    }
  };

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to ThothCraft
          </h1>
          <p className="text-gray-500 mt-2">
            Sign in to access your research portal
          </p>
          
          {/* Role Selector */}
          <div className="mt-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Login Mode</label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setLoginMode('user')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  loginMode === 'user'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('admin')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  loginMode === 'admin'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          {(error || customError) && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {customError || (typeof error === 'string' ? error : 'An error occurred during login')}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder={loginMode === 'admin' ? 'admin' : 'gad'}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
=======
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div 
        className="w-full max-w-md transition-all duration-300 ease-in-out"
        style={{
          opacity: 0,
          transform: 'translateY(20px)',
          animation: 'fadeInUp 0.5s forwards'
        }}
      >
        <style jsx global>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
        
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome to ThothCraft
              </h1>
              <p className="text-gray-500 mt-2">
                {isLogin ? 'Sign in to access your research portal' : 'Create a new account'}
              </p>
            </div>

            {successMessage && (
              <div className="mb-6 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                {typeof error === 'string' ? error : 'An error occurred'}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    minLength={3}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                  />
>>>>>>> 366169a (Add user registration to ResearchPortal auth page)
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
<<<<<<< HEAD
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
=======
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {isLogin ? 'Signing in...' : 'Creating account...'}
                    </>
                  ) : (
                    isLogin ? 'Sign In to Your Account' : 'Create Account'
>>>>>>> 366169a (Add user registration to ResearchPortal auth page)
                  )}
                </button>
              </div>
            </div>

<<<<<<< HEAD
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
            
            {/* Debug button - remove in production */}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                window.location.reload();
              }}
              className="w-full mt-2 text-xs text-gray-500 hover:text-red-500"
            >
              Clear localStorage & Reload
            </button>
          </form>
=======
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setSuccessMessage('');
                  }}
                  className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>

          </div>
>>>>>>> 366169a (Add user registration to ResearchPortal auth page)
        </div>
      </div>
    </div>
  );
}
