'use client';

import { useState, useEffect } from 'react';
import { Upload, FileSpreadsheet, Loader2, Building2, TrendingUp, Award, Filter } from 'lucide-react';
import api from '@/lib/api';
import AssociationCard, { type Association } from '@/components/ecosystem/AssociationCard';
import AssociationDetailModal from '@/components/ecosystem/AssociationDetailModal';
import PageHeader from '@/components/PageHeader.jsx';

type ClusterView = 'industry' | 'persona' | 'authority';

export default function EcosystemAssociationsPage() {
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedAssociation, setSelectedAssociation] = useState<Association | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clusterView, setClusterView] = useState<ClusterView>('industry');

  useEffect(() => {
    fetchAssociations();
  }, []);

  const fetchAssociations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/ecosystem/association/ingest');
      if (response.data?.success) {
        // Convert dates
        const data = (response.data.associations || []).map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
        }));
        setAssociations(data);
      }
    } catch (error) {
      console.error('Failed to fetch associations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isValidFile =
      file.type === 'text/csv' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileName.endsWith('.csv') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls');

    if (!isValidFile) {
      setUploadError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await api.post('/api/ecosystem/association/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data?.success) {
        // Refresh associations
        await fetchAssociations();
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setUploadError(response.data?.error || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadError(error.response?.data?.error || error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Cluster associations by view type
  const getClusteredAssociations = () => {
    if (clusterView === 'industry') {
      const clusters: Record<string, Association[]> = {};
      associations.forEach((assoc) => {
        const key = assoc.industryTags && assoc.industryTags.length > 0 ? assoc.industryTags[0] : 'Other';
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(assoc);
      });
      return clusters;
    } else if (clusterView === 'persona') {
      const clusters: Record<string, Association[]> = {};
      associations.forEach((assoc) => {
        if (assoc.personaAlignment && typeof assoc.personaAlignment === 'object') {
          const entries = Object.entries(assoc.personaAlignment);
          if (entries.length > 0) {
            const topPersona = entries.sort(([, a], [, b]) => (b as number) - (a as number))[0];
            const key = `Persona ${topPersona[0]}`;
            if (!clusters[key]) clusters[key] = [];
            clusters[key].push(assoc);
          } else {
            const key = 'No Persona Match';
            if (!clusters[key]) clusters[key] = [];
            clusters[key].push(assoc);
          }
        } else {
          const key = 'No Persona Match';
          if (!clusters[key]) clusters[key] = [];
          clusters[key].push(assoc);
        }
      });
      return clusters;
    } else {
      // authority
      const clusters: Record<string, Association[]> = {
        'Level 5 - Global': [],
        'Level 4 - International': [],
        'Level 3 - National': [],
        'Level 2 - State': [],
        'Level 1 - Local': [],
      };
      associations.forEach((assoc) => {
        const level = assoc.authorityLevel || 3;
        if (level === 5) clusters['Level 5 - Global'].push(assoc);
        else if (level === 4) clusters['Level 4 - International'].push(assoc);
        else if (level === 3) clusters['Level 3 - National'].push(assoc);
        else if (level === 2) clusters['Level 2 - State'].push(assoc);
        else clusters['Level 1 - Local'].push(assoc);
      });
      // Remove empty clusters
      Object.keys(clusters).forEach((key) => {
        if (clusters[key].length === 0) delete clusters[key];
      });
      return clusters;
    }
  };

  const clustered = getClusteredAssociations();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Ecosystem Intelligence - Associations"
          subtitle="Upload and analyze professional associations to map your ecosystem"
          backTo="/growth-dashboard"
          backLabel="Back to Dashboard"
        />

        {/* Upload Section */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Association Spreadsheet
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV or Excel file with columns: <strong>Firm/Org Name</strong>, <strong>Website</strong>,{' '}
            <strong>Org Location</strong>
          </p>

          <div className="flex items-center gap-4">
            <label
              htmlFor="file-upload"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Select File
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile && (
              <span className="text-sm text-gray-700 font-medium">{selectedFile.name}</span>
            )}
            {selectedFile && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload & Process
                  </>
                )}
              </button>
            )}
          </div>

          {uploadError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {uploadError}
            </div>
          )}
        </div>

        {/* Cluster Map Tabs */}
        {associations.length > 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Cluster Map View
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setClusterView('industry')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      clusterView === 'industry'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    By Industry
                  </button>
                  <button
                    onClick={() => setClusterView('persona')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      clusterView === 'persona'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    By Persona
                  </button>
                  <button
                    onClick={() => setClusterView('authority')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      clusterView === 'authority'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    By Authority
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(clustered).map(([clusterName, clusterAssociations]) => (
                    <div key={clusterName}>
                      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {clusterName} ({clusterAssociations.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {clusterAssociations.map((assoc) => (
                          <AssociationCard
                            key={assoc.id}
                            association={assoc}
                            onClick={() => {
                              setSelectedAssociation(assoc);
                              setIsModalOpen(true);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* List View (Fallback when no clusters) */}
        {associations.length > 0 && Object.keys(clustered).length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">All Associations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {associations.map((assoc) => (
                <AssociationCard
                  key={assoc.id}
                  association={assoc}
                  onClick={() => {
                    setSelectedAssociation(assoc);
                    setIsModalOpen(true);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && associations.length === 0 && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No associations yet</h3>
            <p className="text-gray-600">
              Upload a spreadsheet to start analyzing your ecosystem associations
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AssociationDetailModal
        association={selectedAssociation}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAssociation(null);
        }}
      />
    </div>
  );
}

