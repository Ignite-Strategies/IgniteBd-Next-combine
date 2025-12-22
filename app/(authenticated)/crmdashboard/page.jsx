'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  MessageSquare,
  List,
  GitBranch,
  Building2,
} from 'lucide-react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
import { useCompanyHydration } from '@/hooks/useCompanyHydration';

function ActionCard({ name, description, icon: Icon, route, color }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(route)}
      className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 hover:border-red-300"
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{name}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function CRMDashboardPage() {
  const { companyHQId, loading: companyLoading, hydrated: companyHydrated } = useCompanyHQ();
  const { data, loading, hydrated, refresh } = useCompanyHydration(companyHQId);
  
  const companyHQ = data.companyHQ;
  const contacts = data.contacts || [];

  const hasCompany = !!companyHQ && !!companyHQId;
  const companyName = companyHQ?.companyName ?? 'Your Company';

  const contactCount = Array.isArray(contacts) ? contacts.length : 0;

  // If no companyHQId and company is hydrated, redirect to welcome to select company
  useEffect(() => {
    if (!companyLoading && companyHydrated && !companyHQId) {
      console.warn('CRMDashboard: No companyHQId, redirecting to welcome');
      router.push('/welcome');
    }
  }, [companyHQId, companyLoading, companyHydrated, router]);

  const actionCards = [
    {
      name: 'People',
      description: 'Manage your contacts and relationships',
      icon: Users,
      route: '/people',
      color: 'bg-blue-500',
    },
    {
      name: 'Lists',
      description: 'Organize contacts into lists for targeted outreach',
      icon: List,
      route: '/people/lists',
      color: 'bg-purple-500',
    },
    {
      name: 'Outreach',
      description: 'Create and manage email campaigns',
      icon: MessageSquare,
      route: '/outreach',
      color: 'bg-green-500',
    },
    {
      name: 'Pipeline',
      description: 'Track deals and opportunities',
      icon: GitBranch,
      route: '/pipelines/roadmap',
      color: 'bg-orange-500',
    },
    {
      name: 'Company Hub',
      description: 'View and manage company information',
      icon: Building2,
      route: '/companies',
      color: 'bg-indigo-500',
    },
  ];

  // Show loading if companyHQ is not ready or data is loading
  if (companyLoading || !companyHydrated || loading || (!hydrated && companyHQId)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // If no companyHQId after hydration, show message (redirect will happen via useEffect)
  if (!companyHQId) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {hasCompany ? `${companyName} CRM Dashboard` : 'CRM Dashboard'}
        </h1>
        <p className="text-gray-600">
          {hasCompany
            ? `Manage your contacts and outreach for ${companyName}`
            : 'Manage your contacts and outreach'}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-600">Total Contacts</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{contactCount}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <h3 className="text-sm font-medium text-gray-600">Active Campaigns</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <GitBranch className="h-5 w-5 text-orange-500" />
            <h3 className="text-sm font-medium text-gray-600">Deals in Pipeline</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">0</p>
        </div>
      </div>

      {/* Action Cards */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((card) => (
            <ActionCard key={card.route} {...card} />
          ))}
        </div>
      </div>
    </div>
  );
}

