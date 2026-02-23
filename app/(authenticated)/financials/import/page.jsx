'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, X, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader.jsx';

export default function FinancialsImportPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    date: '',
    description: '',
    amount: '',
  });
  const [importType, setImportType] = useState('expenses'); // expenses, income, or equity
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-2xl font-bold text-gray-900">Loading...</div>
        </div>
      </div>
    );
  }

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (
      selectedFile.type !== 'text/csv' &&
      !selectedFile.name.toLowerCase().endsWith('.csv')
    ) {
      alert('Please select a CSV file.');
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a CSV file first.');
      return;
    }

    const companyHQId = typeof window !== 'undefined'
      ? (localStorage.getItem('companyHQId') || localStorage.getItem('companyId'))
      : null;

    if (!companyHQId) {
      alert('Company context required.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyHQId', companyHQId);

      const response = await fetch('/api/financials/csv/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Set preview data
      setPreview({
        importId: result.importId,
        fileName: result.fileName,
        rowCount: result.rowCount,
        preview: result.preview,
        headers: result.headers,
      });

      // Auto-map columns (try to guess)
      const headers = result.headers || [];
      const dateCol = headers.find(h => 
        h.toLowerCase().includes('date') || h.toLowerCase().includes('date')
      );
      const descCol = headers.find(h => 
        h.toLowerCase().includes('description') || 
        h.toLowerCase().includes('memo') ||
        h.toLowerCase().includes('note')
      );
      const amountCol = headers.find(h => 
        h.toLowerCase().includes('amount') || 
        h.toLowerCase().includes('value')
      );

      setColumnMapping({
        date: dateCol || headers[0] || '',
        description: descCol || headers[1] || '',
        amount: amountCol || headers[2] || '',
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !columnMapping.date || !columnMapping.amount) {
      alert('Please map all required columns (date and amount).');
      return;
    }

    setUploading(true);

    try {
      const response = await fetch('/api/financials/csv/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importId: preview.importId,
          columnMapping,
          importType,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      alert(`✅ Successfully imported ${result.importedCount} transactions!`);
      router.push(`/financials/${importType}`);
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <PageHeader
          title="Import Financial Data"
          subtitle="Upload CSV file to import expenses, income, or equity transactions"
        />

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          {!preview ? (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-gray-400 mb-4" />
                    <span className="text-gray-600">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </span>
                    <span className="text-sm text-gray-500 mt-2">
                      CSV files only
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload & Preview'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Preview</h3>
                    <p className="text-sm text-gray-600">
                      {preview.fileName} • {preview.rowCount} rows
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setPreview(null);
                      setFile(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Column Mapping */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">Map Columns</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Date Column
                      </label>
                      <select
                        value={columnMapping.date}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, date: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Select column...</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Description Column
                      </label>
                      <select
                        value={columnMapping.description}
                        onChange={(e) =>
                          setColumnMapping({
                            ...columnMapping,
                            description: e.target.value,
                          })
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Select column...</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Amount Column
                      </label>
                      <select
                        value={columnMapping.amount}
                        onChange={(e) =>
                          setColumnMapping({ ...columnMapping, amount: e.target.value })
                        }
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">Select column...</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Import Type */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Import As
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="expenses"
                        checked={importType === 'expenses'}
                        onChange={(e) => setImportType(e.target.value)}
                        className="mr-2"
                      />
                      Expenses
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="income"
                        checked={importType === 'income'}
                        onChange={(e) => setImportType(e.target.value)}
                        className="mr-2"
                      />
                      Income
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="equity"
                        checked={importType === 'equity'}
                        onChange={(e) => setImportType(e.target.value)}
                        className="mr-2"
                      />
                      Equity
                    </label>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.headers.map((header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.preview.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          {preview.headers.map((header) => (
                            <td
                              key={header}
                              className="px-4 py-3 text-sm text-gray-900"
                            >
                              {row[header] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.rowCount > 10 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      ... and {preview.rowCount - 10} more rows
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setPreview(null);
                    setFile(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={uploading || !columnMapping.date || !columnMapping.amount}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Importing...' : 'Import'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
