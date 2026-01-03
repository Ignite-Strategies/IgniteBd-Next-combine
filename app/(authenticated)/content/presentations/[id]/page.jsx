'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PageHeader from '@/components/PageHeader.jsx';
import { Save, ArrowLeft, FileText, Loader2 } from 'lucide-react';
import api from '@/lib/api';

// 🎯 LOCAL-FIRST FLAG: API fallback is optional and explicit only
const ENABLE_PRESENTATION_API_FALLBACK = true;

export default function PresentationPage() {
  // 1. Constants / params / flags
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presentationId = params.id;
  
  // Read companyHQId from URL params, with fallback to localStorage
  const urlCompanyHQId = searchParams?.get('companyHQId') || '';
  const [companyHQId, setCompanyHQId] = useState(urlCompanyHQId);
  const hasRedirectedRef = useRef(false);
  
  // Fallback: If not in URL, check localStorage and redirect
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (urlCompanyHQId) {
      setCompanyHQId(urlCompanyHQId);
      return;
    }
    
    if (typeof window === 'undefined') return;
    
    const storedCompanyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId');
    if (storedCompanyHQId) {
      hasRedirectedRef.current = true;
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('companyHQId', storedCompanyHQId);
      router.replace(currentUrl.pathname + currentUrl.search);
      setCompanyHQId(storedCompanyHQId);
    }
  }, [urlCompanyHQId, router]);

  // 2. State declarations
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slides, setSlides] = useState([]);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gammaStatus, setGammaStatus] = useState(null);
  const [gammaDeckUrl, setGammaDeckUrl] = useState(null);
  const [gammaPptxUrl, setGammaPptxUrl] = useState(null);
  const [gammaGenerationId, setGammaGenerationId] = useState(null);
  const [buildingPPT, setBuildingPPT] = useState(false);
  const [showErrorStatus, setShowErrorStatus] = useState(false); // Only show error if user tried to generate
  const [authReady, setAuthReady] = useState(false);

  // 3. Helper functions (must be declared before useEffects that use them)
  // Helper function to set presentation data from either localStorage or API
  const setPresentationData = (presentation) => {
    setTitle(presentation.title || '');
    setDescription(presentation.description || '');
    
    // Handle slides format - could be { sections: [...] } or array or string
    let slidesData = [];
    if (presentation.slides) {
      if (typeof presentation.slides === 'string') {
        try {
          const parsed = JSON.parse(presentation.slides);
          if (parsed.sections && Array.isArray(parsed.sections)) {
            // Convert sections format to array format for editing
            slidesData = parsed.sections.map((section, idx) => ({
              slideNumber: idx + 1,
              title: section.title || '',
              content: Array.isArray(section.bullets) ? section.bullets.join('\n') : (section.bullets || ''),
            }));
          } else if (Array.isArray(parsed)) {
            slidesData = parsed;
          }
        } catch (e) {
          console.warn('Failed to parse slides JSON:', e);
        }
      } else if (presentation.slides.sections && Array.isArray(presentation.slides.sections)) {
        // Convert sections format to array format for editing
        slidesData = presentation.slides.sections.map((section, idx) => ({
          slideNumber: idx + 1,
          title: section.title || '',
          content: Array.isArray(section.bullets) ? section.bullets.join('\n') : (section.bullets || ''),
        }));
      } else if (Array.isArray(presentation.slides)) {
        slidesData = presentation.slides;
      }
    }
    setSlides(slidesData);
    
    setPublished(presentation.published || false);
    const status = presentation.gammaStatus || null;
    setGammaStatus(status);
    setGammaDeckUrl(presentation.gammaDeckUrl || null);
    setGammaPptxUrl(presentation.gammaPptxUrl || null);
    setGammaGenerationId(presentation.gammaGenerationId || null);
    // Only show error status box if status is 'ready' or 'generating' on load
    // Don't show 'error' status on page load - only show if user tries to generate
    setShowErrorStatus(status === 'ready' || status === 'generating');
  };

  // 🎯 LOCAL-FIRST: Hydrate from localStorage (deterministic, runs once)
  const hydrateFromLocalStorage = async () => {
    // Check prerequisites inside function (not in useEffect deps)
    if (!presentationId) {
      setLoading(false);
      return;
    }

    // Wait for auth if needed (check synchronously, don't block)
    if (typeof window !== 'undefined') {
      // Give auth a moment to initialize if needed
      let attempts = 0;
      while (!authReady && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
    
    try {
      setLoading(true);
      setError('');

      // 🎯 LOCAL-FIRST: Try to load from localStorage first
      let presentation = null;
      
      if (typeof window !== 'undefined') {
        const id = companyHQId || localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
        
        // Try presentations_${id} first
        if (id) {
          const cachedKey = `presentations_${id}`;
          const cached = localStorage.getItem(cachedKey);
          if (cached) {
            try {
              const presentations = JSON.parse(cached);
              if (Array.isArray(presentations)) {
                presentation = presentations.find(p => p.id === presentationId);
                if (presentation) {
                  console.log('✅ [LOCAL-FIRST] Loaded presentation from localStorage');
                }
              }
            } catch (e) {
              console.warn('[LOCAL-FIRST] Failed to parse cached presentations:', e);
            }
          }
        }
        
        // Try hydration data as fallback
        if (!presentation && id) {
          const hydrationKey = `companyHydration_${id}`;
          const hydrationData = localStorage.getItem(hydrationKey);
          if (hydrationData) {
            try {
              const parsed = JSON.parse(hydrationData);
              if (parsed?.data?.presentations && Array.isArray(parsed.data.presentations)) {
                presentation = parsed.data.presentations.find(p => p.id === presentationId);
                if (presentation) {
                  console.log('✅ [LOCAL-FIRST] Loaded presentation from hydration data');
                }
              }
            } catch (e) {
              console.warn('[LOCAL-FIRST] Failed to parse hydration data:', e);
            }
          }
        }
      }

      // 🎯 LOCAL-FIRST: If found locally, use it and skip API
      if (presentation) {
        setPresentationData(presentation);
        setLoading(false);
        return; // Skip API call entirely
      }

      // 🎯 LOCAL-FIRST: Not found locally - use API as fallback (if enabled)
      if (!ENABLE_PRESENTATION_API_FALLBACK) {
        console.warn('⚠️ [LOCAL-FIRST] Presentation not found locally and API fallback is disabled');
        setError('Presentation not found in local storage. API fallback is disabled.');
        setLoading(false);
        return;
      }

      console.warn('⚠️ [LOCAL-FIRST] Presentation not found locally — using API fallback');
      
      // API fallback
      const response = await api.get(`/api/content/presentations/${presentationId}`);
      if (response.data?.success) {
        presentation = response.data.presentation;
        
        // 🎯 LOCAL-FIRST: Save to localStorage for future use
        if (typeof window !== 'undefined' && presentation) {
          const saveId = companyHQId || localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
          if (saveId) {
            try {
              const cachedKey = `presentations_${saveId}`;
              const cached = localStorage.getItem(cachedKey);
              const presentations = cached ? JSON.parse(cached) : [];
              const existingIndex = presentations.findIndex(p => p.id === presentation.id);
              if (existingIndex >= 0) {
                presentations[existingIndex] = presentation;
              } else {
                presentations.unshift(presentation);
              }
              localStorage.setItem(cachedKey, JSON.stringify(presentations));
              console.log('✅ [LOCAL-FIRST] Saved presentation to localStorage from API fallback');
            } catch (e) {
              console.warn('[LOCAL-FIRST] Failed to save to localStorage:', e);
            }
          }
        }
        
        setPresentationData(presentation);
      }
    } catch (err) {
      console.error('❌ [LOCAL-FIRST] Error loading presentation:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.details || 
                          err.message || 
                          'Failed to load presentation';
      setError(errorMessage);
      
      // If it's a 404, the presentation might not exist
      if (err.response?.status === 404) {
        setError('Presentation not found. It may have been deleted.');
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. useEffect hooks
  // Wait for Firebase auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setAuthReady(true);
      } else {
        // No user - redirect to signin
        router.replace('/signin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 🎯 LOCAL-FIRST: Single deterministic hydration (runs once on mount)
  useEffect(() => {
    hydrateFromLocalStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - runs once, all logic inside function

  // Poll for generation status when status is 'generating' (calm, resilient async flow)
  useEffect(() => {
    if (gammaStatus !== 'generating' || !gammaGenerationId || !presentationId) {
      return;
    }

    console.log('🔄 Starting Gamma status polling:', {
      generationId: gammaGenerationId,
      presentationId,
      pollInterval: '10 seconds',
      maxPolls: 30,
      maxTimeout: '5 minutes',
    });
    
    let pollCount = 0;
    const MAX_POLLS = 30; // 5 minutes at 10 seconds per poll
    const POLL_INTERVAL = 10000; // 10 seconds (minimum 8 seconds per requirements)
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      try {
        const response = await api.get(`/api/decks/status/${gammaGenerationId}?presentationId=${presentationId}`);
        
        if (response.data?.success) {
          const status = response.data.status;
          
          // Log status response payload
          console.log(`📊 Gamma status poll #${pollCount}:`, {
            generationId: gammaGenerationId,
            status,
            id: response.data.id,
            url: response.data.url,
            pptxUrl: response.data.pptxUrl,
            error: response.data.error,
          });
          
          // Handle status explicitly
          // Gamma API returns 'completed' but we map it to 'ready' in the backend
          if (status === 'ready' && response.data.url) {
            // Generation complete - stop polling immediately
            console.log('✅ Generation complete!', {
              generationId: gammaGenerationId,
              url: response.data.url,
              pptxUrl: response.data.pptxUrl,
            });
            setGammaStatus('ready');
            setGammaDeckUrl(response.data.url);
            setGammaPptxUrl(response.data.pptxUrl || null);
            // Reload presentation to get all updated fields
            await hydrateFromLocalStorage();
            clearInterval(pollInterval);
            return;
          } else if (status === 'failed' || status === 'error' || status === 'completed') {
            // Handle 'completed' without URL as error, or actual failed/error status
            if (status === 'completed' && !response.data.url) {
              console.warn('⚠️ Status is completed but no URL provided');
              setGammaStatus('error');
              setError('Generation completed but no URL was returned. Please try again.');
              clearInterval(pollInterval);
              return;
            }
            // Actual failed/error status
            console.error('❌ Generation failed:', {
              generationId: gammaGenerationId,
              status,
              error: response.data.error,
            });
            setGammaStatus('error');
            setError(response.data.error || 'PPT generation failed');
            clearInterval(pollInterval);
            return;
            // Generation failed - stop polling immediately
            console.error('❌ Generation failed:', {
              generationId: gammaGenerationId,
              status,
              error: response.data.error,
            });
            setGammaStatus('error');
            setError(response.data.error || 'PPT generation failed');
            clearInterval(pollInterval);
            return;
          } else if (status === 'processing' || status === 'pending') {
            // Normal processing state - continue polling (not an error)
            console.log(`🔄 Generation still processing (poll #${pollCount}/${MAX_POLLS})`);
            // Continue polling - do nothing, let the interval continue
          } else {
            // Unknown status - log but continue polling
            console.warn('⚠️ Unknown Gamma status:', status);
          }
        }
      } catch (err) {
        // Network/API errors - log but don't stop polling (might be temporary)
        console.warn(`⚠️ Poll #${pollCount} error (continuing):`, err);
        // Don't stop polling on transient errors
      }
      
      // Check max polls limit
      if (pollCount >= MAX_POLLS) {
        console.warn('⏰ Max polls reached (30 polls = 5 minutes)');
        clearInterval(pollInterval);
        setGammaStatus('error');
        setError('PPT generation is taking longer than expected. You can try again or refresh the page.');
      }
    }, POLL_INTERVAL);

    // Safety timeout (5 minutes = 30 polls * 10 seconds)
    const timeout = setTimeout(() => {
      console.warn('⏰ Polling timeout after 5 minutes');
      clearInterval(pollInterval);
      if (gammaStatus === 'generating') {
        setGammaStatus('error');
        setError('PPT generation timed out after 5 minutes. You can try again or refresh the page.');
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
    // Only depend on the values that trigger polling, not the function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gammaStatus, gammaGenerationId, presentationId]);

  // 5. Handler functions
  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setError('');
    setSaving(true);

    try {
      // Convert slides array back to sections format for storage
      const slidesToSave = {
        sections: slides.map((slide, idx) => ({
          title: slide.title || `Slide ${idx + 1}`,
          bullets: slide.content ? slide.content.split('\n').filter(b => b.trim()) : [],
        })),
      };

      const response = await api.patch(`/api/content/presentations/${presentationId}`, {
        title,
        description,
        slides: slidesToSave,
        published,
      });

      if (response.data?.success) {
        const savedPresentation = response.data.presentation;
        
        // 🎯 LOCAL-FIRST: Save to localStorage (authoritative source)
        if (typeof window !== 'undefined') {
          const saveId = companyHQId || localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
          if (saveId) {
            try {
              const cachedKey = `presentations_${saveId}`;
              const cached = localStorage.getItem(cachedKey);
              const presentations = cached ? JSON.parse(cached) : [];
              const existingIndex = presentations.findIndex(p => p.id === savedPresentation.id);
              if (existingIndex >= 0) {
                presentations[existingIndex] = savedPresentation;
              } else {
                presentations.unshift(savedPresentation);
              }
              localStorage.setItem(cachedKey, JSON.stringify(presentations));
              console.log('✅ [LOCAL-FIRST] Saved presentation to localStorage');
            } catch (e) {
              console.warn('[LOCAL-FIRST] Failed to save to localStorage:', e);
            }
          }
        }
        
        router.push('/content/presentations');
      } else {
        throw new Error('Failed to save presentation');
      }
    } catch (err) {
      console.error('Error saving presentation:', err);
      setError('Failed to save presentation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSlide = (index, field, value) => {
    const updated = [...slides];
    updated[index] = { ...updated[index], [field]: value };
    setSlides(updated);
  };

  const handleBuildPPT = async () => {
    if (!presentationId) return;
    
    // Validate slides before generating
    if (!slides || slides.length === 0) {
      setError('Please add at least one slide before generating the PPT');
      return;
    }

    // Check if slides have content
    const hasContent = slides.some(slide => 
      (slide.title && slide.title.trim()) || 
      (slide.content && slide.content.trim())
    );
    
    if (!hasContent) {
      setError('Please add content to at least one slide before generating the PPT');
      return;
    }
    
    setBuildingPPT(true);
    setError('');
    setShowErrorStatus(true); // Show status box when user clicks generate
    
    try {
      console.log('🚀 Starting PPT generation for presentation:', presentationId);
      const response = await api.post('/api/decks/generate', {
        presentationId,
      });
      
      console.log('📦 PPT generation response:', response.data);
      
      if (response.data?.success) {
        if (response.data.status === 'ready') {
          // Already complete
          setGammaStatus('ready');
          setGammaDeckUrl(response.data.deckUrl);
          setGammaPptxUrl(response.data.pptxUrl || null);
          
          // Reload presentation to get updated status
          await hydrateFromLocalStorage();
        } else if (response.data.status === 'generating') {
          // Generation started - start polling
          setGammaStatus('generating');
          if (response.data.generationId) {
            setGammaGenerationId(response.data.generationId);
            console.log('🔄 Generation started, generationId:', response.data.generationId);
          }
        } else {
          throw new Error(response.data.error || 'Unknown status from generation API');
        }
      } else {
        throw new Error(response.data?.error || 'Failed to generate PPT');
      }
    } catch (err) {
      console.error('❌ Error building PPT:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.details || 
                          err.message || 
                          'Failed to build PPT. Please try again.';
      setError(errorMessage);
      setGammaStatus('error');
    } finally {
      setBuildingPPT(false);
    }
  };

  // 6. JSX render
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading presentation...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Edit Presentation"
          subtitle={title || 'Presentation'}
          backTo="/content/presentations"
          backLabel="Back to Presentations"
        />

        <div className="mt-8 rounded-2xl bg-white p-6 shadow">
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action Buttons at Top */}
          <div className="mb-6 flex flex-wrap gap-3 border-b border-gray-200 pb-4">
            {/* Edit/Builder Button */}
            <button
              onClick={() => router.push(`/builder/presentation/${presentationId}`)}
              className="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 rotate-180" />
              Edit in Builder
            </button>

            {/* AI Enhancement Button */}
            <button
              onClick={() => router.push(`/content/presentations/${presentationId}/ai`)}
              className="flex items-center gap-2 rounded border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Enhance with AI
            </button>

            {/* Build PPT Button */}
            <button
              onClick={handleBuildPPT}
              disabled={buildingPPT || gammaStatus === 'generating' || !slides || slides.length === 0}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {buildingPPT || gammaStatus === 'generating' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building PPT...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Build the PPT
                </>
              )}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="ml-auto flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Gamma/PPT Status - Show after build or if user tried to generate */}
          {showErrorStatus && (gammaStatus || gammaDeckUrl || gammaPptxUrl) && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    {gammaStatus === 'ready' ? '✅ PPT Ready!' : gammaStatus === 'generating' ? '🔄 Generating PPT...' : '❌ PPT Generation Failed'}
                  </h3>
                  {gammaStatus === 'ready' && (
                    <div className="flex flex-wrap gap-3">
                      {gammaDeckUrl && (
                        <a
                          href={gammaDeckUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Deck (Gamma)
                        </a>
                      )}
                      {gammaPptxUrl && (
                        <a
                          href={gammaPptxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PPTX
                        </a>
                      )}
                    </div>
                  )}
                  {gammaStatus === 'generating' && (
                    <p className="text-sm text-blue-700">Gamma is generating your presentation deck. This may take a minute...</p>
                  )}
                  {gammaStatus === 'error' && (
                    <p className="text-sm text-red-700">PPT generation failed. Please try again or check your slides.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                spellCheck={true}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  Slides ({slides.length})
                </label>
              </div>

              <div className="space-y-4">
                {slides.map((slide, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Slide {slide.slideNumber || index + 1}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={slide.title || ''}
                        onChange={(e) => updateSlide(index, 'title', e.target.value)}
                        placeholder="Slide title"
                        spellCheck={true}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                      <textarea
                        value={slide.content || ''}
                        onChange={(e) => updateSlide(index, 'content', e.target.value)}
                        placeholder="Slide content (key points, talking points, etc.)"
                        rows={3}
                        spellCheck={true}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="published" className="text-sm text-gray-700">
                Published (visible to client)
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
