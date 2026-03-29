'use client';

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { usePipelinesContext } from './PipelinesContext';
import api from '@/lib/api';

const FALLBACK_PIPELINES = {
  unassigned: [],
  prospect: ['need-to-engage', 'engaged-awaiting-response', 'interest', 'meeting', 'proposal', 'contract', 'contract-signed'],
  client: ['kickoff', 'work-started', 'work-delivered', 'sustainment', 'renewal'],
  collaborator: ['interest', 'meeting', 'agreement'],
  institution: ['interest', 'meeting', 'agreement'],
};

const PIPELINE_ICONS = {
  unassigned: '📋',
  prospect: '📈',
  client: '🏁',
  collaborator: '🤝',
  institution: '🏛️',
};

const NO_STAGE_PIPELINES = ['unassigned', 'no-role'];

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

function PipelinesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyHQId = searchParams?.get('companyHQId') || '';
  const { pipelineConfig, hydrating } = usePipelinesContext();
  const [contacts, setContacts] = useState([]);
  const [contactsHydrating, setContactsHydrating] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkPipeline, setBulkPipeline] = useState('');
  const [bulkStage, setBulkStage] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState(null);
  const selectAllRef = useRef(null);

  const pipelines = pipelineConfig?.pipelines ?? FALLBACK_PIPELINES;
  const pipelineKeys = Object.keys(pipelines);
  const [activePipeline, setActivePipeline] = useState(pipelineKeys[0] ?? 'prospect');
  const [selectedStage, setSelectedStage] = useState(null); // null = show all stages

  const fetchContacts = useCallback(async () => {
    if (!companyHQId) {
      setContacts([]);
      return;
    }

    setContactsHydrating(true);
    try {
      const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
      if (response.data?.success && Array.isArray(response.data.contacts)) {
        setContacts(response.data.contacts);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error('Failed to fetch contacts from API', error);
      setContacts([]);
    } finally {
      setContactsHydrating(false);
    }
  }, [companyHQId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedStage, companyHQId]);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setBulkFeedback(null);
      return;
    }
    setBulkPipeline(activePipeline);
    const stages = pipelines[activePipeline] ?? [];
    setBulkStage(stages[0] ?? '');
    // Intentionally when selection count or pipeline tab changes — not when `pipelines` identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.length, activePipeline]);

  const contactsByPipeline = useMemo(() => {
    return contacts.reduce((acc, contact) => {
      const pipeline = contact.pipelines || contact.pipeline;
      const pipelineId = pipeline?.pipeline ? slugify(pipeline.pipeline) : 'unassigned';
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
    return filtered;
  }, [allActiveContacts, selectedStage]);
  
  const handlePipelineChange = (pipelineId) => {
    setActivePipeline(pipelineId);
    setSelectedStage(null);
    setSelectedIds([]);
  };

  const activeContactIds = useMemo(
    () => activeContacts.map((c) => c.id).filter(Boolean),
    [activeContacts],
  );

  const allRowsSelected =
    activeContactIds.length > 0 && activeContactIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const some =
      activeContactIds.some((id) => selectedIds.includes(id)) && !allRowsSelected;
    el.indeterminate = some;
  }, [activeContactIds, selectedIds, allRowsSelected]);

  const toggleRowSelection = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (allRowsSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds([...activeContactIds]);
  };

  const handleBulkPipelineSelect = (pipelineId) => {
    setBulkPipeline(pipelineId);
    const stages = pipelines[pipelineId] ?? [];
    setBulkStage(stages[0] ?? '');
  };

  const applyBulkPipeline = async () => {
    if (!companyHQId || selectedIds.length === 0 || bulkSubmitting) return;
    if (!bulkPipeline || !pipelineKeys.includes(bulkPipeline)) {
      setBulkFeedback({ variant: 'error', text: 'Choose a pipeline.' });
      return;
    }

    const needsStage = !NO_STAGE_PIPELINES.includes(bulkPipeline);
    if (needsStage && !bulkStage) {
      setBulkFeedback({ variant: 'error', text: 'Choose a stage for this pipeline.' });
      return;
    }

    setBulkSubmitting(true);
    setBulkFeedback(null);
    try {
      const payload = {
        companyHQId,
        contactIds: selectedIds,
        pipeline: bulkPipeline,
      };
      if (needsStage) {
        payload.stage = bulkStage;
      }

      const response = await api.post('/api/contacts/pipeline/bulk', payload);
      const data = response.data;

      if (!data?.success) {
        setBulkFeedback({
          variant: 'error',
          text: data?.error || 'Bulk update failed',
        });
        return;
      }

      const failCount = typeof data.failed === 'number' ? data.failed : 0;
      const okCount = typeof data.updated === 'number' ? data.updated : 0;
      if (failCount > 0) {
        setBulkFeedback({
          variant: 'warn',
          text: `Updated ${okCount} contact(s). ${failCount} could not be updated.`,
        });
      } else {
        setBulkFeedback({
          variant: 'success',
          text: `Updated ${okCount} contact(s).`,
        });
      }

      setSelectedIds([]);
      await fetchContacts();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Bulk update failed';
      setBulkFeedback({ variant: 'error', text: msg });
    } finally {
      setBulkSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Pipeline"
          subtitle="Track contacts through unassigned, connector, prospect, client, collaborator, and institution flows."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
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
                {hydrating || contactsHydrating
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
              {activeStages.length > 0 && activeStages.map((stageId) => {
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
              {activeStages.length === 0 && activePipeline === 'unassigned' && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  Unassigned contacts have no stages
                </span>
              )}
              {activeStages.length === 0 && activePipeline !== 'unassigned' && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  No stages defined yet
                </span>
              )}
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 sm:flex-row sm:flex-wrap sm:items-end">
              <p className="text-sm font-semibold text-gray-900 sm:mr-2">
                {selectedIds.length} selected — move to
              </p>
              <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-gray-500">
                Pipeline
                <select
                  value={bulkPipeline}
                  onChange={(e) => handleBulkPipelineSelect(e.target.value)}
                  className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {pipelineKeys.map((id) => (
                    <option key={id} value={id}>
                      {formatLabel(id)}
                    </option>
                  ))}
                </select>
              </label>
              {(pipelines[bulkPipeline]?.length ?? 0) > 0 && (
                <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Stage
                  <select
                    value={bulkStage}
                    onChange={(e) => setBulkStage(e.target.value)}
                    className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {(pipelines[bulkPipeline] ?? []).map((stageId) => (
                      <option key={stageId} value={stageId}>
                        {formatLabel(stageId)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={applyBulkPipeline}
                  disabled={bulkSubmitting || !companyHQId}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkSubmitting ? 'Applying…' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Clear selection
                </button>
              </div>
            </div>
          )}

          {bulkFeedback && (
            <p
              className={`mb-4 text-sm ${
                bulkFeedback.variant === 'error'
                  ? 'text-red-700'
                  : bulkFeedback.variant === 'warn'
                    ? 'text-amber-800'
                    : 'text-green-800'
              }`}
            >
              {bulkFeedback.text}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-2 py-3 text-left">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allRowsSelected}
                      onChange={toggleSelectAll}
                      disabled={activeContactIds.length === 0}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      aria-label="Select all contacts in this view"
                    />
                  </th>
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
                    <td className="px-4 py-10 text-center text-sm text-gray-500" colSpan={5}>
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
                    const rowSelected = contact.id && selectedIds.includes(contact.id);
                    return (
                      <tr
                        key={contact.id}
                        className={`group cursor-pointer transition-all hover:bg-indigo-50 hover:shadow-sm ${
                          rowSelected ? 'bg-indigo-50/50' : ''
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          if (contact.id) {
                            router.push(`/contacts/${contact.id}`);
                          }
                        }}
                      >
                        <td
                          className="px-2 py-3"
                          onClick={(e) => toggleRowSelection(contact.id, e)}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(rowSelected)}
                            readOnly
                            tabIndex={-1}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            aria-label={`Select ${displayName}`}
                          />
                        </td>
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

export default function PipelinesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading pipelines...</p>
          </div>
        </div>
      </div>
    }>
      <PipelinesPageContent />
    </Suspense>
  );
}

