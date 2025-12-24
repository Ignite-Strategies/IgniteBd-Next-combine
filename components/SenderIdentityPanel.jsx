'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

/**
 * SenderIdentityPanel Component
 * 
 * Simple component that checks DB for verified sender
 * If not found, shows link to dedicated verification page
 */
export default function SenderIdentityPanel() {
  const router = useRouter();
  const { ownerId } = useOwner();
  const [senderEmail, setSenderEmail] = useState(null);
  const [senderName, setSenderName] = useState(null);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
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
      
      // Check if owner already has a verified sender in DB
      const response = await api.get('/api/outreach/verified-senders');
      
      if (response.data?.success) {
        const email = response.data.verifiedEmail;
        const name = response.data.verifiedName;
        
        if (email) {
          // Owner has a verified sender configured
          setSenderEmail(email);
          setSenderName(name);
          setVerified(true);
        }
      }
    } catch (err) {
      console.error('Failed to load sender status:', err);
      // Don't set error here - just show form if no sender
    } finally {
      setLoading(false);
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
        // No sender configured - link to verification page
        <div className="text-center py-4">
          <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700 mb-1">No verified sender configured</p>
          <p className="text-xs text-gray-500 mb-4">
            Verify your email address with SendGrid to send outreach emails
          </p>
          <button
            onClick={() => router.push('/outreach/sender-verify')}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Verify Sender Email
            <ArrowRight className="h-4 w-4" />
          </button>
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
      ) : null}
    </div>
  );
}

