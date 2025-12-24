'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

/**
 * SenderIdentityPanel Component
 * 
 * Simple inline component: check DB, show sender if found, or "Add" button if not
 */
export default function SenderIdentityPanel() {
  const router = useRouter();
  const { ownerId } = useOwner();
  const [senderEmail, setSenderEmail] = useState(null);
  const [senderName, setSenderName] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current sender status from DB
  useEffect(() => {
    if (ownerId) {
      loadSenderStatus();
    }
  }, [ownerId]);

  const loadSenderStatus = async () => {
    try {
      setLoading(true);
      
      // Check DB for verified sender
      const response = await api.get('/api/outreach/verified-senders');
      
      if (response.data?.success) {
        const email = response.data.verifiedEmail;
        const name = response.data.verifiedName;
        
        if (email) {
          setSenderEmail(email);
          setSenderName(name);
        }
      }
    } catch (err) {
      console.error('Failed to load sender status:', err);
    } finally {
      setLoading(false);
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

  // If sender found in DB, show it inline
  if (senderEmail) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        <span className="text-gray-900 font-medium">
          {senderName || senderEmail}
        </span>
        <span className="text-gray-500">({senderEmail})</span>
      </div>
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

