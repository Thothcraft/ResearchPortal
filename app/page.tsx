'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      router.push('/devices');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Navigation */}
      <nav className="bg-black bg-opacity-20 backdrop-blur-sm fixed w-full z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <span className="text-white text-xl font-bold">Thothcraft Research</span>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#features" className="text-gray-300 hover:bg-indigo-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Features</a>
                <a href="#about" className="text-gray-300 hover:bg-indigo-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">About</a>
                <a href="#contact" className="text-gray-300 hover:bg-indigo-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Contact</a>
              </div>
            </div>
            <div className="flex items-center">
              <Link href="/auth/login" className="text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md text-sm font-medium mr-2">
                Sign In
              </Link>
              <Link href="/auth/signup" className="text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-md text-sm font-medium">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6">
            Advanced Research Platform for<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-300">IoT and AI Integration</span>
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-300">
            Harness the power of real-time data collection, analysis, and machine learning for your research projects.
          </p>
          <div className="mt-10 flex justify-center space-x-4">
            <Link 
              href="/auth/signup" 
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out"
            >
              Get Started
            </Link>
            <a 
              href="#features" 
              className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-100 bg-indigo-900 hover:bg-indigo-800 md:py-4 md:text-lg md:px-10 transition duration-150 ease-in-out"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16 bg-indigo-900 bg-opacity-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
              Powerful Research Tools
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-300 mx-auto">
              Everything you need to conduct cutting-edge research
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Real-time Data Collection',
                description: 'Stream and visualize data from multiple IoT devices in real-time with our intuitive dashboard.',
                icon: '📊'
              },
              {
                name: 'Advanced Analytics',
                description: 'Leverage powerful analytics tools to process and interpret your research data.',
                icon: '📈'
              },
              {
                name: 'Machine Learning Integration',
                description: 'Train and deploy machine learning models directly on your collected data.',
                icon: '🧠'
              },
              {
                name: 'Collaborative Workspace',
                description: 'Work seamlessly with your team in a shared research environment.',
                icon: '👥'
              },
              {
                name: 'Secure Data Storage',
                description: 'Your data is encrypted and securely stored in our cloud infrastructure.',
                icon: '🔒'
              },
              {
                name: 'Custom Dashboards',
                description: 'Create and customize dashboards to visualize your data exactly how you need it.',
                icon: '📊'
              },
            ].map((feature, index) => (
              <div key={index} className="bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-6 transition-transform hover:scale-105">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.name}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-indigo-700">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to start your research?</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-indigo-200">
            Join researchers and data scientists who are already using our platform.
          </p>
          <Link
            href="/auth/signup"
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 sm:w-auto"
          >
            Sign up for free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900">
        <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
          <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
            <div className="px-5 py-2">
              <a href="#" className="text-base text-gray-300 hover:text-white">About</a>
            </div>
            <div className="px-5 py-2">
              <a href="#" className="text-base text-gray-300 hover:text-white">Documentation</a>
            </div>
            <div className="px-5 py-2">
              <a href="#" className="text-base text-gray-300 hover:text-white">Support</a>
            </div>
            <div className="px-5 py-2">
              <a href="#" className="text-base text-gray-300 hover:text-white">Terms</a>
            </div>
            <div className="px-5 py-2">
              <a href="#" className="text-base text-gray-300 hover:text-white">Privacy</a>
            </div>
          </nav>
          <p className="mt-8 text-center text-base text-gray-400">
            &copy; {new Date().getFullYear()} Thothcraft Research. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
