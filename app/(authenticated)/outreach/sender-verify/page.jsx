'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, Loader2, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

export default function SenderVerifyPage() {
  const router = useRouter();
  const { ownerId } = useOwner();
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [verified, setVerified] = useState(false);
  const [currentSender, setCurrentSender] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState(null);

  // Load current sender from DB
  useEffect(() => {
    if (ownerId) {
      loadCurrentSender();
    }
  }, [ownerId]);

  const loadCurrentSender = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/outreach/verified-senders');
      
      if (response.data?.success) {
        const email = response.data.verifiedEmail;
        const name = response.data.verifiedName;
        
        if (email) {
          setCurrentSender({ email, name });
          setEmail(email);
          setName(name || '');
        }
      }
    } catch (err) {
      console.error('Failed to load current sender:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }

    try {
      setSending(true);
      setError(null);
      setSuccess(false);
      
      // Send verification email via SendGrid
      const response = await api.post('/api/owner/sender/verify', {
        email,
        name: name || undefined,
      });

      if (response.data?.success) {
        setSuccess(true);
        setPendingEmail(email); // Store email to check later
        setVerified(false); // Reset verified status
      } else {
        setError(response.data?.error || 'Failed to send verification email');
      }
    } catch (err) {
      console.error('Failed to verify sender:', err);
      setError(err.response?.data?.error || err.message || 'Failed to send verification email');
    } finally {
      setSending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!pendingEmail && !email) {
      setError('No email to check');
      return;
    }

    const emailToCheck = pendingEmail || email;
    
    try {
      setChecking(true);
      setError(null);
      
      // Check SendGrid API to see if sender is verified
      // This route will also update DB if verified
      const response = await api.get(`/api/email/sender/status?email=${encodeURIComponent(emailToCheck)}`);
      
      if (response.data?.success) {
        if (response.data.verified) {
          setVerified(true);
          setSuccess(false); // Clear the "email sent" message
          // Reload current sender to show updated status
          await loadCurrentSender();
        } else {
          setError('Sender is not yet verified. Please check your email and click the verification link.');
        }
      } else {
        setError(response.data?.error || 'Failed to check verification status');
      }
    } catch (err) {
      console.error('Failed to check status:', err);
      setError(err.response?.data?.error || err.message || 'Failed to check verification status');
    } finally {
      setChecking(false);
    }
  };

  const handleAssignVerified = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }

    try {
      setSending(true);
      setError(null);
      
      // Assign verified sender to owner in DB
      const response = await api.post('/api/owner/sender/assign', {
        email,
        name: name || undefined,
      });

      if (response.data?.success) {
        setVerified(true);
        await loadCurrentSender();
        // Redirect back after a moment
        setTimeout(() => {
          router.push('/outreach/compose');
        }, 1500);
      } else {
        setError(response.data?.error || 'Failed to assign sender');
      }
    } catch (err) {
      console.error('Failed to assign sender:', err);
      setError(err.response?.data?.error || err.message || 'Failed to assign sender');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Verify Sender Email" />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="Verify Sender Email" />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              SendGrid Sender Verification
            </h2>
            <p className="text-sm text-gray-600">
              Verify your email address with SendGrid to send outreach emails. You'll receive a verification email that you need to click to complete the process.
            </p>
          </div>

          {currentSender && (
            <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Current Verified Sender</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {currentSender.name || currentSender.email}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">{currentSender.email}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && !verified && (
            <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Verification Email Sent!</p>
                  <p className="text-sm text-blue-700 mt-1">
                    We've sent a verification email to <strong>{email}</strong>. Please check your inbox and click the verification link.
                  </p>
                  <p className="text-xs text-blue-600 mt-2 mb-3">
                    After clicking the link in your email, come back here and click the button below to check if verification is complete.
                  </p>
                  <button
                    onClick={handleCheckStatus}
                    disabled={checking}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    {checking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Check Verification Status
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {verified && (
            <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Sender Verified!</p>
                  <p className="text-sm text-green-700 mt-1">
                    <strong>{email}</strong> has been verified in SendGrid.
                  </p>
                  <p className="text-xs text-green-600 mt-2 mb-3">
                    Click below to assign this verified sender to your account.
                  </p>
                  <button
                    onClick={handleAssignVerified}
                    disabled={sending}
                    className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Assign to My Account
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!verified && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setSuccess(false);
                    setVerified(false);
                    setPendingEmail(null);
                  }}
                  placeholder="your-email@yourdomain.com"
                  required
                  disabled={success && !verified}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This email will receive the verification link from SendGrid
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name or Company Name"
                  disabled={success && !verified}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This name will appear as the sender name in your emails
                </p>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={sending || !email || (success && !verified)}
                  className="flex items-center gap-2 rounded-md bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Send Verification Email
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">What happens next?</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">1.</span>
                <span>Click "Send Verification Email" above</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">2.</span>
                <span>Check your inbox for an email from SendGrid</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">3.</span>
                <span>Click the verification link in the email</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-gray-900">4.</span>
                <span>Return here and assign the verified sender to your account</span>
              </li>
            </ol>
          </div>

          <div className="mt-6 rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900">Need help?</p>
                <p className="text-xs text-yellow-700 mt-1">
                  You can also verify senders directly in the{' '}
                  <a
                    href="https://app.sendgrid.com/settings/sender_auth"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-900 inline-flex items-center gap-1"
                  >
                    SendGrid Dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

