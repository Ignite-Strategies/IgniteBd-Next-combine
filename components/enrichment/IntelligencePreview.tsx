'use client';

import { Building2, TrendingUp, Briefcase, Clock, Target, Zap, Shield, User, Mail, Phone, MapPin, Linkedin } from 'lucide-react';
import ScoreCard from './ScoreCard';

// Safe formatter for numeric values
const fmt = (s: number | null | undefined): string => {
  return typeof s === 'number' ? s.toFixed(1) : '—';
};

// Format revenue to billions/millions
const formatRevenue = (revenue: number | null | undefined): string => {
  if (!revenue || revenue === 0) {
    return '—';
  }
  if (revenue >= 1000000000) {
    return `$${(revenue / 1000000000).toFixed(1)}B`;
  } else if (revenue >= 1000000) {
    return `$${(revenue / 1000000).toFixed(1)}M`;
  } else if (revenue >= 1000) {
    return `$${(revenue / 1000).toFixed(1)}K`;
  } else {
    return `$${revenue.toFixed(0)}`;
  }
};

// Normalize text capitalization - sentence case
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return '';
  // Convert to lowercase first, then capitalize first letter of each word
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Normalize industry name - proper capitalization
const normalizeIndustry = (industry: string | null | undefined): string => {
  if (!industry) return '';
  // Common industry names that should be capitalized properly
  const industries: Record<string, string> = {
    'finance': 'Finance',
    'healthcare': 'Healthcare',
    'technology': 'Technology',
    'consulting': 'Consulting',
    'retail': 'Retail',
    'manufacturing': 'Manufacturing',
    'government': 'Government',
    'education': 'Education',
    'energy': 'Energy',
    'real estate': 'Real Estate',
    'media': 'Media',
    'transportation': 'Transportation',
    'hospitality': 'Hospitality',
    'legal': 'Legal',
    'construction': 'Construction',
    'investment management': 'Investment Management',
  };
  
  const lower = industry.toLowerCase().trim();
  return industries[lower] || normalizeText(industry);
};

// Normalize category - proper capitalization
const normalizeCategory = (category: string | null | undefined): string => {
  if (!category) return '';
  // Common categories that should be capitalized properly
  const categories: Record<string, string> = {
    'asset manager': 'Asset Manager',
    'capital allocator': 'Capital Allocator',
    'bank': 'Bank',
    'saas vendor': 'SaaS Vendor',
    'consultancy': 'Consultancy',
    'healthcare system': 'Healthcare System',
    'pe firm': 'PE Firm',
    'manufacturer': 'Manufacturer',
    'government contractor': 'Government Contractor',
    'retailer': 'Retailer',
    'media company': 'Media Company',
    'energy company': 'Energy Company',
    'real estate firm': 'Real Estate Firm',
    'law firm': 'Law Firm',
    'construction company': 'Construction Company',
    'education institution': 'Education Institution',
    'technology company': 'Technology Company',
  };
  
  const lower = category.toLowerCase().trim();
  return categories[lower] || normalizeText(category);
};

