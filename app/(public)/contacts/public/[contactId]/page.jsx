'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  User, 
  Mail, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  ArrowLeft,
  FileText 
} from 'lucide-react';
import api from '@/lib/api';

export default function PublicContactDetailForSendPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  
  const [contactId, setContactId] = useState(null);
  const [contact, setContact] = useState(null);
  const [relationshipContext, setRelationshipContext] = useState(null);
  const [inferredPersona, setInferredPersona] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Handle params (may be sync or async in Next.js)
  useEffect(() => {
    const resolveParams = async () => {
      if (params && typeof params.then === 'function') {
        const resolvedParams = await params;
        setContactId(resolvedParams?.contactId);
      } else if (params?.contactId) {
        setContactId(params.contactId);
      }
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!contactId) return;

    const fetchContactDetail = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await api.get(`/api/public/contacts/${contactId}/detail`);
        
        if (response.data?.success) {
          setContact(response.data.contact);
          setRelationshipContext(response.data.relationshipContext);
          setInferredPersona(response.data.inferredPersona);
          setTemplate(response.data.template);
        } else {
          setError(response.data?.error || 'Failed to load contact');
        }
      } catch (err) {
        console.error('Error fetching contact detail:', err);
        setError(err.response?.data?.error || 'Failed to load contact');
      } finally {
        setLoading(false);
      }
    };

    fetchContactDetail();
  }, [contactId]);

  const handleCopyTemplate = async () => {
    if (!template) return;

    const fullTemplate = `Subject: ${template.subject}\n\n${template.body}`;
    
    try {
      await navigator.clipboard.writeText(fullTemplate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback: select text
      const textArea = document.createElement('textarea');
      textArea.value = fullTemplate;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <div className="mt-4 text-gray-600">Loading contact details...</div>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600">Error: {error || 'Contact not found'}</div>
          <button
            onClick={() => {
              const url = companyHQId
                ? `/contacts/target-this-week?companyHQId=${companyHQId}`
                : '/contacts/target-this-week';
              router.push(url);
            }}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            ← Back to contacts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => {
              const url = companyHQId
                ? `/contacts/target-this-week?companyHQId=${companyHQId}`
                : '/contacts/target-this-week';
              router.push(url);
            }}
            className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to contacts
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Contact Details</h1>
        </div>

        <div className="space-y-6">
          {/* Contact Info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Contact Information</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-500">Name</div>
                  <div className="text-base text-gray-900">{contact.name}</div>
                </div>
              </div>
              {contact.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-500">Email</div>
                    <div className="text-base text-gray-900">{contact.email}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Relationship Context */}
          {relationshipContext && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-blue-900">Relationship Context</h2>
              </div>
              <div className="space-y-2 text-sm">
                {relationshipContext.formerCompany && (
                  <div>
                    <span className="font-semibold text-blue-900">Former Company:</span>{' '}
                    <span className="text-blue-700">{relationshipContext.formerCompany}</span>
                  </div>
                )}
                {relationshipContext.primaryWork && (
                  <div>
                    <span className="font-semibold text-blue-900">Primary Work:</span>{' '}
                    <span className="text-blue-700">{relationshipContext.primaryWork}</span>
                  </div>
                )}
                {relationshipContext.relationshipQuality && (
                  <div>
                    <span className="font-semibold text-blue-900">Relationship Quality:</span>{' '}
                    <span className="text-blue-700">{relationshipContext.relationshipQuality}</span>
                  </div>
                )}
                {relationshipContext.opportunityType && (
                  <div>
                    <span className="font-semibold text-blue-900">Opportunity Type:</span>{' '}
                    <span className="text-blue-700">{relationshipContext.opportunityType}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Inferred Persona */}
          {inferredPersona && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-purple-900">Inferred Persona</h2>
              </div>
              <div className="rounded-full bg-purple-100 px-3 py-1 text-sm font-semibold text-purple-700 inline-block">
                {inferredPersona}
              </div>
            </div>
          )}

          {/* Template */}
          {template ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">Email Template</h2>
                </div>
                <button
                  onClick={handleCopyTemplate}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Template
                    </>
                  )}
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-sm font-semibold text-gray-700">Subject:</div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900">
                    {template.subject}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-sm font-semibold text-gray-700">Body:</div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 whitespace-pre-wrap">
                    {template.body}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Please copy and paste this template to your desktop email client. 
                  The final template will be saved by your CRM manager.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-gray-600">Template generation is in progress or unavailable.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
