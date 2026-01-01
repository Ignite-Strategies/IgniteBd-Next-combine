'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Plus, ChevronDown, X } from 'lucide-react';
import api from '@/lib/api';

/**
 * SenderIdentityPanel Component
 * 
 * Shows current verified sender with option to change/select different sender
 * Handles all sender-related logic - parent components should not duplicate this
 * 
 * @param {string} ownerId - Owner ID from localStorage (required)
 * @param {Function} onSenderChange - Optional callback when sender state changes (hasSender: boolean, email: string, name: string)
 */
export default function SenderIdentityPanel({ ownerId, onSenderChange }) {
  const router = useRouter();
  const [senderEmail, setSenderEmail] = useState(null);
  const [senderName, setSenderName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [availableSenders, setAvailableSenders] = useState([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [changingSender, setChangingSender] = useState(false);
  const [error, setError] = useState(null);

  // Load sender status - ownerId needed for payload
  // Auth handled globally via axios interceptor
  useEffect(() => {
    if (!ownerId) {
      console.log('📧 Sender: Waiting for ownerId...', { ownerId });
      setSenderEmail(null);
      setSenderName(null);
      setLoading(false);
      setError(null);
      if (onSenderChange) {
        onSenderChange(false, null, null);
      }
      return;
    }

    console.log('📧 Sender: Loading sender for ownerId:', ownerId);
    loadSenderStatus();
  }, [ownerId, loadSenderStatus]);

  // Notify parent when sender state changes
  useEffect(() => {
    if (onSenderChange) {
      onSenderChange(!!senderEmail, senderEmail, senderName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senderEmail, senderName]); // Notify parent of sender changes

  const loadSenderStatus = useCallback(async () => {
    if (!ownerId) {
      console.log('📧 Sender: loadSenderStatus called but ownerId is missing');
      setLoading(false);
      return;
    }

    try {
      console.log('📧 Sender: Calling /api/outreach/verified-senders for ownerId:', ownerId);
      setLoading(true);
      setError(null);
      
      // Check DB for verified sender
      const response = await api.get('/api/outreach/verified-senders');
      
      if (response.data?.success) {
        const email = response.data.verifiedEmail;
        const name = response.data.verifiedName;
        
        console.log('✅ Sender: API response successful', { email, name });
        
        if (email) {
          console.log('✅ Sender: Found verified sender in DB:', email);
          setSenderEmail(email);
          setSenderName(name);
        } else {
          console.log('⚠️ Sender: No sender in DB, trying to auto-select from SendGrid...');
          // No sender found in DB - try to auto-select from SendGrid if only one available
          try {
            const findResponse = await api.post('/api/outreach/verified-senders/find-or-create', {});
            
            if (findResponse.data?.success) {
              // If only one sender found, auto-select it
              if (findResponse.data.action === 'found' && findResponse.data.sender) {
                const sender = findResponse.data.sender;
                setSenderEmail(sender.email);
                setSenderName(sender.name);
                // Also save it to DB for future loads
                await api.put('/api/outreach/verified-senders', {
                  email: sender.email,
                  name: sender.name,
                });
              } else if (findResponse.data.action === 'select' && findResponse.data.senders?.length === 1) {
                // Only one sender available - auto-select it
                const sender = findResponse.data.senders[0];
                setSenderEmail(sender.email);
                setSenderName(sender.name);
                // Also save it to DB for future loads
                await api.put('/api/outreach/verified-senders', {
                  email: sender.email,
                  name: sender.name,
                });
              } else {
                // Multiple senders or none - clear state (user will need to select)
                setSenderEmail(null);
                setSenderName(null);
              }
            } else {
              // No sender found - clear state
              setSenderEmail(null);
              setSenderName(null);
            }
          } catch (findErr) {
            console.warn('Failed to auto-select sender:', findErr);
            // No sender found - clear state
            setSenderEmail(null);
            setSenderName(null);
          }
        }
      } else {
        // API returned error - clear sender state
        setSenderEmail(null);
        setSenderName(null);
      }
    } catch (err) {
      console.error('❌ Sender: Failed to load sender status:', err);
      // On auth errors (401), clear sender state
      if (err.response?.status === 401) {
        console.error('❌ Sender: Authentication failed (401)');
        setSenderEmail(null);
        setSenderName(null);
      }
      setError(err.response?.data?.error || 'Failed to load sender status');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  const loadAvailableSenders = async () => {
    try {
      setLoadingSenders(true);
      setError(null);
      
      // Fetch all verified senders from SendGrid
      const response = await api.post('/api/outreach/verified-senders/find-or-create', {});
      
      if (response.data?.success) {
        if (response.data.action === 'select' && response.data.senders) {
          setAvailableSenders(response.data.senders);
        } else if (response.data.action === 'found' && response.data.sender) {
          // Single sender found
          setAvailableSenders([response.data.sender]);
        } else {
          setAvailableSenders([]);
        }
      }
    } catch (err) {
      console.error('Failed to load available senders:', err);
      setError(err.response?.data?.error || 'Failed to load senders');
    } finally {
      setLoadingSenders(false);
    }
  };

  const handleChangeClick = () => {
    setShowChangeModal(true);
    loadAvailableSenders();
  };

  const handleSelectSender = async (sender) => {
    try {
      setChangingSender(true);
      setError(null);
      
      // Update owner's verified sender
      const response = await api.put('/api/outreach/verified-senders', {
        email: sender.email,
        name: sender.name,
      });
      
      if (response.data?.success) {
        // Update local state
        setSenderEmail(sender.email);
        setSenderName(sender.name);
        setShowChangeModal(false);
        setAvailableSenders([]);
        setError(null);
        // Reload sender status to ensure consistency
        await loadSenderStatus();
      } else {
        setError(response.data?.error || 'Failed to update sender');
      }
    } catch (err) {
      console.error('Failed to update sender:', err);
      setError(err.response?.data?.error || 'Failed to update sender');
    } finally {
      setChangingSender(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // If sender found in DB, show it with Change button
  if (senderEmail) {
    return (
      <>
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-gray-900 font-medium">
            {senderName || senderEmail}
          </span>
          <span className="text-gray-500">&lt;{senderEmail}&gt;</span>
          <button
            onClick={handleChangeClick}
            className="ml-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Change
          </button>
        </div>

        {/* Change Sender Modal */}
        {showChangeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="rounded-lg bg-white p-6 shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Change Sender Email</h3>
                <button 
                  onClick={() => {
                    setShowChangeModal(false);
                    setError(null);
                    setAvailableSenders([]);
                  }} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-900">{error}</p>
                </div>
              )}

              {loadingSenders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading verified senders...</span>
                </div>
              ) : availableSenders.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    No verified senders found in SendGrid.
                  </p>
                  <button
                    onClick={() => router.push('/outreach/sender-verify')}
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Verified Sender
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-4">
                    Select a verified sender email to use:
                  </p>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {availableSenders.map((sender) => (
                      <button
                        key={sender.email}
                        onClick={() => handleSelectSender(sender)}
                        disabled={changingSender || sender.email === senderEmail}
                        className={`w-full text-left rounded-lg border p-3 transition ${
                          sender.email === senderEmail
                            ? 'border-green-300 bg-green-50 cursor-default'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        } ${changingSender ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {sender.name || sender.email}
                            </div>
                            <div className="text-xs text-gray-500">{sender.email}</div>
                          </div>
                          {sender.email === senderEmail && (
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <button
                      onClick={() => router.push('/outreach/sender-verify')}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Verified Sender
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // No sender in DB - show "Add" button
  return (
    <button
      onClick={() => router.push('/outreach/sender-verify')}
      className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
    >
      <Plus className="h-4 w-4" />
      Add
    </button>
  );
}
