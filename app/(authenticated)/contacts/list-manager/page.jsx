'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useLocalStorage } from '@/hooks/useLocalStorage.js';

const getInitialLists = () => [
  {
    id: 'demo-q1-outreach',
    name: 'Q1 Outreach Targets',
    description: 'High-priority contacts for Q1 outreach campaign',
    type: 'Campaign',
    totalContacts: 47,
    contactIds: [],
    createdAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: 'demo-event-attendees',
    name: 'Legal Tech Conference 2024',
    description: 'All attendees from the Legal Tech Conference',
    type: 'Event',
    totalContacts: 128,
    contactIds: [],
    createdAt: new Date('2024-02-10').toISOString(),
  },
  {
    id: 'demo-warm-leads',
    name: 'Warm Leads - Follow Up',
    description: 'Contacts who have engaged but need follow-up',
    type: 'Custom',
    totalContacts: 23,
    contactIds: [],
    createdAt: new Date('2024-02-20').toISOString(),
  },
];

export default function ContactListManagerPage() {
  const router = useRouter();
  const [lists, setLists] = useLocalStorage('contactLists', []);
  const [campaigns, setCampaigns] = useLocalStorage('campaigns', []);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (lists.length === 0) {
      const initialLists = getInitialLists();
      setLists(initialLists);
      if (campaigns.length === 0) {
        setCampaigns([
          {
            id: 'demo-q1-campaign',
            name: 'Q1 Outreach Campaign',
            contactListId: 'demo-q1-outreach',
            status: 'active',
            createdAt: new Date('2024-01-15').toISOString(),
          },
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLists = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return lists;
    return lists.filter((list) => list.name.toLowerCase().includes(needle));
  }, [lists, searchTerm]);

  const deleteList = (listId) => {
    if (window.confirm('Delete this contact list? This cannot be undone.')) {
      setLists(lists.filter((list) => list.id !== listId));
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
          backTo="/contacts"
          backLabel="Back to People Hub"
          actions={
            <button
              type="button"
              onClick={() => router.push('/contacts/list-builder')}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create New List
            </button>
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

        {filteredLists.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-800">
              {searchTerm ? 'No lists match your search' : 'No contact lists yet'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Create a new list to segment contacts for campaigns.
            </p>
            <button
              type="button"
              onClick={() => router.push('/contacts/list-builder')}
              className="mt-6 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
            >
              Create New List
            </button>
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
