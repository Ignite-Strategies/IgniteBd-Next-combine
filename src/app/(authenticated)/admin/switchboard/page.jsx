'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Users, FileText, ArrowRight, Plus, Shield } from 'lucide-react';
import api from '@/lib/api';
import { switchTenant } from '@/lib/tenant';

export default function TenantSwitchboard() {
  const router = useRouter();
  const [companyHQs, setCompanyHQs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if user is SuperAdmin
        const ownerResponse = await api.get('/api/owner/hydrate');
        if (ownerResponse.data?.success) {
          const isAdmin = ownerResponse.data.isSuperAdmin === true;
          setIsSuperAdmin(isAdmin);

          if (!isAdmin) {
            // Not SuperAdmin, redirect to dashboard
            router.push('/growth-dashboard');
            return;
          }

          // Fetch all CompanyHQs
          const hqsResponse = await api.get('/api/admin/companyhqs');
          if (hqsResponse.data?.success) {
            setCompanyHQs(hqsResponse.data.companyHQs || []);
          }
        }
      } catch (error) {
        console.error('Error loading switchboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleSwitchTenant = (companyHQId) => {
    switchTenant(companyHQId);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-gray-600">Loading switchboard...</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tenant Switchboard</h1>
              <p className="text-gray-600">SuperAdmin - Manage all CompanyHQs</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin/companyhq/create')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            Create CompanyHQ
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold text-gray-900">{companyHQs.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Contacts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {companyHQs.reduce((sum, hq) => sum + (hq._count?.contacts || 0), 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Total Proposals</p>
                <p className="text-2xl font-bold text-gray-900">
                  {companyHQs.reduce((sum, hq) => sum + (hq._count?.proposals || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CompanyHQ List */}
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900">All CompanyHQs</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {companyHQs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p>No CompanyHQs found</p>
                <button
                  onClick={() => router.push('/admin/companyhq/create')}
                  className="mt-4 text-blue-600 hover:text-blue-700"
                >
                  Create your first CompanyHQ
                </button>
              </div>
            ) : (
              companyHQs.map((hq) => (
                <div
                  key={hq.id}
                  className="p-6 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {hq.companyName}
                        </h3>
                        {hq.ultraTenantId === null && (
                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
                            Ultra Tenant
                          </span>
                        )}
                        {hq.ultraTenantId === 'cmhmdw78k0001mb1vioxdw2g8' && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                            Child of Ignite Strategies
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 md:grid-cols-4">
                        <div>
                          <span className="font-medium">ID:</span> {hq.id}
                        </div>
                        {hq.owner && (
                          <div>
                            <span className="font-medium">Owner:</span>{' '}
                            {hq.owner.name || hq.owner.email}
                          </div>
                        )}
                        {hq.manager && (
                          <div>
                            <span className="font-medium">Manager:</span>{' '}
                            {hq.manager.name || hq.manager.email}
                          </div>
                        )}
                        {hq.contactOwner && (
                          <div>
                            <span className="font-medium">Contact Owner:</span>{' '}
                            {hq.contactOwner.firstName} {hq.contactOwner.lastName}
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex gap-4 text-sm text-gray-500">
                        <span>
                          <Users className="mr-1 inline h-4 w-4" />
                          {hq._count?.contacts || 0} contacts
                        </span>
                        <span>
                          <Building2 className="mr-1 inline h-4 w-4" />
                          {hq._count?.companies || 0} companies
                        </span>
                        <span>
                          <FileText className="mr-1 inline h-4 w-4" />
                          {hq._count?.proposals || 0} proposals
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        Created: {new Date(hq.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSwitchTenant(hq.id)}
                      className="ml-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Enter Tenant
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

