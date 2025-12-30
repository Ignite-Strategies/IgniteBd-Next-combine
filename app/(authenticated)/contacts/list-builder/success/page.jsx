'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Send, Mail, Sparkles, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

function ContactListSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listId = searchParams.get('listId');
  const listName = searchParams.get('listName');
  const contactCount = searchParams.get('contactCount');
  const returnTo = searchParams.get('returnTo');
  const companyHQId = searchParams.get('companyHQId') || (typeof window !== 'undefined' ? localStorage.getItem('companyHQId') : '') || '';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="List Created Successfully!"
          subtitle={`Your contact list "${listName || 'Untitled'}" is ready to use`}
        />

        {/* Success Banner */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="rounded-full bg-green-500 p-3">
              <Check className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-900">
                Contact list "{listName || 'Untitled'}" created successfully!
              </h2>
              <p className="text-green-700 mt-1">
                {contactCount ? `${contactCount} contact${parseInt(contactCount) !== 1 ? 's' : ''} added to your list` : 'Your list is ready'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What would you like to do next?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => router.push(`/outreach/campaigns/create?contactListId=${listId}`)}
              className="flex flex-col items-center gap-3 rounded-xl bg-white border-2 border-indigo-200 p-6 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md transition-all"
            >
              <div className="rounded-full bg-indigo-100 p-3">
                <Send className="h-8 w-8 text-indigo-600" />
              </div>
              <span className="font-bold text-gray-900 text-lg">Start Campaign</span>
              <span className="text-sm text-gray-600 text-center">Create an outreach campaign with this list</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const url = companyHQId 
                  ? `/outreach/compose?contactListId=${listId}&companyHQId=${companyHQId}`
                  : `/outreach/compose?contactListId=${listId}`;
                router.push(url);
              }}
              className="flex flex-col items-center gap-3 rounded-xl bg-white border-2 border-blue-200 p-6 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all"
            >
              <div className="rounded-full bg-blue-100 p-3">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <span className="font-bold text-gray-900 text-lg">1:1 Email</span>
              <span className="text-sm text-gray-600 text-center">Send personalized emails to contacts</span>
            </button>
            <button
              type="button"
              onClick={() => router.push(`/contacts/enrich/csv?contactListId=${listId}`)}
              className="flex flex-col items-center gap-3 rounded-xl bg-white border-2 border-purple-200 p-6 hover:border-purple-400 hover:bg-purple-50 hover:shadow-md transition-all"
            >
              <div className="rounded-full bg-purple-100 p-3">
                <Sparkles className="h-8 w-8 text-purple-600" />
              </div>
              <span className="font-bold text-gray-900 text-lg">Enrich Contacts</span>
              <span className="text-sm text-gray-600 text-center">Add more data to your contacts</span>
            </button>
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => router.push('/contacts/list-manager')}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-2 font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List Manager
          </button>
          {returnTo && (
            <button
              type="button"
              onClick={() => router.push(returnTo)}
              className="rounded-lg bg-gray-100 px-6 py-2 font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              Return to Campaign
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/contacts/list-builder')}
            className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700"
          >
            Create Another List
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContactListSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <ContactListSuccessContent />
    </Suspense>
  );
}

