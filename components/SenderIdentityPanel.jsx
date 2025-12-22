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
      
      console.log('🔍 Loading sender status...');
      
      // Use find-or-create endpoint
      const response = await api.post('/api/outreach/verified-senders/find-or-create');
      
      console.log('📦 Find-or-create response:', response.data);
      
      if (response.data?.success) {
        const { action, sender, senders } = response.data;
        
        console.log(`✅ Action: ${action}`, { sender, sendersCount: senders?.length });
        
        if (action === 'found' && sender) {
          // Owner has a verified sender
          console.log('✅ Found existing sender:', sender);
          setSenderEmail(sender.email);
          setSenderName(sender.name);
          setVerified(sender.verified || false);
          setAvailableSenders([]);
          setShowSenderList(false);
        } else if (action === 'select' && senders && senders.length > 0) {
          // Found verified senders in SendGrid - show selection
          console.log(`✅ Found ${senders.length} verified senders in SendGrid`);
          setAvailableSenders(senders);
          setSenderEmail(null);
          setSenderName(null);
          setVerified(false);
          setShowSenderList(false); // Don't auto-show list, show button first
        } else if (action === 'create') {
          // No verified senders found - show create form
          console.log('⚠️ No verified senders found - showing create form');
          setAvailableSenders([]);
          setSenderEmail(null);
          setSenderName(null);
          setVerified(false);
          setShowSenderList(false);
          setShowForm(false); // Show initial prompt, not form yet
        }
      } else {
        console.error('❌ Response not successful:', response.data);
        setError(response.data?.error || 'Failed to load sender status');
        // Fallback: try to load available senders directly
        await loadAvailableSenders();
      }
    } catch (err) {
      console.error('❌ Failed to load sender status:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load sender status');
      // Fallback: try to load available senders directly
      await loadAvailableSenders();
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSenders = async () => {
    try {
      setLoadingSenders(true);
      const response = await api.get('/api/outreach/verified-senders/list');
      console.log('SendGrid senders response:', response.data);
      
      if (response.data?.success && response.data.senders) {
        // API already filters for verified === true, but double-check client-side
        const verifiedSenders = response.data.senders.filter(sender => sender.verified === true);
        console.log(`✅ Found ${verifiedSenders.length} verified senders`);
        setAvailableSenders(verifiedSenders);
      } else {
        console.log('No verified senders in response');
        setAvailableSenders([]);
      }
    } catch (err) {
      console.error('Failed to load available senders:', err);
      console.error('Error details:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to load senders from SendGrid');
      setAvailableSenders([]);
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleSelectSender = async (sender) => {
    try {
      setSelectingSender(true);
      setError(null);
      
      const senderEmail = sender.email || sender.from?.email;
      const senderName = sender.name || sender.from?.name;
      
      // NO SendGrid API call - just save to Owner model
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
      setError(err.response?.data?.error || 'Failed to save sender selection');
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

  // Refresh senders from SendGrid
  const handleRefreshSenders = async () => {
    await loadAvailableSenders();
    await loadSenderStatus();
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
                      onClick={handleRefreshSenders}
                      disabled={loadingSenders}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loadingSenders ? (
                        <>
                          <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="inline h-4 w-4 mr-1" />
                          Refresh
                        </>
                      )}
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
                    {availableSenders.length > 0 ? (
                      availableSenders.map((sender, idx) => {
                        // Handle both API response structure (from.name, from.email) and mapped structure (name, email)
                        const email = sender.email || sender.from?.email;
                        const name = sender.name || sender.from?.name || email;
                        const senderId = sender.id;
                        return (
                          <button
                            key={senderId || idx}
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
                      })
                    ) : (
                      <div className="text-center py-4 text-sm text-gray-500">
                        No verified senders found. Please verify a new email in SendGrid.
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowSenderList(false)}
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRefreshSenders}
                      disabled={loadingSenders}
                      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                    >
                      {loadingSenders ? (
                        <>
                          <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="inline h-3 w-3 mr-1" />
                          Refresh
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // No verified senders available - show instructions
            <div className="space-y-3">
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs font-medium text-blue-900 mb-2">
                  How to verify a new sender email
                </p>
                <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Go to SendGrid Dashboard → Settings → Sender Authentication</li>
                  <li>Add and verify your business email address</li>
                  <li>Return here and click "Refresh Verified Senders"</li>
                </ol>
                <p className="text-xs text-blue-600 mt-2">
                  Note: Sender verification must be done in SendGrid. This cannot be automated via API.
                </p>
              </div>
              
              <button
                onClick={handleRefreshSenders}
                disabled={loadingSenders}
                className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingSenders ? (
                  <>
                    <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="inline h-4 w-4 mr-2" />
                    Refresh Verified Senders
                  </>
                )}
              </button>
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

