'use client';

import { Loader2, Sparkles } from 'lucide-react';

interface EventFiltersProps {
  priorityFilters: string[];
  onTogglePriorityFilter: (filterId: string) => void;
  travelPreference: string;
  onTravelPreferenceChange: (value: string) => void;
  budgetPreference: string;
  onBudgetPreferenceChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
}

const priorityFilterOptions = [
  { id: 'well-known', label: 'Most well-known' },
  { id: 'well-attended', label: 'Most well-attended' },
  { id: 'bd-exposure', label: 'Biggest BD exposure' },
  { id: 'local-travel', label: 'Local / Easy travel' },
  { id: 'cost-effective', label: 'Cost-effective' },
  { id: 'allocator-density', label: 'Top allocator density' },
  { id: 'gp-density', label: 'Top GP/dealflow density' },
];

export default function EventFilters({
  priorityFilters,
  onTogglePriorityFilter,
  travelPreference,
  onTravelPreferenceChange,
  budgetPreference,
  onBudgetPreferenceChange,
  onGenerate,
  generating,
}: EventFiltersProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>

      {/* Priority Filters */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Priority Filters *
        </label>
        <div className="space-y-2">
          {priorityFilterOptions.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={priorityFilters.includes(option.id)}
                onChange={() => onTogglePriorityFilter(option.id)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Travel Preference */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Travel Preference
        </label>
        <div className="space-y-2">
          {[
            { id: 'anywhere', label: 'Will travel anywhere' },
            { id: 'domestic', label: 'Only domestic' },
            { id: 'major-hubs', label: 'Only major hubs' },
            { id: 'near-me', label: 'Near me' },
          ].map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
            >
              <input
                type="radio"
                name="travel"
                value={option.id}
                checked={travelPreference === option.id}
                onChange={(e) => onTravelPreferenceChange(e.target.value)}
                className="border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Budget Preference */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Budget Preference
        </label>
        <div className="space-y-2">
          {[
            { id: 'budget', label: 'Budget' },
            { id: 'standard', label: 'Standard' },
            { id: 'premium', label: 'Premium' },
          ].map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50"
            >
              <input
                type="radio"
                name="budget"
                value={option.id}
                checked={budgetPreference === option.id}
                onChange={(e) => onBudgetPreferenceChange(e.target.value)}
                className="border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={generating || priorityFilters.length === 0}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Generate Events
          </>
        )}
      </button>
    </div>
  );
}

