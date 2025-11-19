'use client';

import { useState } from 'react';
import { Calendar, Edit2, Save, X } from 'lucide-react';
import { computePhaseTimelineStatus, getTimelineStatusColor } from '@/lib/utils/workPackageTimeline';
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

function formatDuration(hours) {
  if (!hours || hours <= 0) return '—';
  const days = Math.ceil(hours / 8);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function PhaseCard({ phase, workPackageId, onPhaseUpdate, onItemStatusUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    status: phase.status || 'not_started',
    estimatedStartDate: phase.estimatedStartDate ? new Date(phase.estimatedStartDate).toISOString().split('T')[0] : '',
    estimatedEndDate: phase.estimatedEndDate ? new Date(phase.estimatedEndDate).toISOString().split('T')[0] : '',
    actualStartDate: phase.actualStartDate ? new Date(phase.actualStartDate).toISOString().split('T')[0] : '',
    actualEndDate: phase.actualEndDate ? new Date(phase.actualEndDate).toISOString().split('T')[0] : '',
  });

  const timelineStatus = computePhaseTimelineStatus(
    phase.status,
    phase.estimatedEndDate || phase.actualEndDate
  );
  const statusColor = getTimelineStatusColor(timelineStatus);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        status: formData.status,
      };

      // Only include dates if they're provided
      if (formData.estimatedStartDate) {
        updateData.estimatedStartDate = new Date(formData.estimatedStartDate).toISOString();
      }
      if (formData.estimatedEndDate) {
        updateData.estimatedEndDate = new Date(formData.estimatedEndDate).toISOString();
      }
      if (formData.actualStartDate) {
        updateData.actualStartDate = new Date(formData.actualStartDate).toISOString();
      }
      if (formData.actualEndDate) {
        updateData.actualEndDate = new Date(formData.actualEndDate).toISOString();
      }

      await api.patch(`/api/workpackages/phases/${phase.id}`, updateData);
      
      // Reload phase data
      if (onPhaseUpdate) {
        await onPhaseUpdate();
      }
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating phase:', err);
      alert('Failed to update phase');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      status: phase.status || 'not_started',
      estimatedStartDate: phase.estimatedStartDate ? new Date(phase.estimatedStartDate).toISOString().split('T')[0] : '',
      estimatedEndDate: phase.estimatedEndDate ? new Date(phase.estimatedEndDate).toISOString().split('T')[0] : '',
      actualStartDate: phase.actualStartDate ? new Date(phase.actualStartDate).toISOString().split('T')[0] : '',
      actualEndDate: phase.actualEndDate ? new Date(phase.actualEndDate).toISOString().split('T')[0] : '',
    });
    setIsEditing(false);
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
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
            {timelineStatus === 'complete' ? 'Complete' : 
             timelineStatus === 'overdue' ? 'Overdue' :
             timelineStatus === 'warning' ? 'Warning' : 'On Track'}
          </span>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Block */}
      <div className="rounded-lg bg-gray-50 p-4 space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500 mb-1">Estimated</div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="date"
                  value={formData.estimatedStartDate}
                  onChange={(e) => setFormData({ ...formData, estimatedStartDate: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={formData.estimatedEndDate}
                  onChange={(e) => setFormData({ ...formData, estimatedEndDate: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            ) : (
              <div className="font-medium text-gray-900">
                {formatDate(phase.estimatedStartDate)} → {formatDate(phase.estimatedEndDate)}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Actual</div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="date"
                  value={formData.actualStartDate}
                  onChange={(e) => setFormData({ ...formData, actualStartDate: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={formData.actualEndDate}
                  onChange={(e) => setFormData({ ...formData, actualEndDate: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            ) : (
              <div className="font-medium text-gray-900">
                {formatDate(phase.actualStartDate)} → {formatDate(phase.actualEndDate)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div>
            <div className="text-xs text-gray-500">Duration</div>
            <div className="text-sm font-medium text-gray-900">
              {formatDuration(phase.totalEstimatedHours)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Status</div>
            {isEditing ? (
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm font-medium text-gray-900 capitalize">
                {phase.status?.replace('_', ' ') || 'Not Started'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Actions */}
      {isEditing && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Phase Items */}
      <PhaseItems
        items={phase.items || []}
        workPackageId={workPackageId}
        onItemStatusUpdate={onItemStatusUpdate}
      />
    </div>
  );
}

