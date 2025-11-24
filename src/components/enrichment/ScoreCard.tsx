'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';

interface ScoreCardProps {
  label: string;
  score: number | null | undefined;
  description?: string;
}

export default function ScoreCard({ label, score, description }: ScoreCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const scoreValue = score ?? 0;
  const percentage = Math.min(100, Math.max(0, scoreValue));
  
  // Color based on score
  const getColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-blue-600';
    if (score >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBgColor = (score: number) => {
    if (score >= 75) return 'bg-green-100';
    if (score >= 50) return 'bg-blue-100';
    if (score >= 25) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getRingColor = (score: number) => {
    if (score >= 75) return 'stroke-green-600';
    if (score >= 50) return 'stroke-blue-600';
    if (score >= 25) return 'stroke-yellow-600';
    return 'stroke-red-600';
  };

  // Calculate circumference for progress ring (radius = 30, so circumference = 2 * π * 30 ≈ 188.5)
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative">
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">{label}</span>
            {description && (
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Info className="h-3 w-3" />
                </button>
                {showTooltip && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                    {description}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress Ring */}
          <div className="relative w-16 h-16">
            <svg className="transform -rotate-90 w-16 h-16">
              {/* Background circle */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-gray-200"
              />
              {/* Progress circle */}
              <circle
                cx="32"
                cy="32"
                r={radius}
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={`transition-all duration-500 ${getRingColor(scoreValue)}`}
              />
            </svg>
            {/* Score text in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${getColor(scoreValue)}`}>
                {scoreValue}
              </span>
            </div>
          </div>
          {/* Score label */}
          <div className="flex-1">
            <div className={`inline-block rounded-full px-2 py-1 ${getBgColor(scoreValue)}`}>
              <span className={`text-xs font-semibold ${getColor(scoreValue)}`}>
                {percentage}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

