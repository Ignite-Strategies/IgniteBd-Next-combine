'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  MessageSquare,
  TrendingUp,
  Map,
  Plus,
  Mail,
  Filter,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const SetupWizard = dynamic(() => import('@/components/SetupWizard'), {
  ssr: false,
});

function HeaderSummary({
  targetRevenue,
  currentRevenue,
  timeHorizon,
  onRoadmapClick,
  hasCompany,
  companyName,
}) {
  const progressPercent =
    targetRevenue > 0 ? (currentRevenue / targetRevenue) * 100 : 0;
  const remaining = Math.max(0, targetRevenue - currentRevenue);

  const progressColor =
    progressPercent >= 75
      ? 'from-green-500 to-green-600'
      : progressPercent >= 50
        ? 'from-yellow-500 to-yellow-600'
        : 'from-red-500 to-red-600';

  return (
    <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            {hasCompany ? `${companyName} Growth Dashboard` : 'Growth Dashboard'}
          </h1>
          <p className="text-gray-600">
            {hasCompany
              ? `Your command center for ${companyName}`
              : 'Your command center for business development'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {progressPercent.toFixed(1)}% to goal
            </div>
            <div className="text-sm text-gray-500">
              ${remaining.toLocaleString()} remaining
            </div>
          </div>
          {onRoadmapClick && (
            <button
              onClick={onRoadmapClick}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-4 py-2 text-white shadow-md transition hover:bg-indigo-700"
            >
              <Map className="h-4 w-4" />
              BD Roadmap
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 flex justify-between text-sm text-gray-600">
          <span>Current: ${currentRevenue.toLocaleString()}</span>
          <span>Target: ${targetRevenue.toLocaleString()}</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full bg-gradient-to-r ${progressColor}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="text-sm text-gray-500">
        Target: ${targetRevenue.toLocaleString()} in {timeHorizon} months
      </div>
    </div>
  );
}

function StackCard({ name, metrics, insight, icon, color, route }) {
  const router = useRouter();

  const hoverColors = useMemo(
    () => ({
      'bg-blue-500': 'hover:border-blue-400 hover:bg-blue-50 hover:shadow-lg',
      'bg-orange-500':
        'hover:border-orange-400 hover:bg-orange-50 hover:shadow-lg',
      'bg-purple-500':
        'hover:border-purple-400 hover:bg-purple-50 hover:shadow-lg',
    }),
    [],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(route)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          router.push(route);
        }
      }}
      className={`cursor-pointer rounded-xl border-2 border-gray-200 bg-white shadow-md transition-all duration-300 ${hoverColors[color]}`}
    >
      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${color} shadow-sm transition-transform group-hover:scale-110`}
          >
            {icon}
          </div>
          <h3 className="text-xl font-bold text-gray-900">{name}</h3>
        </div>

        <div className="mb-5 space-y-2.5">
          {metrics.map((metric) => (
            <div
              key={`${name}-${metric.label}`}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm font-medium text-gray-600">
                {metric.label}
              </span>
              <span className="text-base font-bold text-gray-900">
                {metric.value}
              </span>
            </div>
          ))}
        </div>

        <div className="-mx-6 rounded-b-xl bg-gray-50 px-6 pb-6 pt-4 text-sm italic text-gray-600">
          “{insight}”
        </div>
      </div>
    </div>
  );
}

export default function GrowthDashboardPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  const [companyHQ, setCompanyHQ] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get companyHQId and fetch data from API (no auto-hydration)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    if (!storedCompanyHQId) {
      setLoading(false);
      return;
    }

    // Fetch contacts and company data directly from API
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch contacts
        const contactsResponse = await api.get(`/api/contacts?companyHQId=${storedCompanyHQId}`);
        const contactsData = Array.isArray(contactsResponse.data) ? contactsResponse.data : [];
        setContacts(contactsData);

        // Try to get company from localStorage first (faster)
        try {
          const storedCompany = localStorage.getItem('companyHQ');
          if (storedCompany) {
            setCompanyHQ(JSON.parse(storedCompany));
          }
        } catch (err) {
          console.warn('Failed to parse stored company:', err);
        }

        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data');
        setContacts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const hasCompany = !!companyHQ && !!companyHQId;
  const companyName = companyHQ?.companyName ?? 'Your Company';

  // Calculate dashboard metrics from hydrated data - ensure stable defaults
  const dashboardMetrics = useMemo(() => {
    // Always return stable structure, even if contacts is undefined
    const contactsArray = Array.isArray(contacts) ? contacts : [];
    
    if (contactsArray.length === 0) {
      return {
        contactCount: 0,
        prospectCount: 0,
        clientCount: 0,
        eventsThisMonth: 0,
        meetingsScheduled: 0,
        campaignsActive: 0,
        newslettersSent: 0,
        responseRate: 0,
      };
    }

    const prospectCount = contactsArray.filter(
      (contact) => contact.pipeline?.pipeline === 'prospect',
    ).length;
    const clientCount = contactsArray.filter(
      (contact) => contact.pipeline?.pipeline === 'client',
    ).length;

    return {
      contactCount: contactsArray.length,
      prospectCount,
      clientCount,
      eventsThisMonth: 0,
      meetingsScheduled: 0,
      campaignsActive: 0,
      newslettersSent: 0,
      responseRate: 0,
    };
  }, [contacts]);

  // Move all hooks BEFORE any conditional returns to avoid React error #310
  const dashboardData = useMemo(() => ({
    targetRevenue: 1_000_000,
    currentRevenue: 0,
    timeHorizon: 12,
  }), []);

  // Memoize stackCards to prevent unnecessary re-renders and jerky updates
  const stackCards = useMemo(() => [
    {
      name: 'Attract',
      metrics: hasCompany
        ? [
            { label: 'Upcoming Events', value: '0' },
            { label: 'Ads & SEO Active', value: '0' },
            { label: 'Content Posts', value: '0' },
          ]
        : [
            { label: 'Upcoming Events', value: '—' },
            { label: 'Ads & SEO Active', value: '—' },
            { label: 'Content Posts', value: '—' },
          ],
      insight: hasCompany
        ? 'Start building your acquisition channels'
        : 'Set up your company to get started',
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      color: 'bg-blue-500',
      route: '/attract',
    },
    {
      name: 'Engage',
      metrics: hasCompany
        ? [
            {
              label: 'Contacts',
              value: dashboardMetrics.contactCount.toString(),
            },
            {
              label: 'Events This Month',
              value: dashboardMetrics.eventsThisMonth.toString(),
            },
            {
              label: 'Meetings Scheduled',
              value: dashboardMetrics.meetingsScheduled.toString(),
            },
          ]
        : [
            { label: 'Contacts', value: '—' },
            { label: 'Events This Month', value: '—' },
            { label: 'Meetings Scheduled', value: '—' },
          ],
      insight: hasCompany
        ? dashboardMetrics.contactCount > 0
          ? 'Building relationships with your network'
          : 'Start adding contacts and building relationships'
        : 'Set up your company to get started',
      icon: <Users className="h-6 w-6 text-white" />,
      color: 'bg-orange-500',
      route: '/contacts',
    },
    {
      name: 'Nurture',
      metrics: hasCompany
        ? [
            {
              label: 'Campaigns Active',
              value: dashboardMetrics.campaignsActive.toString(),
            },
            {
              label: 'Newsletters Sent',
              value: dashboardMetrics.newslettersSent.toString(),
            },
            {
              label: 'Response Rate',
              value: `${dashboardMetrics.responseRate}%`,
            },
          ]
        : [
            { label: 'Campaigns Active', value: '—' },
            { label: 'Newsletters Sent', value: '—' },
            { label: 'Response Rate', value: '—' },
          ],
      insight: hasCompany
        ? dashboardMetrics.campaignsActive > 0
          ? 'Nurturing relationships with your network'
          : 'Start nurturing your relationships'
        : 'Set up your company to get started',
      icon: <MessageSquare className="h-6 w-6 text-white" />,
      color: 'bg-purple-500',
      route: '/outreach',
    },
  ], [hasCompany, dashboardMetrics]);

  // Show loading screen while hydrating - AFTER all hooks are called
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            Getting your dashboard ready...
          </h2>
          <p className="text-gray-600">
            Loading your company data and metrics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 transition-opacity duration-300">
      {hasCompany && (
        <SetupWizard
          companyHQ={companyHQ}
          hasContacts={dashboardMetrics.contactCount > 0}
        />
      )}

      {!hasCompany && (
        <div className="mb-8 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
          <h2 className="mb-2 text-xl font-semibold text-yellow-900">
            Welcome to Ignite Strategies!
          </h2>
          <p className="mb-4 text-yellow-800">
            Set up your company profile to start building customer relationships
            and maximizing growth.
          </p>
          <button
            onClick={() => router.push('/company/create-or-choose')}
            className="rounded-lg bg-yellow-600 px-4 py-2 font-semibold text-white transition hover:bg-yellow-700"
          >
            Set Up Company →
          </button>
        </div>
      )}

      <HeaderSummary
        targetRevenue={dashboardData.targetRevenue}
        currentRevenue={dashboardData.currentRevenue}
        timeHorizon={dashboardData.timeHorizon}
        onRoadmapClick={() => router.push('/pipelines/roadmap')}
        hasCompany={hasCompany}
        companyName={companyName}
      />

      <div className="mb-8 rounded-xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            onClick={() => router.push('/contacts/upload')}
            className="group flex items-center gap-4 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 transition-transform group-hover:scale-110">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Upload Contacts</div>
              <div className="text-sm text-gray-600">
                Import a CSV or add contacts manually in one place.
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/contacts')}
            className="group flex items-center gap-4 rounded-lg border-2 border-purple-200 bg-purple-50 p-4 text-left transition hover:border-purple-300 hover:bg-purple-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500 transition-transform group-hover:scale-110">
              <Filter className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">People Hub</div>
              <div className="text-sm text-gray-600">
                Manage contacts, lists, companies, and pipelines.
              </div>
            </div>
          </button>

          <button
            onClick={() => router.push('/contacts/list-manager')}
            className="group flex items-center gap-4 rounded-lg border-2 border-green-200 bg-green-50 p-4 text-left transition hover:border-green-300 hover:bg-green-100"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500 transition-transform group-hover:scale-110">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Contact Lists</div>
              <div className="text-sm text-gray-600">
                Build and organize segments for outreach.
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="mb-8 flex flex-col items-center">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Growth Drivers
        </h2>
        <p className="max-w-2xl text-center text-xs text-gray-400">
          Attract (Ads, SEO, Content) • Engage (Connect, Events) • Nurture
          (Email Marketing)
        </p>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stackCards.map((card) => (
          <StackCard key={card.name} {...card} />
        ))}
      </div>
    </div>
  );
}
