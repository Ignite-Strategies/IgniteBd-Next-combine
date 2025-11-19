'use client';

import { useState, useEffect } from 'react';
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
  
  // Search states
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [workPackageSearchTerm, setWorkPackageSearchTerm] = useState('');
  const [companyResults, setCompanyResults] = useState([]);
  const [workPackageResults, setWorkPackageResults] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
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
    if (!companySearchTerm || !companyHQId) {
      setCompanyResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get(`/api/companies?companyHQId=${companyHQId}&query=${encodeURIComponent(companySearchTerm)}`);
        if (response.data?.success) {
          setCompanyResults(response.data.companies || []);
        }
      } catch (err) {
        console.error('Error searching companies:', err);
        setCompanyResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [companySearchTerm, companyHQId]);

  // Search work packages
  useEffect(() => {
    if (!workPackageSearchTerm || !companyHQId) {
      setWorkPackageResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get(`/api/workpackages?companyHQId=${companyHQId}&search=${encodeURIComponent(workPackageSearchTerm)}`);
        if (response.data?.success) {
          setWorkPackageResults(response.data.workPackages || []);
        }
      } catch (err) {
        console.error('Error searching work packages:', err);
        setWorkPackageResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [workPackageSearchTerm, companyHQId]);

  // Load work packages for selected company
  useEffect(() => {
    if (!selectedCompany?.id || !companyHQId) return;

    const loadWorkPackages = async () => {
      try {
        const response = await api.get(`/api/workpackages?companyHQId=${companyHQId}&contactCompanyId=${selectedCompany.id}`);
        if (response.data?.success && response.data.workPackages?.length > 0) {
          // Auto-select first work package if only one
          if (response.data.workPackages.length === 1) {
            hydrateWorkPackage(response.data.workPackages[0].id);
          } else {
            setWorkPackageResults(response.data.workPackages);
          }
        }
      } catch (err) {
        console.error('Error loading work packages for company:', err);
      }
    };

    loadWorkPackages();
  }, [selectedCompany, companyHQId]);

  // Hydrate work package
  const hydrateWorkPackage = async (workPackageId) => {
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
        
        // Set company if available (check both top-level contactCompany and nested)
        const company = wp.contactCompany || wp.contact?.contactCompany || wp.company;
        if (company) {
          setSelectedCompany({
            id: company.id,
            companyName: company.companyName,
          });
        }
      } else {
        setError('Failed to load work package');
      }
    } catch (err) {
      console.error('Error hydrating work package:', err);
      setError(err.response?.data?.error || 'Failed to load work package');
    } finally {
      setLoading(false);
    }
  };

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
          subtitle="Search for a work package and manage execution"
        />

        {/* Error message (inline, not a banner) */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Search Section */}
        {!workPackage && (
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
                    setSelectedCompany(null);
                  }}
                  placeholder="Type company name..."
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              {companyResults.length > 0 && (
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
            </div>

            {/* WorkPackage Search */}
            <div className="rounded-2xl bg-white p-6 shadow">
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Search by Work Package
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={workPackageSearchTerm}
                  onChange={(e) => {
                    setWorkPackageSearchTerm(e.target.value);
                    setSelectedWorkPackage(null);
                  }}
                  placeholder="Type work package title..."
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
              {workPackageResults.length > 0 && (
                <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                  {workPackageResults.map((wp) => (
                    <button
                      key={wp.id}
                      onClick={() => hydrateWorkPackage(wp.id)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium">{wp.title || 'Untitled Work Package'}</div>
                      {wp.contact && (
                        <div className="text-xs text-gray-500">
                          {wp.contact.firstName} {wp.contact.lastName}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Empty State - Single CTA */}
            {!companySearchTerm && !workPackageSearchTerm && !loading && (
              <div className="rounded-2xl bg-white p-12 text-center shadow">
                <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p className="text-lg font-semibold text-gray-800">Search for a Work Package</p>
                <p className="mt-2 text-sm text-gray-500">
                  Use the search bars above to find a work package by company or title
                </p>
              </div>
            )}
          </div>
        )}

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
              <label className="mb-2 block text-sm font-semibold text-gray-900">
                Priorities this week
              </label>
              <textarea
                value={prioritySummary}
                onChange={(e) => setPrioritySummary(e.target.value)}
                onBlur={savePriority}
                disabled={savingPriority}
                placeholder="Enter priorities for this week..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-gray-50"
                rows={4}
              />
              {savingPriority && (
                <div className="mt-2 text-xs text-gray-500">Saving...</div>
              )}
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

