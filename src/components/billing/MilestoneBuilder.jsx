'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Milestone Builder Component
 * Dynamic form for adding/removing invoice milestones
 */
export default function MilestoneBuilder({ milestones, onChange }) {
  const addMilestone = () => {
    const newMilestone = {
      label: '',
      expectedAmount: 0,
      expectedDate: '',
      description: '',
    };
    onChange([...milestones, newMilestone]);
  };

  const removeMilestone = (index) => {
    const updated = milestones.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...milestones];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
        <button
          type="button"
          onClick={addMilestone}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Milestone
        </button>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">No milestones added yet</p>
          <p className="text-gray-400 text-xs mt-1">Click "Add Milestone" to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((milestone, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-900">
                  Milestone {index + 1}
                </h4>
                <button
                  type="button"
                  onClick={() => removeMilestone(index)}
                  className="text-red-600 hover:text-red-800 transition"
                  aria-label="Remove milestone"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Label <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={milestone.label}
                    onChange={(e) => updateMilestone(index, 'label', e.target.value)}
                    placeholder="e.g., Initial Payment, Milestone 1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Expected Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Amount ($) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={milestone.expectedAmount || ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                      updateMilestone(index, 'expectedAmount', value);
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Expected Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Date
                  </label>
                  <input
                    type="date"
                    value={milestone.expectedDate || ''}
                    onChange={(e) => updateMilestone(index, 'expectedDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={milestone.description || ''}
                    onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {milestones.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total Expected:</span>
            <span className="text-lg font-bold text-gray-900">
              ${milestones
                .reduce((sum, m) => sum + (parseFloat(m.expectedAmount) || 0), 0)
                .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

