'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

/**
 * RecentInboundContainer
 * 
 * Shows recent inbound emails (last 30 days) in outreach dashboard.
 * Compact view similar to NextEngagementContainer.
 */
export default function RecentInboundContainer({ compact = false, showSeeAll = false }) {
  const router = useRouter();
  const [inboundEmails, setInboundEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyHQId, setCompanyHQId] = useState(null);

  useEffect(() => {
    // Get companyHQId from localStorage (set by context)
    const crmId = typeof window !== 'undefined' 
      ? window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId') || null
      : null;
    
    if (crmId) {
      setCompanyHQId(crmId);
      fetchInboundEmails(crmId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchInboundEmails = async (tenantId) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/inbound-emails?tenantId=${tenantId}`);
      if (res.data?.success) {
        setInboundEmails(res.data.emails || []);
      }
    } catch (error) {
      console.error('Error fetching inbound emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-lg">
        <div className="text-sm text-gray-500">Loading inbound emails...</div>
      </div>
    );
  }

  if (!companyHQId) {
    return null; // Don't show if no company context
  }

  const displayEmails = compact ? inboundEmails.slice(0, 5) : inboundEmails;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Inbox className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Inbound</h3>
            <p className="text-sm text-gray-500">
              {inboundEmails.length === 0 
                ? 'No inbound emails yet' 
                : `${inboundEmails.length} email${inboundEmails.length !== 1 ? 's' : ''} in last 30 days`}
            </p>
          </div>
        </div>
        {showSeeAll && inboundEmails.length > 0 && (
          <button
            onClick={() => router.push('/outreach/inbound')}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            See all →
          </button>
        )}
      </div>

      {inboundEmails.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          <p>No inbound emails received yet.</p>
          <p className="mt-1 text-xs">
            Emails sent to your company address will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayEmails.map((email) => (
            <div
              key={email.id}
              className="flex items-start justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {email.contacts?.fullName || email.email || 'Unknown'}
                  </span>
                  {email.responseFromEmail && (
                    <span className="text-xs text-blue-600">↩️</span>
                  )}
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {email.subject || '(No subject)'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(email.createdAt)}
                </div>
              </div>
              {!compact && (
                <button
                  onClick={() => router.push(`/outreach/inbound/${email.id}`)}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
