'use client';

import { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Clock, Loader2, RefreshCw, AlertCircle, List } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

/**
 * SenderIdentityPanel Component
 * 
 * Manages SendGrid sender identity verification
 * - First checks SendGrid for existing verified senders
 * - Allows selecting from already-verified senders
 * - Allows starting verification for new sender
 * - Checks verification status
 * - Only updates Owner after SendGrid confirms verification
 */
export default function SenderIdentityPanel() {
  const { ownerId } = useOwner();
  const [senderEmail, setSenderEmail] = useState(null);
  const [senderName, setSenderName] = useState(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // Available senders from SendGrid
  const [availableSenders, setAvailableSenders] = useState([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [showSenderList, setShowSenderList] = useState(false);
  const [selectingSender, setSelectingSender] = useState(false);
  
  // Form state for new sender
  const [showForm, setShowForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [startingVerification, setStartingVerification] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [error, setError] = useState(null);

  // Load current sender status
  useEffect(() => {
    if (ownerId) {
      loadSenderStatus();
    }
  }, [ownerId]);

  const loadSenderStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/outreach/verified-senders');
      if (response.data?.success) {
        const email = response.data.verifiedEmail;
        const name = response.data.verifiedName;
        
        if (email) {
          setSenderEmail(email);
          setSenderName(name);
          // Check if it's actually verified in SendGrid
          await checkVerificationStatus(email);
        } else {
          setSenderEmail(null);
          setSenderName(null);
          setVerified(false);
          // If no sender configured, check SendGrid for available verified senders
          await loadAvailableSenders();
        }
      } else {
        // If no sender configured, check SendGrid for available verified senders
        await loadAvailableSenders();
      }
    } catch (err) {
      console.error('Failed to load sender status:', err);
      setError('Failed to load sender status');
      // Still try to load available senders
      await loadAvailableSenders();
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSenders = async () => {
    try {
      setLoadingSenders(true);
      const response = await api.get('/api/outreach/verified-senders/list');
      if (response.data?.success && response.data.senders) {
        // Filter to only verified senders
        const verified = response.data.senders.filter(sender => {
          const isVerified = sender.verified?.status === 'verified' || 
                           sender.verified === true ||
                           sender.verification?.status === 'verified';
          return isVerified;
        });
        setAvailableSenders(verified);
      }
    } catch (err) {
      console.error('Failed to load available senders:', err);
      // Don't set error here - it's okay if this fails
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleSelectSender = async (sender) => {
    try {
      setSelectingSender(true);
      setError(null);
      
      const senderEmail = sender.from?.email || sender.email;
      const senderName = sender.from?.name || sender.name;
      
      // Update Owner with selected sender
      const response = await api.put('/api/outreach/verified-senders', {
        email: senderEmail,
        name: senderName,
      });
      
      if (response.data?.success) {
        setSenderEmail(senderEmail);
        setSenderName(senderName);
        setVerified(true);
        setShowSenderList(false);
      }
    } catch (err) {
      console.error('Failed to select sender:', err);
      setError(err.response?.data?.error || 'Failed to select sender');
    } finally {
      setSelectingSender(false);
    }
  };

  const checkVerificationStatus = async (email) => {
    try {
      setCheckingStatus(true);
      const response = await api.get(`/api/email/sender/status?email=${encodeURIComponent(email)}`);
      
      if (response.data?.success) {
        setVerified(response.data.verified || false);
        
        // If now verified, update local state
        if (response.data.verified && response.data.sender) {
          setSenderEmail(response.data.sender.from?.email || response.data.sender.email);
          setSenderName(response.data.sender.from?.name || response.data.sender.name);
        }
      }
    } catch (err) {
      console.error('Failed to check verification status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleStartVerification = async () => {
    if (!newEmail) {
      setError('Email is required');
      return;
    }

    try {
      setStartingVerification(true);
      setError(null);
      
      const response = await api.post('/api/email/sender/start', {
        email: newEmail,
        name: newName || undefined,
      });

      if (response.data?.success) {
        setVerificationStarted(true);
        setSenderEmail(newEmail);
        setSenderName(newName);
        setVerified(false);
        setShowForm(false);
        setNewEmail('');
        setNewName('');
      }
    } catch (err) {
      console.error('Failed to start verification:', err);
      setError(err.response?.data?.error || 'Failed to start verification');
    } finally {
      setStartingVerification(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Sender Identity</h3>
      
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {!senderEmail ? (
        // No sender configured - check for available senders first
        <div>
          {loadingSenders ? (
            <div className="text-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Checking for verified senders...</p>
            </div>
          ) : availableSenders.length > 0 ? (
            // Show available verified senders to select from
            <div>
              {!showSenderList ? (
                <div className="text-center py-4">
                  <List className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">Select a verified sender</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Found {availableSenders.length} verified sender{availableSenders.length !== 1 ? 's' : ''} in SendGrid
                  </p>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      onClick={() => setShowSenderList(true)}
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      Select Sender
                    </button>
                    <button
                      onClick={() => setShowForm(true)}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Verify New Email
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs font-medium text-blue-900 mb-1">
                      Select from verified senders</p>
                    <p className="text-xs text-blue-700">
                      These emails are already verified in SendGrid. Select one to use.
                    </p>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableSenders.map((sender, idx) => {
                      const email = sender.from?.email || sender.email;
                      const name = sender.from?.name || sender.name || email;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectSender(sender)}
                          disabled={selectingSender}
                          className="w-full text-left rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 hover:border-red-300 transition disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{name}</p>
                              <p className="text-xs text-gray-500">{email}</p>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowSenderList(false);
                        setShowForm(true);
                      }}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Verify New Email Instead
                    </button>
                    <button
                      onClick={() => setShowSenderList(false)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : !showForm ? (
            // No verified senders available - show form to start verification
            <div className="text-center py-4">
              <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 mb-1">Add a verified sender email with SendGrid</p>
              <p className="text-xs text-gray-500 mb-4">Verify your business email to start sending</p>
              <button
                onClick={() => setShowForm(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Verify Sender Email
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-medium text-blue-900 mb-1">
                  Use Your Business Email</p>
                <p className="text-xs text-blue-700">
                  Do NOT use your Gmail sign-in email. Use your business email address (e.g., adam@ignitestrategies.co).
                </p>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="your-email@yourdomain.com"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartVerification}
                  disabled={startingVerification || !newEmail}
                  className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {startingVerification ? (
                    <>
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Send Verification Email'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setNewEmail('');
                    setNewName('');
                    setError(null);
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : verified ? (
        // Verified sender
        <div className="rounded-md bg-green-50 border border-green-200 p-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                {senderName || senderEmail}
              </p>
              <p className="text-xs text-green-700 mt-1">{senderEmail}</p>
              <p className="text-xs text-green-600 mt-2">✅ Verified and ready to send</p>
            </div>
          </div>
        </div>
      ) : (
        // Pending verification
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900">
                {senderName || senderEmail}
              </p>
              <p className="text-xs text-yellow-700 mt-1">{senderEmail}</p>
              <p className="text-xs text-yellow-600 mt-2">
                Verification email sent. Check your inbox and click the verification link.
              </p>
              <button
                onClick={() => checkVerificationStatus(senderEmail)}
                disabled={checkingStatus}
                className="mt-3 flex items-center gap-2 rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-yellow-700 disabled:opacity-50"
              >
                {checkingStatus ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3" />
                    Refresh Status
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

