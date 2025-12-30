'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import { confirmPasswordReset } from 'firebase/auth';
import { Loader2, CheckCircle2, XCircle, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [oobCode, setOobCode] = useState(null);

  useEffect(() => {
    // Extract oobCode from URL query params
    // Firebase password reset links have format: ?mode=resetPassword&oobCode=...
    const code = searchParams.get('oobCode');
    if (code) {
      setOobCode(code);
    } else {
      setError('Invalid or missing reset code. Please request a new password reset link.');
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmPassword) {
      setError('Please enter both password fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!oobCode) {
      setError('Invalid reset code');
      return;
    }

    setLoading(true);

    try {
      // Use Firebase Client SDK to confirm password reset
      await confirmPasswordReset(auth, oobCode, password);
      
      setSuccess(true);
      
      // Redirect to signin page after 2 seconds
      setTimeout(() => {
        router.push('/signin');
      }, 2000);
    } catch (error) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to reset password. ';
      if (error.code === 'auth/invalid-action-code') {
        errorMessage += 'The reset link has expired or is invalid. Please request a new one.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage += 'Password is too weak. Please choose a stronger password.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center space-y-8 bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
              <Lock className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">
            Reset Your Password
          </h1>
          <p className="text-white/80 text-lg">
            Enter your new password below
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-500/20 border border-green-400/30 rounded-xl">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-green-100 font-medium">
                Password reset successfully!
              </p>
              <p className="text-green-200/80 text-sm mt-2">
                Redirecting to sign in...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-500/20 border border-red-400/30 rounded-xl">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-100 text-sm text-left">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  minLength={8}
                  disabled={loading || !oobCode}
                />
                <p className="text-white/60 text-xs mt-1 text-left">
                  Must be at least 8 characters
                </p>
              </div>
              
              <div>
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                  minLength={8}
                  disabled={loading || !oobCode}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !oobCode}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-red-700 hover:to-orange-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-white/20">
          <button
            onClick={() => router.push('/signin')}
            className="text-white/80 hover:text-white transition text-sm"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

