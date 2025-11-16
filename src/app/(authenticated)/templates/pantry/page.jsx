'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Plus, Trash2, FileText, Package } from 'lucide-react';
import api from '@/lib/api';

/**
 * Template Pantry Page
 * Manage Phase Templates and Deliverable Templates
 */
export default function TemplatePantryPage() {
  const router = useRouter();
  const [phaseTemplates, setPhaseTemplates] = useState([]);
  const [deliverableTemplates, setDeliverableTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('phases'); // 'phases' | 'deliverables'

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      const [phasesRes, deliverablesRes] = await Promise.all([
        api.get('/api/templates/phases'),
        api.get('/api/templates/deliverables'),
      ]);

      if (phasesRes.data?.success) {
        setPhaseTemplates(phasesRes.data.phaseTemplates || []);
      }
      if (deliverablesRes.data?.success) {
        setDeliverableTemplates(deliverablesRes.data.deliverableTemplates || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/api/import/phases', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        await loadTemplates();
        alert(`Imported ${response.data.count} phase templates`);
      } else {
        setError(response.data?.error || 'Failed to import phases');
      }
    } catch (err) {
      console.error('Error importing phases:', err);
      setError(err.response?.data?.error || 'Failed to import phases');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleDeliverableCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/api/import/deliverables', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        await loadTemplates();
        alert(`Imported ${response.data.count} deliverable templates`);
      } else {
        setError(response.data?.error || 'Failed to import deliverables');
      }
    } catch (err) {
      console.error('Error importing deliverables:', err);
      setError(err.response?.data?.error || 'Failed to import deliverables');
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Template Pantry</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage reusable phase and deliverable templates
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('phases')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'phases'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Phase Templates ({phaseTemplates.length})
            </button>
            <button
              onClick={() => setActiveTab('deliverables')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'deliverables'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Deliverable Templates ({deliverableTemplates.length})
            </button>
          </nav>
        </div>

        {/* Phase Templates */}
        {activeTab === 'phases' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Phase Templates</h2>
              <label className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 cursor-pointer">
                <Upload className="h-4 w-4" />
                <span>Import CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handlePhaseCSVUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white shadow">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {phaseTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{template.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{template.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {phaseTemplates.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                        No phase templates. Import a CSV to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deliverable Templates */}
        {activeTab === 'deliverables' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Deliverable Templates</h2>
              <label className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 cursor-pointer">
                <Upload className="h-4 w-4" />
                <span>Import CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleDeliverableCSVUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white shadow">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliverableTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{template.deliverableType}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Package className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-900">{template.deliverableLabel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {template.defaultDuration}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {template.defaultUnitOfMeasure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {deliverableTemplates.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                        No deliverable templates. Import a CSV to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

