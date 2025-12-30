'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/PageHeader.jsx';

export default function AssessmentPage() {
  const router = useRouter();
  
  // Direct read from localStorage - NO HOOKS
  const [ownerId, setOwnerId] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('ownerId');
    if (stored) setOwnerId(stored);
  }, []);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyHQId, setCompanyHQId] = useState('');
  const [companyHQ, setCompanyHQ] = useState(null);
  const [existingAssessment, setExistingAssessment] = useState(null);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    industry: '',
    workTooMuch: '',
    assignTasks: '',
    wantMoreClients: '',
    revenueGrowthPercent: '',
    totalVolume: '',
    bdSpend: '',
  });

  // Get companyHQId and check for existing assessment
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedCompanyHQId =
      window.localStorage.getItem('companyHQId') ||
      window.localStorage.getItem('companyId') ||
      '';
    setCompanyHQId(storedCompanyHQId);

    // Get company from localStorage
    try {
      const storedCompany = localStorage.getItem('companyHQ');
      if (storedCompany) {
        const parsed = JSON.parse(storedCompany);
        setCompanyHQ(parsed);
        // Pre-fill company name if available
        if (parsed.companyName && !formData.company) {
          setFormData((prev) => ({ ...prev, company: parsed.companyName }));
        }
      }
    } catch (err) {
      console.warn('Failed to parse stored company:', err);
    }

    // Check for existing assessment - WAIT FOR AUTH
    const fetchExistingAssessment = async () => {
      // CRITICAL: Wait for auth to be ready before making API calls
      if (!ownerId) {
        return;
      }
      
      if (!storedCompanyHQId) return;
      
      try {
        setLoading(true);
        const response = await api.get(`/api/assessment?companyHQId=${storedCompanyHQId}`);
        if (response.data.success && response.data.assessments?.length > 0) {
          const latest = response.data.assessments[0];
          setExistingAssessment(latest);
          // Pre-fill form with existing data
          setFormData({
            name: latest.name || '',
            company: latest.company || '',
            industry: latest.industry || '',
            workTooMuch: latest.workTooMuch || '',
            assignTasks: latest.assignTasks || '',
            wantMoreClients: latest.wantMoreClients || '',
            revenueGrowthPercent: latest.revenueGrowthPercent?.toString() || '',
            totalVolume: latest.totalVolume?.toString() || '',
            bdSpend: latest.bdSpend?.toString() || '',
          });
        }
      } catch (err) {
        console.warn('Failed to fetch existing assessment:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchExistingAssessment();
  }, [ownerId]); // Wait for ownerId before fetching

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await api.post('/api/assessment', {
        companyHQId: companyHQId || null,
        ...formData,
      });

      if (response.data.success) {
        const assessment = response.data.assessment;
        // Show success and redirect or show results
        router.push(`/assessment/results?id=${assessment.id}`);
      } else {
        setError(response.data.error || 'Failed to submit assessment');
      }
    } catch (err) {
      console.error('Assessment submission error:', err);
      setError(err.response?.data?.error || 'Failed to submit assessment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Growth Assessment"
        description="Understand your growth potential and identify opportunities"
      />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {existingAssessment && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Previous Assessment Found</h3>
                <p className="text-sm text-blue-700">
                  You completed an assessment on {new Date(existingAssessment.createdAt).toLocaleDateString()}. 
                  You can update it below or view your results.
                </p>
                {existingAssessment.score !== null && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900">Score:</span>
                    <span className={`px-2 py-1 rounded text-sm font-semibold ${
                      existingAssessment.score >= 80 ? 'bg-green-100 text-green-800' :
                      existingAssessment.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                      existingAssessment.score >= 40 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {existingAssessment.score}/100
                    </span>
                    {existingAssessment.scoreInterpretation && (
                      <span className="text-sm text-blue-700">
                        - {existingAssessment.scoreInterpretation.level}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                    Industry
                  </label>
                  <input
                    type="text"
                    id="industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Technology, Healthcare, Consulting, etc."
                  />
                </div>
              </div>
            </div>

            {/* Workload Assessment */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Workload Assessment</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How often do you work too much?
                  </label>
                  <select
                    name="workTooMuch"
                    value={formData.workTooMuch}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select an option</option>
                    <option value="always">Always</option>
                    <option value="often">Often</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="rarely">Rarely</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How often do you assign tasks to others?
                  </label>
                  <select
                    name="assignTasks"
                    value={formData.assignTasks}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select an option</option>
                    <option value="never">Never</option>
                    <option value="rarely">Rarely</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="always">Always</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Growth Goals */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Growth Goals</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Do you want more clients?
                  </label>
                  <select
                    name="wantMoreClients"
                    value={formData.wantMoreClients}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select an option</option>
                    <option value="yes">Yes</option>
                    <option value="maybe">Maybe</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="revenueGrowthPercent" className="block text-sm font-medium text-gray-700 mb-2">
                    Revenue Growth Target (%)
                  </label>
                  <input
                    type="number"
                    id="revenueGrowthPercent"
                    name="revenueGrowthPercent"
                    value={formData.revenueGrowthPercent}
                    onChange={handleChange}
                    min="0"
                    max="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="25"
                  />
                  <p className="mt-1 text-sm text-gray-500">Enter the percentage (e.g., 25 for 25%)</p>
                </div>
              </div>
            </div>

            {/* Financial Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Financial Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="totalVolume" className="block text-sm font-medium text-gray-700 mb-2">
                    Total Revenue/Volume ($)
                  </label>
                  <input
                    type="number"
                    id="totalVolume"
                    name="totalVolume"
                    value={formData.totalVolume}
                    onChange={handleChange}
                    min="0"
                    step="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="1000000"
                  />
                </div>
                <div>
                  <label htmlFor="bdSpend" className="block text-sm font-medium text-gray-700 mb-2">
                    Business Development Spend ($)
                  </label>
                  <input
                    type="number"
                    id="bdSpend"
                    name="bdSpend"
                    value={formData.bdSpend}
                    onChange={handleChange}
                    min="0"
                    step="1000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="50000"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={submitting}
                className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-5 w-5" />
                    Complete Assessment
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

