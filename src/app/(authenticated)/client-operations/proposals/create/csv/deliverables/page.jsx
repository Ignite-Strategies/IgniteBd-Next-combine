'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader.jsx';
import { Upload, FileText, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

/**
 * Deliverable CSV Upload Page
 */
function DeliverableCSVUploadContent() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      setError('');
      setSuccess(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Phase Name,Deliverable Name,Description,Quantity,Unit,Duration (Days)
Collateral Generation,Persona Development,"Persona strategy and drafting",1,item,1
Collateral Generation,CLE Deck,"25-slide educational deck",1,item,1
Enrichment & Automation Prep,Contact Enrichment,"Apollo/Hunter enrichment",50,item,1
Load for Launch,Automation QA,"Test and validate workflows",1,day,1`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deliverable_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    if (typeof window === 'undefined') return;

    const companyHQId = window.localStorage.getItem('companyHQId') || window.localStorage.getItem('companyId');
    if (!companyHQId) {
      setError('CompanyHQ ID not found');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyHQId', companyHQId);

      const uploadResponse = await api.post('/api/csv/deliverables/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (uploadResponse.data?.success) {
        setSuccess(true);
        setUploadedCount(uploadResponse.data.count || 0);
        setFile(null);
        
        // Reset file input
        const fileInput = document.getElementById('file-upload');
        if (fileInput) fileInput.value = '';
      } else {
        setError(uploadResponse.data?.error || 'Failed to upload CSV');
      }
    } catch (err) {
      console.error('Error uploading CSV:', err);
      setError(err.response?.data?.error || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Upload Deliverable Templates"
          subtitle="Upload deliverable templates from a CSV file"
          backTo="/client-operations/proposals/create/csv"
          backLabel="Back to CSV Upload"
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>Successfully uploaded {uploadedCount} deliverable template(s)!</span>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-white p-8 shadow">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Deliverable Templates</h2>
            <p className="text-gray-600">
              Upload deliverable templates that define what deliverables are available for your proposals.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-6 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-200"
            >
              <FileText className="h-5 w-5" />
              Download CSV Template
            </button>

            <div className="relative">
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileSelect}
              />
              <label
                htmlFor="file-upload"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-red-700 cursor-pointer"
              >
                <Upload className="h-5 w-5" />
                {file ? `Selected: ${file.name}` : 'Upload CSV File'}
              </label>
            </div>

            {file && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full rounded-lg bg-red-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload & Create Templates'}
              </button>
            )}

            {success && (
              <button
                onClick={() => router.push('/templates/pantry')}
                className="w-full rounded-lg bg-gray-100 px-6 py-4 text-base font-semibold text-gray-700 transition hover:bg-gray-200"
              >
                View Templates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeliverableCSVUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <DeliverableCSVUploadContent />
    </Suspense>
  );
}