'use client';

import { Building2, Globe, MapPin, TrendingUp, Award } from 'lucide-react';

export interface Association {
  id: string;
  rawName: string;
  normalizedName: string;
  description?: string | null;
  industryTags: string[];
  memberTypes: string[];
  memberSeniority?: string | null;
  missionSummary?: string | null;
  authorityLevel?: number | null;
  valueProposition?: string | null;
  personaAlignment?: Record<string, number> | null;
  bdRelevanceScore?: number | null;
  rawWebsite?: string | null;
  rawLocation?: string | null;
  createdAt: Date;
}

interface AssociationCardProps {
  association: Association;
  onClick: () => void;
}

export default function AssociationCard({ association, onClick }: AssociationCardProps) {
  const topIndustryTag = association.industryTags && association.industryTags.length > 0 ? association.industryTags[0] : null;
  const bdScore = association.bdRelevanceScore ?? 0;
  const authorityLevel = association.authorityLevel ?? 3;

  // Get top persona match if available
  let topPersonaMatch: { id: string; score: number } | null = null;
  if (association.personaAlignment && typeof association.personaAlignment === 'object') {
    const entries = Object.entries(association.personaAlignment);
    if (entries.length > 0) {
      const sorted = entries.sort(([, a], [, b]) => (b as number) - (a as number));
      topPersonaMatch = { id: sorted[0][0], score: sorted[0][1] as number };
    }
  }

  // Authority level colors
  const authorityColors: Record<number, string> = {
    1: 'bg-gray-100 text-gray-700',
    2: 'bg-blue-100 text-blue-700',
    3: 'bg-purple-100 text-purple-700',
    4: 'bg-indigo-100 text-indigo-700',
    5: 'bg-yellow-100 text-yellow-700',
  };

  const authorityLabels: Record<number, string> = {
    1: 'Local',
    2: 'State',
    3: 'National',
    4: 'International',
    5: 'Global',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg transition-all cursor-pointer hover:border-blue-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{association.normalizedName}</h3>
          {association.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{association.description}</p>
          )}
        </div>
        <div className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${authorityColors[authorityLevel] || authorityColors[3]}`}>
          {authorityLabels[authorityLevel] || 'National'}
        </div>
      </div>

      {/* Metadata Row */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
        {topIndustryTag && (
          <div className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            <span>{topIndustryTag}</span>
          </div>
        )}
        {association.rawWebsite && (
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            <span className="truncate max-w-[150px]">{association.rawWebsite}</span>
          </div>
        )}
        {association.rawLocation && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>{association.rawLocation}</span>
          </div>
        )}
      </div>

      {/* BD Score and Persona Match */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-gray-700">BD Score: </span>
          <span className={`text-sm font-bold ${bdScore >= 70 ? 'text-green-600' : bdScore >= 50 ? 'text-yellow-600' : 'text-gray-500'}`}>
            {bdScore}
          </span>
        </div>
        {topPersonaMatch && (
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-gray-600">Match: {topPersonaMatch.score}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

