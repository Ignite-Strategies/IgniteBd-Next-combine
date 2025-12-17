'use client';

import { X, Building2, Globe, MapPin, TrendingUp, Award, Users, Target, FileText } from 'lucide-react';
import type { Association } from './AssociationCard';

interface AssociationDetailModalProps {
  association: Association | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AssociationDetailModal({ association, isOpen, onClose }: AssociationDetailModalProps) {
  if (!isOpen || !association) return null;

  const authorityColors: Record<number, string> = {
    1: 'bg-gray-100 text-gray-700 border-gray-300',
    2: 'bg-blue-100 text-blue-700 border-blue-300',
    3: 'bg-purple-100 text-purple-700 border-purple-300',
    4: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    5: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  };

  const authorityLabels: Record<number, string> = {
    1: 'Local/Regional',
    2: 'State/Province',
    3: 'National',
    4: 'International',
    5: 'Global Authority',
  };

  // Parse persona alignment
  const personaEntries: Array<{ id: string; score: number }> = [];
  if (association.personaAlignment && typeof association.personaAlignment === 'object') {
    personaEntries.push(
      ...Object.entries(association.personaAlignment).map(([id, score]) => ({
        id,
        score: score as number,
      }))
    );
    personaEntries.sort((a, b) => b.score - a.score);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{association.normalizedName}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Raw Name</label>
              <p className="text-sm text-gray-900">{association.rawName}</p>
            </div>
            {association.rawWebsite && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  Website
                </label>
                <a
                  href={association.rawWebsite.startsWith('http') ? association.rawWebsite : `https://${association.rawWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {association.rawWebsite}
                </a>
              </div>
            )}
            {association.rawLocation && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </label>
                <p className="text-sm text-gray-900">{association.rawLocation}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Authority Level</label>
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                  authorityColors[association.authorityLevel || 3] || authorityColors[3]
                }`}
              >
                {authorityLabels[association.authorityLevel || 3] || 'National'} (Level {association.authorityLevel || 3}/5)
              </div>
            </div>
          </div>

          {/* Description */}
          {association.description && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Description</label>
              <p className="text-sm text-gray-700 leading-relaxed">{association.description}</p>
            </div>
          )}

          {/* Mission Summary */}
          {association.missionSummary && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1">
                <Target className="h-4 w-4" />
                Mission Summary
              </label>
              <p className="text-sm text-gray-700 leading-relaxed">{association.missionSummary}</p>
            </div>
          )}

          {/* Industry Tags */}
          {association.industryTags && association.industryTags.length > 0 && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Industry Tags</label>
              <div className="flex flex-wrap gap-2">
                {association.industryTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Member Types */}
          {association.memberTypes && association.memberTypes.length > 0 && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1">
                <Users className="h-4 w-4" />
                Member Types
              </label>
              <div className="flex flex-wrap gap-2">
                {association.memberTypes.map((type, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Member Seniority */}
          {association.memberSeniority && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Member Seniority</label>
              <p className="text-sm text-gray-700">{association.memberSeniority}</p>
            </div>
          )}

          {/* Value Proposition */}
          {association.valueProposition && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Value Proposition
              </label>
              <p className="text-sm text-gray-700 leading-relaxed">{association.valueProposition}</p>
            </div>
          )}

          {/* BD Score */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              BD Relevance Score
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${
                    (association.bdRelevanceScore || 0) >= 70
                      ? 'bg-green-500'
                      : (association.bdRelevanceScore || 0) >= 50
                        ? 'bg-yellow-500'
                        : 'bg-gray-400'
                  }`}
                  style={{ width: `${association.bdRelevanceScore || 0}%` }}
                />
              </div>
              <span className="text-lg font-bold text-gray-900">{association.bdRelevanceScore || 0}/100</span>
            </div>
          </div>

          {/* Persona Alignment */}
          {personaEntries.length > 0 && (
            <div className="mb-6">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block flex items-center gap-1">
                <Award className="h-4 w-4" />
                Persona Alignment
              </label>
              <div className="space-y-2">
                {personaEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 font-medium min-w-[100px]">Persona {entry.id}:</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          entry.score >= 70 ? 'bg-blue-500' : entry.score >= 50 ? 'bg-blue-400' : 'bg-blue-300'
                        }`}
                        style={{ width: `${entry.score}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 min-w-[40px] text-right">{entry.score}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Created At */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Created: {new Date(association.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

