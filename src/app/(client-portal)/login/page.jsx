'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, signInWithEmail, auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function ClientPortalLoginPage() {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authMethod, setAuthMethod] = useState('google');
  const [emailData, setEmailData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;

    setIsSigningIn(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      
      // Get ID token for API calls
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        localStorage.setItem('firebaseToken', idToken);
        localStorage.setItem('firebaseId', result.uid);
      }

      // Check if user has client portal access (has proposals)
      // For now, just redirect to welcome
      router.push('/client-portal/welcome');
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setError('Sign-in failed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailSignIn = async (event) => {
    event.preventDefault();
    if (isSigningIn) return;

    setIsSigningIn(true);
    setError('');

    try {
      const result = await signInWithEmail(emailData.email, emailData.password);
      
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        localStorage.setItem('firebaseToken', idToken);
        localStorage.setItem('firebaseId', result.uid);
      }

      router.push('/client-portal/welcome');
    } catch (error) {
      console.error('Email sign-in failed:', error);
      setError('Sign-in failed. Please check your credentials.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Image
              src="/logo.png"
              alt="Ignite Strategies"
              width={64}
              height={64}
              className="mx-auto mb-4 h-16 w-16 object-contain"
              priority
            />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Client Portal Login
            </h1>
            <p className="text-gray-600">
              Sign in to view your proposals and engagement details
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-white border-2 border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {isSigningIn ? 'Signing in...' : 'Continue with Google'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            {/* Email Sign In */}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={emailData.email}
                  onChange={(e) =>
                    setEmailData({ ...emailData, email: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="your@email.com"
                  disabled={isSigningIn}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={emailData.password}
                  onChange={(e) =>
                    setEmailData({ ...emailData, password: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                  placeholder="••••••••"
                  disabled={isSigningIn}
                />
              </div>
              <button
                type="submit"
                disabled={isSigningIn}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSigningIn ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            Need access? Contact your Ignite Strategies representative.
          </p>
        </div>
      </div>
    </div>
  );
}

