/**
 * Normalize Contact Data from Apollo Enrichment
 * 
 * Extracts all normalized contact fields from Apollo enrichment payload
 * Returns data structure matching Contact model fields
 */

import type { ApolloPersonMatchResponse } from '@/lib/apollo';
import { inferTimezoneFromLocation, detectRecentPromotion } from './apolloFieldMapper';

export interface NormalizedContactFields {
  // Basic Info
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  
  // Professional
  title?: string;
  seniority?: string;
  department?: string;
  jobRole?: string;
  
  // Location
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  
  // Career signals
  currentRoleStartDate?: Date;
  totalYearsExperience?: number;
  numberOfJobChanges?: number;
  averageTenureMonths?: number;
  careerProgression?: 'accelerating' | 'stable' | 'declining';
  recentJobChange?: boolean;
  recentPromotion?: boolean;
  
  // Company context
  companyName?: string;
  companyDomain?: string;
  companySize?: string;
  companyIndustry?: string;
}

/**
 * Normalize contact fields from Apollo enrichment payload
 */
export function normalizeContactApollo(apolloData: ApolloPersonMatchResponse): NormalizedContactFields {
  const person = apolloData.person;
  if (!person) {
    return {};
  }

  const normalized: NormalizedContactFields = {};

  // Basic Info
  if (person.name) normalized.fullName = person.name;
  if (person.first_name) normalized.firstName = person.first_name;
  if (person.last_name) normalized.lastName = person.last_name;
  if (person.email) normalized.email = person.email;
  if (person.linkedin_url) normalized.linkedinUrl = person.linkedin_url;
  
  // Phone - take first phone number if available
  if (person.phone_numbers && person.phone_numbers.length > 0) {
    const phoneNumber = person.phone_numbers[0];
    normalized.phone = phoneNumber.sanitized_number || phoneNumber.raw_number || undefined;
  }

  // Professional
  if (person.title) normalized.title = person.title;
  if (person.seniority) normalized.seniority = person.seniority;
  if (person.department) normalized.department = person.department;
  // Job role can be derived from title if needed
  if (person.title) normalized.jobRole = person.title;

  // Location
  if (person.city) normalized.city = person.city;
  if (person.state) normalized.state = person.state;
  if (person.country) normalized.country = person.country;
  
  // Infer timezone from location
  normalized.timezone = inferTimezoneFromLocation(
    normalized.city,
    normalized.state,
    normalized.country
  ) || undefined;

  // Career signals - extract from employment_history if available
  const employmentHistory = (apolloData as any).person?.employment_history || [];
  if (employmentHistory.length > 0) {
    // Find current role (no end date)
    const currentRole = employmentHistory.find((job: any) => !job.ended_at);
    if (currentRole?.started_at) {
      normalized.currentRoleStartDate = new Date(currentRole.started_at);
    }

    // Calculate career metrics
    normalized.numberOfJobChanges = employmentHistory.length;
    
    // Calculate total years experience
    let totalMonths = 0;
    for (const job of employmentHistory) {
      if (job.started_at) {
        const startDate = new Date(job.started_at);
        const endDate = job.ended_at ? new Date(job.ended_at) : new Date();
        const months = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        totalMonths += Math.max(0, months);
      }
    }
    if (totalMonths > 0) {
      normalized.totalYearsExperience = totalMonths / 12;
      normalized.averageTenureMonths = totalMonths / employmentHistory.length;
    }

    // Recent job change (within last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    normalized.recentJobChange = employmentHistory.some((job: any) => {
      if (job.started_at) {
        const startDate = new Date(job.started_at);
        return startDate >= sixMonthsAgo && !job.ended_at;
      }
      return false;
    });

    // Career progression analysis
    if (employmentHistory.length >= 2) {
      // Simple heuristic: check if titles are progressing upward
      const titles = employmentHistory.map((job: any) => job.title?.toLowerCase() || '');
      const hasProgression = titles.some((title: string, index: number) => {
        if (index === 0) return false;
        const prevTitle = titles[index - 1];
        // Check for upward movement (e.g., manager -> director, director -> vp)
        const progressionKeywords = [
          ['manager', 'director'],
          ['director', 'vp'],
          ['vp', 'ceo'],
          ['senior', 'director'],
        ];
        return progressionKeywords.some(([from, to]) => 
          prevTitle.includes(from) && title.includes(to)
        );
      });
      normalized.careerProgression = hasProgression ? 'accelerating' : 'stable';
    } else {
      normalized.careerProgression = 'stable';
    }
    
    // Detect recent promotion (within last 12 months, same company, title upgrade)
    normalized.recentPromotion = detectRecentPromotion(employmentHistory);
  }

  // Company context
  const org = (apolloData as any).person?.organization;
  if (org) {
    if (org.name) normalized.companyName = org.name;
    if (org.primary_domain) {
      normalized.companyDomain = org.primary_domain;
    } else if (org.website_url) {
      try {
        const url = new URL(org.website_url);
        normalized.companyDomain = url.hostname.replace(/^www\./, '');
      } catch {
        // Invalid URL, skip
      }
    }
    
    // Company size from employees
    const employees = org.employees || org.estimated_num_employees;
    if (employees) {
      if (employees >= 1000) normalized.companySize = '1000+';
      else if (employees >= 500) normalized.companySize = '501-1000';
      else if (employees >= 200) normalized.companySize = '201-500';
      else if (employees >= 50) normalized.companySize = '51-200';
      else if (employees >= 10) normalized.companySize = '11-50';
      else if (employees > 0) normalized.companySize = '1-10';
    }
    
    // Industry
    if (org.industry) normalized.companyIndustry = org.industry;
  }

  return normalized;
}

