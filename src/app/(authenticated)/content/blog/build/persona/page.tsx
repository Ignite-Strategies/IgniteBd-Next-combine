'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import api from '@/lib/api';
import { UserCircle, Sparkles } from 'lucide-react';
import type { BlogIngest } from '@/lib/blog-engine/types';

export default function BlogBuildPersonaPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [topic, setTopic] = useState('');
  const [problem, setProblem] = useState('');
  const [angle, setAngle] = useState('');
  const [targetLength, setTargetLength] = useState(600); // Default 500-700 range
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    try {
      setLoading(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      if (!companyHQId) {
        console.warn('No companyHQId found');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/personas?companyHQId=${companyHQId}`);
      if (response.data && Array.isArray(response.data)) {
        setPersonas(response.data);
      }
    } catch (err) {
      console.error('Error loading personas:', err);
      alert('Failed to load personas. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedPersona) {
      alert('Please select a persona first');
      return;
    }

    if (!topic.trim()) {
      alert('Please enter a topic');
      return;
    }

    if (!problem.trim()) {
      alert('Please enter the BD challenge/problem this blog solves');
      return;
    }

    try {
      setGenerating(true);
      
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
      
      // Build BlogIngest object
      const blogIngest: BlogIngest = {
        mode: 'persona',
        personaId: selectedPersona.id,
        persona: selectedPersona,
        topic: topic.trim(),
        problem: problem.trim(),
        angle: angle.trim() || undefined,
        targetLength: targetLength,
        companyHQId,
      };
      
      // Call AI route to generate blog
      const aiResponse = await api.post('/api/workme/blog/ai', {
        blogIngest,
      });

      if (aiResponse.data?.success) {
        const blogDraft = aiResponse.data.blogDraft;
        
        // Create blog with generated BlogDraft
        const createResponse = await api.post('/api/content/blog', {
          companyHQId,
          title: blogDraft.title,
          subtitle: blogDraft.subtitle,
          content: blogDraft, // Store full BlogDraft structure
        });

        if (createResponse.data?.success) {
          router.push(`/content/blog/${createResponse.data.blog.id}`);
        } else {
          throw new Error('Failed to create blog');
        }
      } else {
        throw new Error('Failed to generate blog');
      }
    } catch (err) {
      console.error('Error generating blog:', err);
      alert('Failed to generate blog. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Build from Persona"
          subtitle="Select a persona to generate a targeted blog post"
          backTo="/content/blog/build"
          backLabel="Back to Create Blog"
        />

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow">
            <p className="text-gray-600">Loading personas...</p>
          </div>
        ) : personas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center shadow">
            <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">No personas found</p>
            <p className="text-sm text-gray-500 mb-6">
              Create personas first to generate targeted blog posts
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Select a Persona</h3>
              <div className="space-y-3">
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona)}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      selectedPersona?.id === persona.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={selectedPersona?.id === persona.id}
                        onChange={() => setSelectedPersona(persona)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{persona.name}</h4>
                        {persona.role && (
                          <p className="text-sm text-gray-600">{persona.role}</p>
                        )}
                        {persona.painPoints && (
                          <p className="text-sm text-gray-500 mt-2">{persona.painPoints}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedPersona && (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Persona Summary</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p><strong>Name:</strong> {selectedPersona.name}</p>
                    {selectedPersona.role && <p><strong>Role:</strong> {selectedPersona.role}</p>}
                    {selectedPersona.goals && <p><strong>Goals:</strong> {selectedPersona.goals}</p>}
                    {selectedPersona.painPoints && <p><strong>Pain Points:</strong> {selectedPersona.painPoints}</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Blog Details</h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Topic *
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Client retention strategies for legal services"
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Problem / BD Challenge *
                    </label>
                    <textarea
                      value={problem}
                      onChange={(e) => setProblem(e.target.value)}
                      placeholder="What BD challenge does this blog solve? e.g., How to retain clients in competitive markets"
                      rows={3}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Angle (Optional)
                    </label>
                    <select
                      value={angle}
                      onChange={(e) => setAngle(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    >
                      <option value="">Select an angle (optional)</option>
                      <option value="efficiency">Efficiency</option>
                      <option value="dealmaking">Dealmaking</option>
                      <option value="risk">Risk</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Target Word Count
                    </label>
                    <select
                      value={targetLength}
                      onChange={(e) => setTargetLength(Number(e.target.value))}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    >
                      <option value={300}>300 words</option>
                      <option value={500}>500 words</option>
                      <option value={600}>600 words (default)</option>
                      <option value={700}>700 words</option>
                      <option value={1000}>1000 words</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={!selectedPersona || !topic.trim() || !problem.trim() || generating}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Sparkles className="h-5 w-5" />
                {generating ? 'Generating...' : 'Generate Blog Draft'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

