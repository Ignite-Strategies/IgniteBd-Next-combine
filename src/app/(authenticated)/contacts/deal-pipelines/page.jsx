'use client';

import { useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader.jsx';
import { useContactsContext } from '../layout.jsx';
import { usePipelinesContext } from '../../pipelines/layout.jsx';

const FALLBACK_PIPELINES = {
  prospect: ['interest', 'meeting', 'proposal', 'contract', 'contract-signed'],
  client: ['kickoff', 'work-started', 'work-delivered', 'sustainment', 'renewal'],
  collaborator: ['interest', 'meeting', 'agreement'],
  institution: ['interest', 'meeting', 'agreement'],
};

const PIPELINE_ICONS = {
  prospect: '📈',
  client: '🏁',
  collaborator: '🤝',
  institution: '🏛️',
};

const formatLabel = (value) =>
  value
    ? value
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : '';

const slugify = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

export default function DealPipelinesPage() {
  const { contacts } = useContactsContext();
  const { pipelineConfig, hydrating } = usePipelinesContext();
  const pipelines = pipelineConfig?.pipelines ?? FALLBACK_PIPELINES;
  const pipelineKeys = Object.keys(pipelines);
  const [activePipeline, setActivePipeline] = useState(pipelineKeys[0] ?? 'prospect');

  const contactsByPipeline = useMemo(() => {
    return contacts.reduce((acc, contact) => {
      const pipelineId = slugify(contact.pipeline?.pipeline);
      if (!pipelineId) return acc;
      const list = acc.get(pipelineId) ?? [];
      list.push(contact);
      acc.set(pipelineId, list);
      return acc;
    }, new Map());
  }, [contacts]);

  const activeStages = pipelines[activePipeline] ?? [];
  const activeContacts = contactsByPipeline.get(activePipeline) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Deal Pipelines"
          subtitle="Track contacts through prospect, client, collaborator, and institution flows."
          backTo="/contacts"
          backLabel="Back to People Hub"
        />

        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Select Pipeline</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pipelineKeys.map((pipelineId) => {
              const icon = PIPELINE_ICONS[pipelineId] ?? '🛠️';
              const count = contactsByPipeline.get(pipelineId)?.length ?? 0;
              const isActive = pipelineId === activePipeline;
              return (
                <button
                  key={pipelineId}
                  type="button"
                  onClick={() => setActivePipeline(pipelineId)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatLabel(pipelineId)}
                      </p>
                      <p className="text-xs text-gray-500">{count} contacts</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {formatLabel(activePipeline)} Pipeline
              </h3>
              <p className="text-sm text-gray-600">
                {hydrating
                  ? 'Refreshing pipeline data…'
                  : `Currently tracking ${activeContacts.length} contacts.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeStages.map((stageId) => (
                <span
                  key={stageId}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600"
                >
                  {formatLabel(stageId)}
                </span>
              ))}
              {activeStages.length === 0 && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  No stages defined yet
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Stage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {activeContacts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={4}>
                      No contacts assigned to this pipeline yet.
                    </td>
                  </tr>
                ) : (
                  activeContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {contact.goesBy ||
                          [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
                          'Unnamed Contact'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {contact.contactCompany?.companyName || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatLabel(slugify(contact.pipeline?.stage)) || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {contact.email || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
