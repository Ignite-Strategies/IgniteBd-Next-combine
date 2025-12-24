'use client';

import { useState, useEffect, useMemo } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import api from '@/lib/api';
import { useOwner } from '@/hooks/useOwner';

/**
 * CompanySelector Component - SEARCH FIRST
 * Modular component for selecting or creating companies
 * No dependencies on companyId - works standalone
 */
export default function CompanySelector({ 
  companyId, 
  onCompanySelect,
  selectedCompany,
  showLabel = true,
  className = '',
  placeholder = 'Search companies...',
  allowCreate = true,
}) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const { ownerId, hydrated: ownerHydrated } = useOwner();

  // Get companyHQId from localStorage
  const getCompanyHQId = () => {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      null
    );
  };

  // Fetch companies from API when search term changes - WAIT FOR AUTH
  useEffect(() => {
    // CRITICAL: Wait for auth to be ready before making API calls
    if (!ownerId || !ownerHydrated) {
      // Auth not ready yet - wait
      return;
    }
    
    const companyHQId = getCompanyHQId();
    if (!companyHQId) {
      setCompanies([]);
      return;
    }

    // Don't search if search term is too short
    if (companySearch.length < 1) {
      setCompanies([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await api.get(
          `/api/companies?companyHQId=${companyHQId}&query=${encodeURIComponent(companySearch)}`
        );
        if (response.data?.success) {
          setCompanies(response.data.companies || []);
        } else {
          setCompanies([]);
        }
      } catch (err) {
        console.error('Error searching companies:', err);
        setCompanies([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [companySearch, ownerId, ownerHydrated]); // Wait for auth before searching

  // Set initial search value if company is selected
  const selectedCompanyObj = useMemo(() => {
    if (selectedCompany) return selectedCompany;
    if (selectedCompanyId && companies.length > 0) {
      return companies.find((c) => c.id === selectedCompanyId);
    }
    return null;
  }, [selectedCompany, selectedCompanyId, companies]);

  // Initialize with existing company name when component mounts or selectedCompany changes
  useEffect(() => {
    if (selectedCompanyObj) {
      // Only set if search is empty or doesn't match the selected company
      const currentSearch = companySearch.toLowerCase().trim();
      const selectedName = (selectedCompanyObj.companyName || '').toLowerCase().trim();
      if (!companySearch || currentSearch !== selectedName) {
        setCompanySearch(selectedCompanyObj.companyName || '');
      }
    }
  }, [selectedCompanyObj]);

  // Filter available companies
  const availableCompanies = useMemo(() => {
    if (!companySearch || !companySearch.trim()) {
      return [];
    }
    
    // If a company is selected and search matches exactly, don't show dropdown
    if (selectedCompanyObj) {
      const selectedName = (selectedCompanyObj.companyName || '').toLowerCase().trim();
      const searchLower = companySearch.toLowerCase().trim();
      
      // If search exactly matches selected company, hide dropdown
      if (searchLower === selectedName) {
        return [];
      }
    }
    
    // Only show companies that match the search
    const searchLower = companySearch.toLowerCase().trim();
    return companies
      .filter(c => {
        const companyName = (c.companyName || '').toLowerCase();
        return companyName.includes(searchLower);
      })
      .slice(0, 20);
  }, [companies, companySearch, selectedCompanyObj]);

  // Handle company selection
  const handleSelectCompany = (company) => {
    setSelectedCompanyId(company.id);
    setCompanySearch(company.companyName);
    setCompanies([]);
    if (onCompanySelect) {
      onCompanySelect(company);
    }
  };

  // Handle create new company
  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    // CRITICAL: Wait for auth to be ready
    if (!ownerId || !ownerHydrated) {
      alert('Please wait for authentication to complete.');
      return;
    }

    const companyHQId = getCompanyHQId();
    if (!companyHQId) {
      alert('CompanyHQ ID not found. Please refresh the page.');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/api/companies', {
        companyHQId,
        companyName: newCompanyName.trim(),
      });

      if (response.data?.success && response.data.company) {
        const newCompany = response.data.company;
        handleSelectCompany(newCompany);
        setShowCreateForm(false);
        setNewCompanyName('');
      } else {
        alert(response.data?.error || 'Failed to create company');
      }
    } catch (error) {
      console.error('Error creating company:', error);
      alert(error.response?.data?.error || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div 
      className={`relative ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showLabel && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Company
        </label>
      )}
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
        <input
          type="text"
          value={companySearch}
          onChange={(e) => {
            e.stopPropagation();
            const newValue = e.target.value;
            setCompanySearch(newValue);
            // Clear selected company if user is typing something different
            if (selectedCompanyObj && newValue.toLowerCase().trim() !== (selectedCompanyObj.companyName || '').toLowerCase().trim()) {
              setSelectedCompanyId(null);
              if (onCompanySelect) {
                onCompanySelect(null);
              }
            }
            // Hide create form when typing
            if (showCreateForm) {
              setShowCreateForm(false);
              setNewCompanyName('');
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => {
            e.stopPropagation();
            // If we have a selected company, keep it in search but allow editing
            if (selectedCompanyObj && !companySearch) {
              setCompanySearch(selectedCompanyObj.companyName || '');
            }
          }}
          placeholder={selectedCompanyObj?.companyName || placeholder}
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Dropdown Results */}
      {companySearch.length >= 1 && availableCompanies.length > 0 && (
        <div 
          className="absolute z-10 mt-1 max-h-60 w-full space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {availableCompanies.map((company) => (
            <button
              key={company.id}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectCompany(company);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
            >
              <div className="font-medium">{company.companyName}</div>
              {company.industry && (
                <div className="text-xs text-gray-500">{company.industry}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results - show create option (only if search doesn't match selected company) */}
      {companySearch.length >= 1 && 
       availableCompanies.length === 0 && 
       !loading && 
       allowCreate && 
       !showCreateForm &&
       (!selectedCompanyObj || selectedCompanyObj.companyName?.toLowerCase() !== companySearch.toLowerCase()) && (
        <div 
          className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm text-gray-500 mb-2">
            No companies found matching "{companySearch}"
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNewCompanyName(companySearch);
              setShowCreateForm(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create "{companySearch}"
          </button>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div 
          className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={newCompanyName || companySearch}
              onChange={(e) => {
                e.stopPropagation();
                setNewCompanyName(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Enter company name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (newCompanyName || companySearch).trim()) {
                  e.preventDefault();
                  e.stopPropagation();
                  setNewCompanyName(newCompanyName || companySearch);
                  handleCreateCompany();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowCreateForm(false);
                  setNewCompanyName('');
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nameToCreate = newCompanyName || companySearch;
                if (!nameToCreate.trim()) {
                  alert('Please enter a company name');
                  return;
                }
                setNewCompanyName(nameToCreate);
                handleCreateCompany();
              }}
              disabled={creating || !(newCompanyName || companySearch).trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create Company'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateForm(false);
                setNewCompanyName('');
                // Reset search to selected company if exists
                if (selectedCompanyObj) {
                  setCompanySearch(selectedCompanyObj.companyName || '');
                }
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selected Company Display - Show when company is selected and search matches */}
      {selectedCompanyObj && 
       companySearch.trim() && 
       companySearch.toLowerCase().trim() === (selectedCompanyObj.companyName || '').toLowerCase().trim() && 
       !showCreateForm && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2">
          <Building2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            {selectedCompanyObj.companyName}
          </span>
          <span className="text-xs text-green-600">(Selected)</span>
        </div>
      )}
    </div>
  );
}