// Normalize tier - capitalize first letter only
const normalizeTier = (tier: string | null | undefined): string => {
  if (!tier) return '';
  const lower = tier.toLowerCase().trim();
  // Common tier values
  if (['micro', 'small', 'medium', 'large', 'enterprise'].includes(lower)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
};

// Normalize positioning label - sentence case
const normalizePositioning = (label: string | null | undefined): string => {
  if (!label) return '';
  // Convert to sentence case (first letter capitalized, rest lowercase unless proper nouns)
  return label
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Capitalize first word, keep common words lowercase unless they're first
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Keep small words lowercase unless they're important
      const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to'];
      if (smallWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// Normalize job title - title case
const normalizeTitle = (title: string | null | undefined): string => {
  if (!title) return '';
  // Common title words that should be lowercase unless first word
  const smallWords = ['of', 'and', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by'];
  return title
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      if (smallWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

interface IntelligencePreviewProps {
  normalizedContact: any;
  normalizedCompany: any;
  intelligenceScores: {
    seniorityScore: number;
    buyingPowerScore: number;
    urgencyScore: number;
    rolePowerScore: number;
    buyerLikelihoodScore: number;
    readinessToBuyScore: number;
    careerMomentumScore: number;
    careerStabilityScore: number;
  };
  companyIntelligence: {
    companyHealthScore: number;
    growthScore: number;
    stabilityScore: number;
    marketPositionScore: number;
    readinessScore: number;
  };
  linkedinUrl?: string;
  onViewRawJSON?: (json: any) => void;
  // Inference layer fields
  profileSummary?: string;
  tenureYears?: number;
  currentTenureYears?: number;
  totalExperienceYears?: number;
  avgTenureYears?: number;
  careerTimeline?: Array<{
    startDate: string;
    endDate: string | null;
    startYear?: number;
    endYear?: number | null;
    title: string;
    company: string;
    durationMonths: number;
    durationYears: number;
  }>;
  companyPositioning?: {
    positioningLabel?: string;
    category?: string;
    revenueTier?: string;
    headcountTier?: string;
    normalizedIndustry?: string;
    competitors?: string[];
  };
}

export default function IntelligencePreview({
  normalizedContact,
  normalizedCompany,
  intelligenceScores,
  companyIntelligence,
  linkedinUrl,
  onViewRawJSON,
  profileSummary,
  tenureYears,
  currentTenureYears,
  totalExperienceYears,
  avgTenureYears,
  careerTimeline,
  companyPositioning,
}: IntelligencePreviewProps) {
  // Null check - don't render if data is not loaded
  if (!normalizedContact || !intelligenceScores || !companyIntelligence) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Contact Summary Section */}
      <section className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Contact Summary</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Full Name</dt>
            <dd className="mt-1 text-base font-semibold text-gray-900">
              {normalizedContact.fullName || 
               `${normalizedContact.firstName || ''} ${normalizedContact.lastName || ''}`.trim() || 
               '—'}
            </dd>
          </div>
          {normalizedContact.title && (
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Title</dt>
              <dd className="mt-1 text-sm text-gray-900">{normalizeTitle(normalizedContact.title)}</dd>
            </div>
          )}
          {normalizedContact.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{normalizedContact.email}</dd>
              </div>
            </div>
          )}
          {normalizedContact.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{normalizedContact.phone}</dd>
              </div>
            </div>
          )}
          {(normalizedContact.city || normalizedContact.state || normalizedContact.country) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Location</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {[normalizedContact.city, normalizedContact.state, normalizedContact.country]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </dd>
              </div>
            </div>
          )}
          {linkedinUrl && (
            <div className="flex items-center gap-2">
              <Linkedin className="h-4 w-4 text-gray-400" />
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">LinkedIn</dt>
                <dd className="mt-1 text-sm">
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Profile
                  </a>
                </dd>
              </div>
            </div>
          )}
          {normalizedContact.seniority && (
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Seniority</dt>
              <dd className="mt-1 text-sm text-gray-900">{normalizeText(normalizedContact.seniority)}</dd>
            </div>
          )}
          {normalizedContact.department && (
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Department</dt>
              <dd className="mt-1 text-sm text-gray-900">{normalizeText(normalizedContact.department)}</dd>
            </div>
          )}
        </div>
      </section>

      {/* Profile Summary Section */}
      {(profileSummary || currentTenureYears !== null || totalExperienceYears !== null) && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Profile Summary</h3>
          </div>
          {profileSummary && (
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">{profileSummary}</p>
          )}
          <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
            {currentTenureYears !== null && currentTenureYears !== undefined && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Current Tenure</dt>
                <dd className="mt-1 text-gray-900 font-semibold">{fmt(currentTenureYears)} {currentTenureYears === 1 ? 'year' : 'years'}</dd>
              </div>
            )}
            {totalExperienceYears !== null && totalExperienceYears !== undefined && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Total Experience</dt>
                <dd className="mt-1 text-gray-900 font-semibold">{fmt(totalExperienceYears)} {totalExperienceYears === 1 ? 'year' : 'years'}</dd>
              </div>
            )}
            {avgTenureYears !== null && avgTenureYears !== undefined && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Avg Tenure</dt>
                <dd className="mt-1 text-gray-900 font-semibold">{fmt(avgTenureYears)} {avgTenureYears === 1 ? 'year' : 'years'}</dd>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Intelligence Scores Section */}
      <section className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Intelligence Scores</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCard
            label="Seniority"
            score={intelligenceScores.seniorityScore}
            description="Title-based seniority level"
          />
          <ScoreCard
            label="Buying Power"
            score={intelligenceScores.buyingPowerScore}
            description="Authority + company budget capacity"
          />
          <ScoreCard
            label="Role Power"
            score={intelligenceScores.rolePowerScore}
            description="Decision-making power in role"
          />
          <ScoreCard
            label="Readiness"
            score={intelligenceScores.readinessToBuyScore}
            description="How ready they are to purchase"
          />
          <ScoreCard
            label="Urgency"
            score={intelligenceScores.urgencyScore}
            description="How urgent their need is"
          />
          <ScoreCard
            label="Career Momentum"
            score={intelligenceScores.careerMomentumScore}
            description="Career trajectory indicators"
          />
          <ScoreCard
            label="Career Stability"
            score={intelligenceScores.careerStabilityScore}
            description="Job stability metrics"
          />
          <ScoreCard
            label="Buyer Likelihood"
            score={intelligenceScores.buyerLikelihoodScore}
            description="Probability they're a buyer"
          />
        </div>
      </section>

      {/* Company Positioning / Identity Section */}
      {companyPositioning && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Company Identity</h3>
          </div>
          <div className="space-y-3 text-sm">
            {companyPositioning.positioningLabel && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Positioning</dt>
                <dd className="mt-1 text-gray-900">{normalizePositioning(companyPositioning.positioningLabel)}</dd>
              </div>
            )}
            {companyPositioning.category && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Category</dt>
                <dd className="mt-1 text-gray-900">{normalizeCategory(companyPositioning.category)}</dd>
              </div>
            )}
            {companyPositioning.normalizedIndustry && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Normalized Industry</dt>
                <dd className="mt-1 text-gray-900">{normalizeIndustry(companyPositioning.normalizedIndustry)}</dd>
              </div>
            )}
            {companyPositioning.revenueTier && normalizedCompany.revenue && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Revenue Tier</dt>
                <dd className="mt-1 text-gray-900">
                  {normalizeTier(companyPositioning.revenueTier)} ({formatRevenue(normalizedCompany.revenue)})
                </dd>
              </div>
            )}
            {companyPositioning.headcountTier && normalizedCompany.headcount && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Headcount Tier</dt>
                <dd className="mt-1 text-gray-900">
                  {normalizeTier(companyPositioning.headcountTier)} ({normalizedCompany.headcount.toLocaleString()} employees)
                </dd>
              </div>
            )}
            {companyPositioning.competitors && companyPositioning.competitors.length > 0 && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Competitors</dt>
                <dd className="mt-1 text-gray-900">{companyPositioning.competitors.join(', ')}</dd>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Company Intelligence Section */}
      {normalizedCompany && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Company Intelligence</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Company Name</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">
                {normalizedCompany.companyName || '—'}
              </dd>
            </div>
            {normalizedCompany.domain && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Domain</dt>
                <dd className="mt-1 text-sm text-gray-900">{normalizedCompany.domain}</dd>
              </div>
            )}
            {normalizedCompany.industry && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Industry</dt>
                <dd className="mt-1 text-sm text-gray-900">{normalizeIndustry(normalizedCompany.industry)}</dd>
              </div>
            )}
            {normalizedCompany.headcount && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Headcount</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {normalizedCompany.headcount.toLocaleString()} employees
                </dd>
              </div>
            )}
            {normalizedCompany.revenue !== null && normalizedCompany.revenue !== undefined && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Revenue</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatRevenue(normalizedCompany.revenue)}
                </dd>
              </div>
            )}
            {normalizedCompany.growthRate !== null && normalizedCompany.growthRate !== undefined && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Growth Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {normalizedCompany.growthRate}%
                </dd>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ScoreCard
              label="Health"
              score={companyIntelligence.companyHealthScore}
              description="Overall company health"
            />
            <ScoreCard
              label="Growth"
              score={companyIntelligence.growthScore}
              description="Growth trajectory"
            />
            <ScoreCard
              label="Stability"
              score={companyIntelligence.stabilityScore}
              description="Financial stability"
            />
            <ScoreCard
              label="Market Position"
              score={companyIntelligence.marketPositionScore}
              description="Market competitiveness"
            />
            <ScoreCard
              label="Readiness"
              score={companyIntelligence.readinessScore}
              description="Readiness to buy/partner"
            />
          </div>
        </section>
      )}

      {/* Career Timeline - LinkedIn Style */}
      {careerTimeline && careerTimeline.length > 0 && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Career Snapshot</h3>
          </div>
          <div className="space-y-4">
            {careerTimeline.map((role, index) => {
              // Extract years - use startYear/endYear if available, otherwise parse from dates
              const startYear = role.startYear || (role.startDate ? new Date(role.startDate).getFullYear() : null);
              const endYear = role.endYear !== undefined ? role.endYear : (role.endDate ? new Date(role.endDate).getFullYear() : null);
              const yearRange = endYear ? `${startYear}-${endYear}` : `${startYear}-Present`;
              
              return (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-1 h-full bg-indigo-200 rounded-full mt-1 mb-1"></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">
                      {role.company}
                    </p>
                    <p className="text-sm text-gray-700 mt-0.5">
                      {yearRange} {normalizeTitle(role.title)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Career Signals - Recent Changes Only */}
      {(normalizedContact.recentJobChange || normalizedContact.recentPromotion) && (
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Briefcase className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Career Signals</h3>
          </div>
          <div className="space-y-3">
            {normalizedContact.recentJobChange && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">Recent job change (last 6 months)</span>
              </div>
            )}
            {normalizedContact.recentPromotion && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">Recent promotion (last 12 months)</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

