'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Building2, Mail, CheckCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';
import { useLocalStorage } from '@/hooks/useLocalStorage.js';

const LIST_OPTIONS = [
  {
    id: 'all_contacts',
    name: 'All Contacts',
    description: 'Include every contact currently in your CRM.',
    icon: Users,
  },
  {
    id: 'org_members',
    name: 'Organization Members',
    description: 'Focus on members tied to your company HQ.',
    icon: Building2,
  },
  {
    id: 'event_contacts',
    name: 'Event Contacts',
    description: 'Start with attendees captured from events and conferences.',
    icon: Building2,
  },
  {
    id: 'custom',
    name: 'Custom Selection',
    description: 'Manually choose contacts via filters (coming soon).',
    icon: Mail,
  },
];

export default function ContactListBuilderPage() {
  const router = useRouter();
  const [lists, setLists] = useLocalStorage('contactLists', []);
  const [selectedType, setSelectedType] = useState('');
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');

  const handleSelectType = (option) => {
    setSelectedType(option.id);
    setListName(option.name);
    setListDescription(option.description);
  };

  const handleCreate = () => {
    if (!selectedType || !listName.trim()) {
      alert('Please choose a list type and name your list.');
      return;
    }

    const newList = {
      id: `${selectedType}-${Date.now()}`,
      name: listName.trim(),
      description: listDescription.trim(),
      type: selectedType,
      totalContacts: selectedType === 'custom' ? 0 : undefined,
      createdAt: new Date().toISOString(),
      contactIds: [],
    };

    setLists([newList, ...lists]);
    router.push('/contacts/list-manager');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Create Contact List"
          subtitle="Pick a blueprint for your new audience segment"
          backTo="/people/outreach-prep"
          backLabel="Back to Outreach Prep"
        />

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Select List Type
          </h3>
          <div className="space-y-3">
            {LIST_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = selectedType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelectType(option)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-lg p-3 ${
                        active ? 'bg-indigo-100' : 'bg-gray-100'
                      }`}
                    >
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">
                          {option.name}
                        </h4>
                        {active && (
                          <CheckCircle className="h-5 w-5 text-indigo-600" />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedType && (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              List Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  List Name
                </label>
                <input
                  type="text"
                  value={listName}
                  onChange={(event) => setListName(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter list name"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Description (optional)
                </label>
                <textarea
                  value={listDescription}
                  onChange={(event) => setListDescription(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Describe the purpose of this list"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/contacts/list-manager')}
            className="rounded-lg bg-gray-100 px-6 py-2 font-semibold text-gray-700 transition hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!selectedType || !listName.trim()}
            className="rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create List →
          </button>
        </div>
      </div>
    </div>
  );
}
