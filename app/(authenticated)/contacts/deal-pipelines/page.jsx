'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { useContactsContext } from '@/hooks/useContacts';
import { usePipelinesContext } from '@/hooks/usePipelines';

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
  const router = useRouter();
  const { contacts } = useContactsContext();
  const { pipelineConfig, hydrating } = usePipelinesContext();
  const pipelines = pipelineConfig?.pipelines ?? FALLBACK_PIPELINES;
  const pipelineKeys = Object.keys(pipelines);
  const [activePipeline, setActivePipeline] = useState(pipelineKeys[0] ?? 'prospect');
  const [selectedStage, setSelectedStage] = useState(null); // null = show all stages

  const contactsByPipeline = useMemo(() => {
    return contacts.reduce((acc, contact) => {
      const pipeline = contact.pipelines || contact.pipeline;
      const pipelineId = slugify(pipeline?.pipeline);
      if (!pipelineId) return acc;
      const list = acc.get(pipelineId) ?? [];
      list.push(contact);
      acc.set(pipelineId, list);
      return acc;
    }, new Map());
  }, [contacts]);

  const activeStages = pipelines[activePipeline] ?? [];
  const allActiveContacts = contactsByPipeline.get(activePipeline) ?? [];
  
  // Filter contacts by selected stage
  const activeContacts = useMemo(() => {
    if (!selectedStage) {
      return allActiveContacts;
    }
    const filtered = allActiveContacts.filter((contact) => {
      const pipeline = contact.pipelines || contact.pipeline;
      const contactStage = slugify(pipeline?.stage);
      const matches = contactStage === selectedStage;
      return matches;
    });
    console.log('Filtering contacts:', {
      selectedStage,
      totalContacts: allActiveContacts.length,
      filteredCount: filtered.length,
      sampleStages: allActiveContacts.slice(0, 3).map(c => {
        const p = c.pipelines || c.pipeline;
        return {
          id: c.id,
          stage: p?.stage,
          slugified: slugify(p?.stage)
        };
      })
    });
    return filtered;
  }, [allActiveContacts, selectedStage]);
  
  // Reset stage filter when pipeline changes
  const handlePipelineChange = (pipelineId) => {
    setActivePipeline(pipelineId);
    setSelectedStage(null); // Reset stage filter
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Deal Pipelines"
          subtitle="Track contacts through prospect, client, collaborator, and institution flows."
          backTo="/people"
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
                  onClick={() => handlePipelineChange(pipelineId)}
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStage(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedStage === null
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Stages
              </button>
              {activeStages.map((stageId) => {
                const isSelected = selectedStage === stageId;
                const stageCount = allActiveContacts.filter(
                  (contact) => {
                    const pipeline = contact.pipelines || contact.pipeline;
                    return slugify(pipeline?.stage) === stageId;
                  }
                ).length;
                return (
                  <button
                    key={stageId}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStage(isSelected ? null : stageId);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    {formatLabel(stageId)} ({stageCount})
                  </button>
                );
              })}
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
                  activeContacts.map((contact) => {
                    const pipeline = contact.pipelines || contact.pipeline;
                    const contactStage = slugify(pipeline?.stage);
                    const displayName = contact.goesBy ||
                      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
                      'Unnamed Contact';
                    return (
                      <tr
                        key={contact.id}
                        className="group cursor-pointer transition-all hover:bg-indigo-50 hover:shadow-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          if (contact.id) {
                            router.push(`/contacts/${contact.id}`);
                          }
                        }}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          <span className="text-gray-900 group-hover:text-indigo-600 group-hover:underline transition-colors">
                            {displayName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 group-hover:text-gray-700 transition-colors">
                          {contact.companies?.companyName || contact.contactCompany?.companyName || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              contactStage && activeStages.includes(contactStage)
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {formatLabel(pipeline?.stage) || 'Unassigned'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-gray-600 group-hover:text-indigo-600 transition-colors">
                            {contact.email || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
