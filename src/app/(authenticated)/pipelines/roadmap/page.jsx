'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader.jsx';
import { usePipelinesContext } from '../layout.jsx';

const STATUSES = ['Not Started', 'In Progress', 'Done'];

const INITIAL_ITEMS = [
  {
    id: 'setup-contacts',
    title: 'Set Up Your Contacts',
    description:
      'Sync contacts from email, upload CSV, or manually add your first cohort of prospects.',
    phase: 'Foundation',
    status: 'Not Started',
    priority: 'P0',
    link: '/contacts',
    linkLabel: 'Go to People Hub',
  },
  {
    id: 'pipeline-config',
    title: 'Configure Deal Pipeline',
    description:
      'Confirm stages for prospect → client → renewal flows so the team shares a common playbook.',
    phase: 'Foundation',
    status: 'Not Started',
    priority: 'P0',
    link: '/contacts/deal-pipelines',
    linkLabel: 'Open Deal Pipelines',
  },
  {
    id: 'personas',
    title: 'Define Your Personas',
    description: 'Create buyer and partner archetypes to align outreach messaging.',
    phase: 'Foundation',
    status: 'Not Started',
    priority: 'P1',
    link: '/personas',
    linkLabel: 'View Personas',
  },
  {
    id: 'campaign',
    title: 'Launch First Outreach Campaign',
    description: 'Send a nurture email to warm leads and measure engagement.',
    phase: 'Acceleration',
    status: 'Not Started',
    priority: 'P1',
    link: '/outreach/campaigns/create',
    linkLabel: 'Create Campaign',
  },
  {
    id: 'pipeline-review',
    title: 'Weekly Pipeline Review',
    description: 'Update deal stages, assign next steps, and unblock stalled opportunities.',
    phase: 'Scale',
    status: 'Not Started',
    priority: 'P1',
    recurring: true,
  },
];

const PHASE_ORDER = ['Foundation', 'Acceleration', 'Scale', 'Optimize'];

export default function PipelineRoadmapPage() {
  const { pipelineConfig } = usePipelinesContext();
  const [items, setItems] = useState(INITIAL_ITEMS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem('bdRoadmapItems');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        }
      } catch (error) {
        console.warn('Unable to parse cached roadmap items', error);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('bdRoadmapItems', JSON.stringify(items));
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((item) => item.status === 'Done').length;
    const inProgress = items.filter((item) => item.status === 'In Progress').length;
    return {
      total,
      done,
      inProgress,
      notStarted: total - done - inProgress,
    };
  }, [items]);

  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      const phase = item.phase || 'Other';
      const bucket = acc.get(phase) ?? [];
      bucket.push(item);
      acc.set(phase, bucket);
      return acc;
    }, new Map());
  }, [items]);

  const cycleStatus = (itemId) => {
    setItems((previous) =>
      previous.map((item) => {
        if (item.id !== itemId) return item;
        const currentIndex = STATUSES.indexOf(item.status);
        const nextStatus = STATUSES[(currentIndex + 1) % STATUSES.length];
        return { ...item, status: nextStatus };
      }),
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="BD Pipeline Roadmap"
          subtitle="Work through the foundational moves that unlock repeatable revenue."
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <section className="mb-8 rounded-2xl bg-white p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Total" value={stats.total} />
            <Stat label="Not Started" value={stats.notStarted} tone="text-gray-600" />
            <Stat label="In Progress" value={stats.inProgress} tone="text-blue-600" />
            <Stat label="Done" value={stats.done} tone="text-green-600" />
          </div>
        </section>

        {pipelineConfig && (
          <section className="mb-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-indigo-900">
              Pipeline Alignment Checklist
            </h3>
            <p className="mt-2 text-sm text-indigo-700">
              Official pipelines loaded: {Object.keys(pipelineConfig.pipelines || {}).join(', ')}.
              Confirm these stages match your roadmap tasks.
            </p>
          </section>
        )}

        {PHASE_ORDER.filter((phase) => groupedItems.has(phase)).map((phase) => {
          const phaseItems = groupedItems.get(phase) ?? [];
          return (
            <section key={phase} className="mb-6 rounded-2xl bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">{phase}</h3>
                <span className="text-sm font-semibold text-gray-500">
                  {phaseItems.filter((item) => item.status === 'Done').length} /{' '}
                  {phaseItems.length} complete
                </span>
              </div>
              <div className="space-y-3">
                {phaseItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-gray-200 p-4 transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => cycleStatus(item.id)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.status === 'Done'
                                ? 'bg-green-100 text-green-700'
                                : item.status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.status}
                          </button>
                          {item.priority && (
                            <span className="text-xs font-semibold text-red-600">
                              {item.priority}
                            </span>
                          )}
                          {item.recurring && (
                            <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-600">
                              Recurring
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 text-lg font-semibold text-gray-900">{item.title}</h4>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      {item.link && (
                        <a
                          href={item.link}
                          className="self-start rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
                        >
                          {item.linkLabel || 'Open'} →
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'text-gray-900' }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 text-center shadow-inner">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
