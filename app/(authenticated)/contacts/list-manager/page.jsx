'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { useContactLists } from '../ContactListsContext';

export default function ContactListManagerPage() {
  const router = useRouter();
  const { lists, hydrated, hydrating, refreshLists, removeList: removeListFromContext } = useContactLists();
  const [campaigns, setCampaigns] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // Load from localStorage on mount (no API call)
  useEffect(() => {
    // Lists are already loaded from localStorage via context
    // No auto-fetch - user can manually refresh if needed
  }, []);

  const filteredLists = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return lists;
    return lists.filter((list) => list.name.toLowerCase().includes(needle));
  }, [lists, searchTerm]);

  const deleteList = async (listId) => {
    if (window.confirm('Delete this contact list? This cannot be undone.')) {
      try {
        const response = await api.delete(`/api/contact-lists/${listId}`);
        if (response.data?.success) {
          // Remove from context (which updates localStorage)
          removeListFromContext(listId);
        } else {
          alert(response.data?.error || 'Failed to delete list');
        }
      } catch (err) {
        console.error('Error deleting list:', err);
        alert(err.response?.data?.error || 'Failed to delete list');
      }
    }
  };

  const getListStatus = (list) => {
    const assignedCampaign = campaigns.find(
      (campaign) => campaign.contactListId === list.id,
    );
    return assignedCampaign
      ? { isAssigned: true, campaign: assignedCampaign }
      : { isAssigned: false };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Contact Lists"
          subtitle="Manage reusable segments for outreach and personalization"
          backTo="/people"
          backLabel="Back to People Hub"
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshLists}
                disabled={hydrating}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  hydrating
                    ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <RefreshCw className={hydrating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                {hydrating ? 'Syncing...' : 'Sync'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/contacts/list-builder')}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Create New List
              </button>
            </div>
          }
        />

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search contact lists…"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {!hydrated && !hydrating ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">No contact lists cached</p>
            <p className="mt-2 text-sm text-gray-500">Click "Sync" to load from server</p>
          </div>
        ) : hydrating ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">Syncing contact lists...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-red-800">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Retry
            </button>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">
              {searchTerm ? 'No lists match your search' : 'No contact lists yet'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm 
                ? 'Try a different search term'
                : 'Create a new list to segment contacts for campaigns.'}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={() => router.push('/contacts/list-builder')}
                className="mt-6 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
              >
                Create New List
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredLists.map((list) => {
              const status = getListStatus(list);
              return (
                <div
                  key={list.id}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {list.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {list.description || 'No description provided'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                        status.isAssigned
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {status.isAssigned ? (
                        <>
                          <CheckCircle className="h-3 w-3" /> Assigned
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" /> Available
                        </>
                      )}
                    </span>
                  </div>

                  <dl className="mb-4 space-y-1 text-xs text-gray-500">
                    <div>
                      <dt className="font-semibold text-gray-600">Type</dt>
                      <dd>{list.type || 'Standard'}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-gray-600">Contacts</dt>
                      <dd>{list.totalContacts ?? list.contactIds?.length ?? 0}</dd>
                    </div>
                    {list.createdAt && (
                      <div>
                        <dt className="font-semibold text-gray-600">Created</dt>
                        <dd>{new Date(list.createdAt).toLocaleDateString()}</dd>
                      </div>
                    )}
                    {status.isAssigned && (
                      <div className="text-orange-600">
                        Assigned to {status.campaign?.name || 'active campaign'}
                      </div>
                    )}
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => alert('List detail view coming soon.')}
                      className="rounded-lg bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-200"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteList(list.id)}
                      className="rounded-lg bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 transition hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
