'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import api from '@/lib/api';
import { getStatusOptions } from '@/lib/config/statusConfig';
import {
  Search,
  Loader,
  Package,
  Building2,
  Calendar,
  Edit3,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';

/**
 * Unified Execution Surface
 * 
 * Single UX for:
 * - Search by Company
 * - Search by WorkPackage
 * - View and edit WorkPackage
 * - Manage WorkPackageItems
 * - Create deliverables
 */

// Helper to get builder route from deliverableType
function getBuilderRoute(deliverableType, workPackageId, itemId) {
  const typeMap = {
    blog: '/builder/blog',
    persona: '/builder/persona',
    page: '/builder/landingpage',
    landing_page: '/builder/landingpage',
    deck: '/builder/cledeck',
    cledeck: '/builder/cledeck',
    template: '/builder/template',
    outreach_template: '/builder/template',
    event: '/builder/event',
    event_targets: '/builder/event',
  };

  const baseRoute = typeMap[deliverableType?.toLowerCase()] || '/builder/blog';
  return `${baseRoute}/new?workPackageId=${workPackageId}&itemId=${itemId}`;
}

export default function ExecutionPage() {
  const router = useRouter();
  const [companyHQId, setCompanyHQId] = useState('');
  
  // Company search
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  
  // Work package list (auto-loaded after company selection)
  const [workPackages, setWorkPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedWorkPackage, setSelectedWorkPackage] = useState(null);
  
  // WorkPackage data
  const [workPackage, setWorkPackage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Priority editor
  const [prioritySummary, setPrioritySummary] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);
  
  // Item status updates
  const [updatingStatus, setUpdatingStatus] = useState({});

  // Status options for dropdown (hydrated from config)
  const statusOptions = getStatusOptions(false); // false = owner view

  // Load companyHQId from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedHQId);
  }, []);

  // Search companies
  useEffect(() => {
    if (!companyHQId) {
      setCompanyResults([]);
      return;
    }

    // Don't search if search term is too short (less than 2 characters)
    if (companySearchTerm.length < 2) {
      setCompanyResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get(`/api/companies?companyHQId=${companyHQId}&query=${encodeURIComponent(companySearchTerm)}`);
        if (response.data?.success) {
          setCompanyResults(response.data.companies || []);
        } else {
          setCompanyResults([]);
        }
      } catch (err) {
        console.error('Error searching companies:', err);
        setCompanyResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [companySearchTerm, companyHQId]);

  // Hydrate work package
  const hydrateWorkPackage = useCallback(async (workPackageId) => {
    if (!workPackageId) return;

    setLoading(true);
    setError('');

    try {
      // Use hydrate route for full data
      const response = await api.get(`/api/workpackages/${workPackageId}/hydrate`);
      
      if (response.data?.success && response.data.workPackage) {
        const wp = response.data.workPackage;
        setWorkPackage(wp);
        setPrioritySummary(wp.prioritySummary || '');
        setSelectedWorkPackage({ id: wp.id, title: wp.title });
      } else {
        setError('Failed to load work package');
      }
    } catch (err) {
      console.error('Error hydrating work package:', err);
      setError(err.response?.data?.error || 'Failed to load work package');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load work packages when company is selected
  useEffect(() => {
    if (!selectedCompany?.id || !companyHQId) {
      setWorkPackages([]);
      setSelectedWorkPackage(null);
      setWorkPackage(null);
      return;
    }

    const loadWorkPackages = async () => {
      setLoadingPackages(true);
      try {
        const response = await api.get(`/api/workpackages?companyHQId=${companyHQId}&contactCompanyId=${selectedCompany.id}`);
        if (response.data?.success) {
          const packages = response.data.workPackages || [];
          setWorkPackages(packages);
          
          // Auto-select first work package if only one exists
          if (packages.length === 1) {
            hydrateWorkPackage(packages[0].id);
          } else {
            // Clear selection if multiple packages
            setSelectedWorkPackage(null);
            setWorkPackage(null);
          }
        }
      } catch (err) {
        console.error('Error loading work packages:', err);
        setError('Failed to load work packages');
      } finally {
        setLoadingPackages(false);
      }
    };

    loadWorkPackages();
  }, [selectedCompany, companyHQId, hydrateWorkPackage]);

  // Save priority summary
  const savePriority = async () => {
    if (!workPackage?.id) return;

    setSavingPriority(true);
    try {
      await api.patch(`/api/workpackages/${workPackage.id}`, {
        prioritySummary,
      });
    } catch (err) {
      console.error('Error saving priority:', err);
      setError('Failed to save priority summary');
    } finally {
      setSavingPriority(false);
    }
  };

  // Update item status
  const updateItemStatus = async (itemId, newStatus) => {
    setUpdatingStatus({ ...updatingStatus, [itemId]: true });
    
    try {
      await api.patch(`/api/workpackages/items/${itemId}`, {
        status: newStatus,
      });
      
      // Reload work package to get updated status
      if (workPackage?.id) {
        await hydrateWorkPackage(workPackage.id);
      }
    } catch (err) {
      console.error('Error updating item status:', err);
      setError('Failed to update item status');
    } finally {
      setUpdatingStatus({ ...updatingStatus, [itemId]: false });
    }
  };

  // Handle "Do this work item" button
  const handleDoWorkItem = (item) => {
    if (!workPackage?.id || !item?.id) return;
    
    const route = getBuilderRoute(item.deliverableType || item.itemType, workPackage.id, item.id);
    router.push(route);
  };

  // Get all items from phases and top-level
  const getAllItems = () => {
    const items = [];
    
    // Items from phases
    if (workPackage?.phases) {
      workPackage.phases.forEach((phase) => {
        if (phase.items) {
          items.push(...phase.items);
        }
      });
    }
    
    // Top-level items
    if (workPackage?.items) {
      items.push(...workPackage.items);
    }
    
    return items;
  };

  const items = getAllItems();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Execution"
          subtitle="Search for a company, then select a work package"
        />

        {/* Error message (inline, not a banner) */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Company Search & Work Package Selector */}
        <div className="mb-8 space-y-6">
          {/* Company Search */}
          <div className="rounded-2xl bg-white p-6 shadow">
            <label className="mb-2 block text-sm font-semibold text-gray-900">
              Search by Company
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={companySearchTerm}
                onChange={(e) => {
                  setCompanySearchTerm(e.target.value);
                  if (e.target.value !== selectedCompany?.companyName) {
                    setSelectedCompany(null);
                    setWorkPackages([]);
                    setWorkPackage(null);
                    setSelectedWorkPackage(null);
                  }
                }}
                placeholder="Type company name..."
                className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            {companySearchTerm.length >= 2 && companyResults.length > 0 && (
              <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                {companyResults.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => {
                      setSelectedCompany(company);
                      setCompanySearchTerm(company.companyName);
                      setCompanyResults([]);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <div className="font-medium">{company.companyName}</div>
                    {company.contacts?.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {company.contacts.length} contact{company.contacts.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {companySearchTerm.length >= 2 && companyResults.length === 0 && !loadingPackages && (
              <div className="mt-2 text-sm text-gray-500">
                No companies found matching "{companySearchTerm}"
              </div>
            )}
          </div>

          {/* Work Package Selector (shown after company selection) */}
          {selectedCompany && (
            <div className="rounded-2xl bg-white p-6 shadow">
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Select Work Package {selectedCompany.companyName && `for ${selectedCompany.companyName}`}
              </label>
              {loadingPackages ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500">Loading work packages...</span>
                </div>
              ) : workPackages.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-lg font-semibold text-gray-800">No work packages found</p>
                  <p className="mt-2 text-sm text-gray-500">
                    No work packages are available for {selectedCompany.companyName}
                  </p>
                </div>
              ) : (
                <select
                  value={selectedWorkPackage?.id || ''}
                  onChange={(e) => {
                    const wpId = e.target.value;
                    if (wpId) {
                      hydrateWorkPackage(wpId);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                >
                  <option value="">-- Select a work package --</option>
                  {workPackages.map((wp) => (
                    <option key={wp.id} value={wp.id}>
                      {wp.title || 'Untitled Work Package'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Empty State */}
          {!selectedCompany && !companySearchTerm && !workPackage && (
            <div className="rounded-2xl bg-white p-12 text-center shadow">
              <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-lg font-semibold text-gray-800">Search for a Company</p>
              <p className="mt-2 text-sm text-gray-500">
                Search for a company above to see their work packages
              </p>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl bg-white p-12 shadow">
            <Loader className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading work package...</span>
          </div>
        )}

        {/* WorkPackage Dashboard */}
        {workPackage && !loading && (
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{workPackage.title || 'Untitled Work Package'}</h2>
                  {(workPackage.contactCompany || workPackage.contact?.contactCompany || workPackage.company) && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      {(workPackage.contactCompany || workPackage.contact?.contactCompany || workPackage.company)?.companyName}
                    </div>
                  )}
                  {workPackage.description && (
                    <p className="mt-3 text-gray-600">{workPackage.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Created: {new Date(workPackage.createdAt).toLocaleDateString()}
                    </div>
                    {workPackage.updatedAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Updated: {new Date(workPackage.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Editor */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-semibold text-gray-900">
                  Priorities this week
                </label>
                <button
                  onClick={savePriority}
                  disabled={savingPriority || !prioritySummary.trim()}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {savingPriority ? 'Saving...' : 'Save'}
                </button>
              </div>
              <textarea
                value={prioritySummary}
                onChange={(e) => setPrioritySummary(e.target.value)}
                disabled={savingPriority}
                placeholder="Enter priorities for this week..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
                rows={4}
              />
            </div>

            {/* WorkPackage Items */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Work Items</h3>
              
              {items.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No work items found in this work package
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const itemLabel = item.deliverableLabel || item.itemLabel || 'Untitled Item';
                    const itemStatus = item.status || 'NOT_STARTED';
                    const deliverableType = item.deliverableType || item.itemType || 'blog';
                    const itemDescription = item.deliverableDescription || item.itemDescription;
                    
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{itemLabel}</div>
                          {itemDescription && (
                            <div className="mt-1 text-sm text-gray-500">
                              {itemDescription}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {/* Status Dropdown */}
                          <select
                            value={itemStatus}
                            onChange={(e) => updateItemStatus(item.id, e.target.value)}
                            disabled={updatingStatus[item.id]}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          {/* Do this work item button */}
                          <button
                            onClick={() => handleDoWorkItem(item)}
                            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                          >
                            <PlayCircle className="h-4 w-4" />
                            Do this work item
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

