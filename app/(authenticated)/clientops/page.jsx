'use client';

import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { 
  Rocket, 
  FileCheck, 
  Box, 
  PlayCircle,
  ArrowRight,
  Receipt,
  Layers
} from 'lucide-react';

export default function ClientOpsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Client Operations"
          subtitle="Manage client journey from proposal to contract sign to delivery"
        />

        {/* Client Operations Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Client Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Proposals */}
            <div
              onClick={() => router.push('/client-operations/proposals')}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-green-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-green-100 p-3">
                  <FileCheck className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Proposals</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Create and manage client proposals.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                <span>View</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Work Packages */}
            <div
              onClick={() => router.push('/workpackages')}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-purple-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-purple-100 p-3">
                  <Box className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Work Packages</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Manage work packages and deliverables.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
                <span>View</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Execution */}
            <div
              onClick={() => router.push('/client-operations/execution')}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-orange-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-orange-100 p-3">
                  <PlayCircle className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Execution</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Execute and track work package delivery.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-600">
                <span>View</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Client Operations Hub */}
            <div
              onClick={() => router.push('/client-operations')}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-indigo-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-indigo-100 p-3">
                  <Rocket className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Client Operations</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Full client operations dashboard.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
                <span>View</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Billing */}
            <div
              onClick={() => router.push('/billing')}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-yellow-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-yellow-100 p-3">
                  <Receipt className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Billing</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Manage invoices and billing.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-yellow-600">
                <span>View</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Templates */}
            <div
              onClick={() => router.push('/templates')}
              className="cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-xl transition-all hover:border-teal-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-teal-100 p-3">
                  <Layers className="h-6 w-6 text-teal-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Templates</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Proposal and deliverable templates.
              </p>
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-600">
                <span>View</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
