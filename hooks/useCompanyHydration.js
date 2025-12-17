'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

/**
 * useCompanyHydration Hook
 * 
 * Comprehensive hydration hook for companyHQ data.
 * Fetches and stores all company-related data in localStorage.
 * 
 * TODO WEDNESDAY FIX #1: Company hydration cache is cleared during tenant switch
 * localStorage key pattern: companyHydration_${companyHQId}
 * 
 * @param {string} companyHQId - CompanyHQ ID to hydrate
 * @returns {Object} { data, loading, hydrated, error, refresh }
 */
export function useCompanyHydration(companyHQId) {
  const [data, setData] = useState({
    companyHQ: null,
    personas: [],
    contacts: [],
    products: [],
    pipelines: [],
    proposals: [],
    phaseTemplates: [],
    deliverableTemplates: [],
    workPackages: [],
    presentations: [],
    blogs: [],
    templates: [],
    landingPages: [],
    stats: {
      personaCount: 0,
      contactCount: 0,
      productCount: 0,
      pipelineCount: 0,
      proposalCount: 0,
      prospectCount: 0,
      clientCount: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState(null);

  // Load from localStorage on mount - no auto-fetch, no stale checks
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!companyHQId) {
      setLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(`companyHydration_${companyHQId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.data) {
          // Ensure presentations and other content types are included
          const hydratedData = {
            ...parsed.data,
            presentations: parsed.data.presentations || [],
            blogs: parsed.data.blogs || [],
            templates: parsed.data.templates || [],
            landingPages: parsed.data.landingPages || [],
          };
          setData(hydratedData);
          setHydrated(true);
        }
      } else {
        // Fallback: Try to load presentations from the presentations-specific key
        // This handles cases where presentations were saved separately
        try {
          const presentationsKey = `presentations_${companyHQId}`;
          const cachedPresentations = localStorage.getItem(presentationsKey);
          if (cachedPresentations) {
            const presentations = JSON.parse(cachedPresentations);
            setData((prev) => ({
              ...prev,
              presentations: Array.isArray(presentations) ? presentations : [],
            }));
          }
        } catch (e) {
          console.warn('Failed to load presentations from fallback key:', e);
        }
      }
    } catch (err) {
      console.warn('Failed to load company hydration from localStorage:', err);
    }

    setLoading(false);
  }, [companyHQId]);

  // Refresh from API
  const refresh = useCallback(async () => {
    if (!companyHQId) {
      setError('companyHQId is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/api/company/hydrate?companyHQId=${companyHQId}`);

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to hydrate company data');
      }

      const hydratedData = {
        companyHQ: response.data.companyHQ || null,
        personas: response.data.personas || [],
        contacts: response.data.contacts || [],
        products: response.data.products || [],
        pipelines: response.data.pipelines || [],
        proposals: response.data.proposals || [],
        phaseTemplates: response.data.phaseTemplates || [],
        deliverableTemplates: response.data.deliverableTemplates || [],
        workPackages: response.data.workPackages || [],
        presentations: response.data.presentations || [],
        blogs: response.data.blogs || [],
        templates: response.data.templates || [],
        landingPages: response.data.landingPages || [],
        stats: response.data.stats || {
          personaCount: 0,
          contactCount: 0,
          productCount: 0,
          pipelineCount: 0,
          proposalCount: 0,
          prospectCount: 0,
          clientCount: 0,
        },
      };

      // Update state
      setData(hydratedData);
      setHydrated(true);

      // Update localStorage
      const storageData = {
        data: hydratedData,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(
        `companyHydration_${companyHQId}`,
        JSON.stringify(storageData),
      );

      // Also update individual keys for easy access
      if (hydratedData.companyHQ) {
        localStorage.setItem('companyHQ', JSON.stringify(hydratedData.companyHQ));
        localStorage.setItem('companyHQId', companyHQId);
      }
      localStorage.setItem('personas', JSON.stringify(hydratedData.personas));
      localStorage.setItem('personaId', hydratedData.personas[0]?.id || null);
      localStorage.setItem('contacts', JSON.stringify(hydratedData.contacts));
      localStorage.setItem('products', JSON.stringify(hydratedData.products));
      localStorage.setItem('workPackages', JSON.stringify(hydratedData.workPackages));
      localStorage.setItem('pipelines', JSON.stringify(hydratedData.pipelines));
      localStorage.setItem('proposals', JSON.stringify(hydratedData.proposals));
      localStorage.setItem('phaseTemplates', JSON.stringify(hydratedData.phaseTemplates));
      localStorage.setItem('deliverableTemplates', JSON.stringify(hydratedData.deliverableTemplates));
      // Store presentations in both the hook key and the presentations-specific key
      localStorage.setItem('presentations', JSON.stringify(hydratedData.presentations));
      localStorage.setItem(`presentations_${companyHQId}`, JSON.stringify(hydratedData.presentations));
      // Store blogs in both the hook key and the blogs-specific key
      localStorage.setItem('blogs', JSON.stringify(hydratedData.blogs));
      localStorage.setItem(`blogs_${companyHQId}`, JSON.stringify(hydratedData.blogs));
      localStorage.setItem('templates', JSON.stringify(hydratedData.templates));
      localStorage.setItem('landingPages', JSON.stringify(hydratedData.landingPages));

      setLoading(false);
    } catch (err) {
      console.error('Error hydrating company data:', err);
      setError(err.message || 'Failed to hydrate company data');
      setLoading(false);
    }
  }, [companyHQId]);

  return {
    data,
    loading,
    hydrated,
    error,
    refresh,
    // Convenience getters
    companyHQ: data.companyHQ,
    personas: data.personas,
    contacts: data.contacts,
    products: data.products,
    pipelines: data.pipelines,
    proposals: data.proposals,
    phaseTemplates: data.phaseTemplates,
    deliverableTemplates: data.deliverableTemplates,
    workPackages: data.workPackages,
    presentations: data.presentations,
    blogs: data.blogs,
    templates: data.templates,
    landingPages: data.landingPages,
    stats: data.stats,
  };
}

