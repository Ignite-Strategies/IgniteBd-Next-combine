'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

/**
 * useTemplates Hook
 * 
 * Manages Phase and Deliverable Templates with localStorage caching.
 * Loads from localStorage on mount, provides sync function for manual hydration.
 * 
 * @returns {Object} { phaseTemplates, deliverableTemplates, syncing, error, sync }
 */
export function useTemplates() {
  const [phaseTemplates, setPhaseTemplates] = useState([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Load from localStorage on mount - no auto-fetch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Load phase templates from localStorage
    const cachedPhaseTemplates = localStorage.getItem('phaseTemplates');
    if (cachedPhaseTemplates) {
      try {
        const parsed = JSON.parse(cachedPhaseTemplates);
        if (Array.isArray(parsed)) {
          console.log(`📦 Loaded ${parsed.length} phase templates from localStorage`);
          setPhaseTemplates(parsed);
        } else {
          console.warn('⚠️ Cached phase templates is not an array:', typeof parsed);
        }
      } catch (error) {
        console.warn('⚠️ Failed to parse cached phase templates', error);
      }
    } else {
      console.log('ℹ️ No cached phase templates found in localStorage');
    }
    
    // Also check if templates were stored by company hydration
    // Company hydration stores in companyHydration_{companyHQId}
    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (companyHQId && !cachedPhaseTemplates) {
      const hydrationKey = `companyHydration_${companyHQId}`;
      const hydrationData = window.localStorage.getItem(hydrationKey);
      if (hydrationData) {
        try {
          const parsed = JSON.parse(hydrationData);
          if (parsed.data?.phaseTemplates && Array.isArray(parsed.data.phaseTemplates)) {
            console.log(`📦 Found ${parsed.data.phaseTemplates.length} phase templates in company hydration cache`);
            setPhaseTemplates(parsed.data.phaseTemplates);
            // Also store in the direct key for consistency
            window.localStorage.setItem('phaseTemplates', JSON.stringify(parsed.data.phaseTemplates));
          }
          if (parsed.data?.deliverableTemplates && Array.isArray(parsed.data.deliverableTemplates)) {
            console.log(`📦 Found ${parsed.data.deliverableTemplates.length} deliverable templates in company hydration cache`);
            setDeliverableTemplates(parsed.data.deliverableTemplates);
            // Also store in the direct key for consistency
            window.localStorage.setItem('deliverableTemplates', JSON.stringify(parsed.data.deliverableTemplates));
          }
        } catch (err) {
          console.warn('⚠️ Failed to parse company hydration data:', err);
        }
      }
    }

    // Load deliverable templates from localStorage
    const cachedDeliverableTemplates = localStorage.getItem('deliverableTemplates');
    if (cachedDeliverableTemplates) {
      try {
        const parsed = JSON.parse(cachedDeliverableTemplates);
        if (Array.isArray(parsed)) {
          setDeliverableTemplates(parsed);
        }
      } catch (error) {
        console.warn('Failed to parse cached deliverable templates', error);
      }
    }
  }, []);

  // Sync function - fetches from API and updates localStorage
  const sync = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      setSyncing(true);
      setError(null);

      // Get companyHQId from localStorage
      const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');

      if (!companyHQId) {
        setError('CompanyHQ ID not found');
        setSyncing(false);
        return;
      }

      console.log(`🔄 Syncing templates for companyHQId: ${companyHQId}`);

      const [phasesRes, deliverablesRes] = await Promise.all([
        api.get(`/api/templates/phases?companyHQId=${companyHQId}`),
        api.get(`/api/templates/deliverables?companyHQId=${companyHQId}`),
      ]);

      console.log('📦 Phase templates response:', {
        success: phasesRes.data?.success,
        count: phasesRes.data?.phaseTemplates?.length || 0,
        sample: phasesRes.data?.phaseTemplates?.[0],
      });

      if (phasesRes.data?.success) {
        const phases = phasesRes.data.phaseTemplates || [];
        console.log(`✅ Setting ${phases.length} phase templates:`, phases.map(p => p.name));
        setPhaseTemplates(phases);
        localStorage.setItem('phaseTemplates', JSON.stringify(phases));
        console.log('💾 Stored phase templates in localStorage');
      } else {
        console.warn('⚠️ Phase templates response not successful:', phasesRes.data);
        setError('Failed to load phase templates');
      }

      if (deliverablesRes.data?.success) {
        const deliverables = deliverablesRes.data.deliverableTemplates || [];
        setDeliverableTemplates(deliverables);
        localStorage.setItem('deliverableTemplates', JSON.stringify(deliverables));
      } else {
        console.warn('Deliverable templates response not successful:', deliverablesRes.data);
        if (!error) {
          setError('Failed to load deliverable templates');
        }
      }
    } catch (err) {
      console.error('Error syncing templates:', err);
      setError(err.response?.data?.error || 'Failed to sync templates from server');
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    phaseTemplates,
    deliverableTemplates,
    syncing,
    error,
    sync,
  };
}

