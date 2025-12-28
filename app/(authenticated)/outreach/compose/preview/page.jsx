'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, ArrowLeft, Loader2, CheckCircle2, Eye } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';

/**
 * Outreach 1:1 Preview Page
 * 
 * Shows preview of email payload before sending
 * Uses requestId from build-payload to retrieve exact payload from Redis
 */
function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId');

  const [previewPayload, setPreviewPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [messageId, setMessageId] = useState(null);

  // Auto-load preview when page loads
  useEffect(() => {
    if (!requestId) {
      setError('Missing requestId');
      setLoading(false);
      return;
    }
    
    loadPreview();
  }, [requestId]);

  const loadPreview = async () => {
    if (!requestId) {
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/api/outreach/preview?requestId=${requestId}`);

      if (response.data?.success) {
        setPreviewPayload(response.data.preview || response.data.payload);
      } else {
        setError(response.data?.error || 'Failed to load preview');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    if (e) {
      e.preventDefault();
    }

    if (!requestId) {
      setError('Missing requestId');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      // Step 3: Send using requestId (payload is already in Redis)
      const response = await api.post('/api/outreach/send', {
        requestId,
      });

      if (response.data?.success) {
        setSuccess(true);
        setMessageId(response.data.messageId || null);
        
        // Redirect back to compose after 3 seconds
        setTimeout(() => {
          router.push('/outreach/compose');
        }, 3000);
      } else {
        setError(response.data?.error || 'Failed to send email');
      }
    } catch (err) {
      console.error('[preview] Send error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to send email';
      setError(errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Email Preview"
            subtitle="Loading preview..."
            backTo="/outreach/compose"
            backLabel="Back to Compose"
          />
          <div className="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading email preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !previewPayload) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <PageHeader
            title="Email Preview"
            subtitle="Error loading preview"
            backTo="/outreach/compose"
            backLabel="Back to Compose"
          />
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 shadow-sm p-8">
            <p className="text-sm font-medium text-red-900 mb-4">{error}</p>
            <button
              onClick={() => router.push('/outreach/compose')}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Compose
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Email Preview"
          subtitle="Review your email before sending"
          backTo="/outreach/compose"
          backLabel="Back to Compose"
        />

        <div className="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Eye className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            </div>

            {success && (
              <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-900">✅ Email sent successfully!</p>
                  {messageId && (
                    <p className="text-xs text-green-700 mt-1">Message ID: {messageId}</p>
                  )}
                  <p className="text-xs text-green-700 mt-1">Redirecting back to compose...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
            )}

            {previewPayload && (
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    From
                  </label>
                  <div className="text-sm text-gray-900">
                    {previewPayload.from?.name && (
                      <span className="font-medium">{previewPayload.from.name} </span>
                    )}
                    <span className="text-gray-600">&lt;{previewPayload.from?.email || 'N/A'}&gt;</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    To
                  </label>
                  <p className="text-sm text-gray-900">{previewPayload.to || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Subject
                  </label>
                  <p className="text-sm font-medium text-gray-900">{previewPayload.subject || 'N/A'}</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Message
                  </label>
                  <div 
                    className="text-sm text-gray-900 prose prose-sm max-w-none border border-gray-200 rounded-md p-4 bg-gray-50"
                    dangerouslySetInnerHTML={{ __html: previewPayload.body || 'N/A' }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => router.push('/outreach/compose')}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleSend}
                disabled={sending || success}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Sent!
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mt-8 rounded-lg border border-gray-200 bg-white shadow-sm p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}

