'use client';

import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import PhaseItems from './PhaseItems';
import api from '@/lib/api';

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateForInput(date) {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}

function formatDuration(days) {
  if (!days || days <= 0) return '—';
  return `${days} day${days !== 1 ? 's' : ''}`;
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function PhaseCard({ phase, workPackageId, onPhaseUpdate, onItemStatusUpdate }) {
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [localValues, setLocalValues] = useState({
    status: phase.status || 'not_started',
    estimatedStartDate: phase.estimatedStartDate || null,
    estimatedEndDate: phase.estimatedEndDate || null,
    phaseTotalDuration: phase.phaseTotalDuration || null,
    actualStartDate: phase.actualStartDate || null,
    actualEndDate: phase.actualEndDate || null,
  });

  // Update local values when phase prop changes
  useEffect(() => {
    setLocalValues({
      status: phase.status || 'not_started',
      estimatedStartDate: phase.estimatedStartDate || null,
      estimatedEndDate: phase.estimatedEndDate || null,
      phaseTotalDuration: phase.phaseTotalDuration || null,
      actualStartDate: phase.actualStartDate || null,
      actualEndDate: phase.actualEndDate || null,
    });
  }, [phase]);

  const handleFieldEdit = (fieldName) => {
    setEditingField(fieldName);
  };

  const handleFieldCancel = () => {
    setEditingField(null);
    // Reset to phase values
    setLocalValues({
      status: phase.status || 'not_started',
      estimatedStartDate: phase.estimatedStartDate || null,
      estimatedEndDate: phase.estimatedEndDate || null,
      phaseTotalDuration: phase.phaseTotalDuration || null,
      actualStartDate: phase.actualStartDate || null,
      actualEndDate: phase.actualEndDate || null,
    });
  };

  const handleFieldSave = async (fieldName) => {
    setSaving(true);
    try {
      const updateData = {};
      let newValue = localValues[fieldName];

      // Handle date fields
      if (fieldName.includes('Date')) {
        if (newValue && typeof newValue === 'string') {
          updateData[fieldName] = new Date(newValue).toISOString();
        } else if (newValue === '' || newValue === null) {
          updateData[fieldName] = null;
        } else {
          updateData[fieldName] = newValue ? new Date(newValue).toISOString() : null;
        }
      }
      // Handle duration
      else if (fieldName === 'phaseTotalDuration') {
        const durationValue = newValue === '' || newValue === null || newValue === undefined 
          ? null 
          : parseInt(String(newValue), 10);
        
        if (isNaN(durationValue)) {
          alert('Duration must be a valid number');
          setSaving(false);
          return;
        }
        
        updateData[fieldName] = durationValue;
        
        // Auto-calculate end date if start date exists
        if (durationValue && durationValue > 0 && localValues.estimatedStartDate) {
          const start = new Date(localValues.estimatedStartDate);
          const end = new Date(start);
          end.setDate(end.getDate() + durationValue);
          updateData.estimatedEndDate = end.toISOString();
          setLocalValues(prev => ({ ...prev, estimatedEndDate: end }));
        }
      }
      // Handle end date - recalculate duration
      else if (fieldName === 'estimatedEndDate') {
        updateData[fieldName] = newValue ? new Date(newValue).toISOString() : null;
        // Auto-calculate duration if start date exists
        if (newValue && localValues.estimatedStartDate) {
          const start = new Date(localValues.estimatedStartDate);
          const end = new Date(newValue);
          const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          if (days > 0) {
            updateData.phaseTotalDuration = days;
            setLocalValues(prev => ({ ...prev, phaseTotalDuration: days }));
          }
        }
      }
      // Handle start date - may need to shift subsequent phases
      else if (fieldName === 'estimatedStartDate') {
        updateData[fieldName] = newValue ? new Date(newValue).toISOString() : null;
        // Recalculate end date if duration exists
        if (newValue && localValues.phaseTotalDuration) {
          const start = new Date(newValue);
          const end = new Date(start);
          end.setDate(end.getDate() + localValues.phaseTotalDuration);
          updateData.estimatedEndDate = end.toISOString();
          setLocalValues(prev => ({ ...prev, estimatedEndDate: end }));
        }
      }
      // Handle status
      else if (fieldName === 'status') {
        updateData[fieldName] = newValue;
      }

      const response = await api.patch(`/api/workpackages/phases/${phase.id}`, updateData);
      
      if (response.data?.success) {
        // Reload phase data to get updated values
        if (onPhaseUpdate) {
          await onPhaseUpdate();
        }
        setEditingField(null);
      } else {
        throw new Error(response.data?.error || 'Failed to update phase');
      }
    } catch (err) {
      console.error('Error updating phase:', err);
      alert('Failed to update phase');
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (fieldName, value) => {
    setLocalValues(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow space-y-4 border border-gray-200">
      {/* Phase Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{phase.name || `Phase ${phase.position}`}</h3>
          {phase.description && (
            <p className="mt-1 text-sm text-gray-600">{phase.description}</p>
          )}
        </div>
      </div>

      {/* Timeline Block */}
      <div className="rounded-lg bg-gray-50 p-4 space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Estimated Dates */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Estimated</div>
            <div className="space-y-2">
              {editingField === 'estimatedStartDate' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={localValues.estimatedStartDate ? formatDateForInput(localValues.estimatedStartDate) : ''}
                    onChange={(e) => handleValueChange('estimatedStartDate', e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={() => handleFieldSave('estimatedStartDate')}
                    disabled={saving}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleFieldCancel}
                    disabled={saving}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleFieldEdit('estimatedStartDate')}
                  className="cursor-pointer rounded px-2 py-1 hover:bg-gray-100 transition"
                >
                  {formatDate(localValues.estimatedStartDate)}
                </div>
              )}
              <span className="text-gray-400 block text-center">→</span>
              {editingField === 'estimatedEndDate' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={localValues.estimatedEndDate ? formatDateForInput(localValues.estimatedEndDate) : ''}
                    onChange={(e) => handleValueChange('estimatedEndDate', e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={() => handleFieldSave('estimatedEndDate')}
                    disabled={saving}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleFieldCancel}
                    disabled={saving}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleFieldEdit('estimatedEndDate')}
                  className="cursor-pointer rounded px-2 py-1 hover:bg-gray-100 transition"
                >
                  {formatDate(localValues.estimatedEndDate)}
                </div>
              )}
            </div>
          </div>

          {/* Actual Dates */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Actual</div>
            <div className="space-y-2">
              {editingField === 'actualStartDate' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={localValues.actualStartDate ? formatDateForInput(localValues.actualStartDate) : ''}
                    onChange={(e) => handleValueChange('actualStartDate', e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={() => handleFieldSave('actualStartDate')}
                    disabled={saving}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleFieldCancel}
                    disabled={saving}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleFieldEdit('actualStartDate')}
                  className="cursor-pointer rounded px-2 py-1 hover:bg-gray-100 transition"
                >
                  {formatDate(localValues.actualStartDate)}
                </div>
              )}
              <span className="text-gray-400 block text-center">→</span>
              {editingField === 'actualEndDate' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={localValues.actualEndDate ? formatDateForInput(localValues.actualEndDate) : ''}
                    onChange={(e) => handleValueChange('actualEndDate', e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
                    autoFocus
                  />
                  <button
                    onClick={() => handleFieldSave('actualEndDate')}
                    disabled={saving}
                    className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Save className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleFieldCancel}
                    disabled={saving}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => handleFieldEdit('actualEndDate')}
                  className="cursor-pointer rounded px-2 py-1 hover:bg-gray-100 transition"
                >
                  {formatDate(localValues.actualEndDate)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Duration and Status Row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div>
            <div className="text-xs text-gray-500">Duration</div>
            {editingField === 'phaseTotalDuration' ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="1"
                  value={localValues.phaseTotalDuration || ''}
                  onChange={(e) => handleValueChange('phaseTotalDuration', e.target.value)}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                  placeholder="days"
                  autoFocus
                />
                <button
                  onClick={() => handleFieldSave('phaseTotalDuration')}
                  disabled={saving}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                </button>
                <button
                  onClick={handleFieldCancel}
                  disabled={saving}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => handleFieldEdit('phaseTotalDuration')}
                className="cursor-pointer text-sm font-medium text-gray-900 rounded px-2 py-1 hover:bg-gray-100 transition mt-1"
              >
                {formatDuration(localValues.phaseTotalDuration)}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500">Status</div>
            {editingField === 'status' ? (
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={localValues.status}
                  onChange={(e) => handleValueChange('status', e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  autoFocus
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleFieldSave('status')}
                  disabled={saving}
                  className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                </button>
                <button
                  onClick={handleFieldCancel}
                  disabled={saving}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => handleFieldEdit('status')}
                className="cursor-pointer text-sm font-medium text-gray-900 capitalize rounded px-2 py-1 hover:bg-gray-100 transition mt-1"
              >
                {localValues.status?.replace('_', ' ') || 'Not Started'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Items */}
      <PhaseItems
        items={phase.items || []}
        workPackageId={workPackageId}
        onItemStatusUpdate={onItemStatusUpdate}
      />
    </div>
  );
}
