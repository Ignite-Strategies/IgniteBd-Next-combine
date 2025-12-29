/**
 * Apollo Field Mapper Service
 * 
 * Comprehensive mapping of Apollo API fields to our Contact/Company models
 * Ensures we capture all available data from Apollo enrichment
 */

/**
 * Infer timezone from location (basic mapping)
 * Returns IANA timezone string or null
 */
export function inferTimezoneFromLocation(
  city?: string,
  state?: string,
  country?: string
): string | null {
  if (!country) return null;

  const countryLower = country.toLowerCase();
  const stateLower = state?.toLowerCase() || '';

  // Major US timezones by state
  if (countryLower === 'united states' || countryLower === 'usa') {
    // Pacific Time
    if (['california', 'washington', 'oregon', 'nevada'].some(s => stateLower.includes(s))) {
      return 'America/Los_Angeles';
    }
    // Mountain Time
    if (['colorado', 'utah', 'arizona', 'new mexico', 'wyoming', 'montana'].some(s => stateLower.includes(s))) {
      return 'America/Denver';
    }
    // Central Time
    if (['texas', 'illinois', 'missouri', 'oklahoma', 'arkansas', 'louisiana', 'mississippi', 'alabama', 'tennessee', 'kentucky'].some(s => stateLower.includes(s))) {
      return 'America/Chicago';
    }
    // Eastern Time
    if (['new york', 'florida', 'georgia', 'north carolina', 'south carolina', 'virginia', 'pennsylvania', 'massachusetts', 'connecticut'].some(s => stateLower.includes(s))) {
      return 'America/New_York';
    }
    // Default to Eastern for US
    return 'America/New_York';
  }

  // Major international cities
  if (city) {
    const cityLower = city.toLowerCase();
    
    // UK
    if (countryLower === 'united kingdom' || countryLower === 'uk') {
      return 'Europe/London';
    }
    
    // Canada
    if (countryLower === 'canada') {
      if (['toronto', 'montreal', 'ottawa'].some(c => cityLower.includes(c))) {
        return 'America/Toronto';
      }
      if (['vancouver', 'calgary'].some(c => cityLower.includes(c))) {
        return 'America/Vancouver';
      }
    }
    
    // Major European cities
    if (['london'].some(c => cityLower.includes(c))) return 'Europe/London';
    if (['paris', 'france'].some(c => cityLower.includes(c))) return 'Europe/Paris';
    if (['berlin', 'germany'].some(c => cityLower.includes(c))) return 'Europe/Berlin';
    if (['amsterdam', 'netherlands'].some(c => cityLower.includes(c))) return 'Europe/Amsterdam';
    if (['madrid', 'spain'].some(c => cityLower.includes(c))) return 'Europe/Madrid';
    if (['rome', 'italy'].some(c => cityLower.includes(c))) return 'Europe/Rome';
    
    // Asia
    if (['tokyo', 'japan'].some(c => cityLower.includes(c))) return 'Asia/Tokyo';
    if (['singapore'].some(c => cityLower.includes(c))) return 'Asia/Singapore';
    if (['hong kong'].some(c => cityLower.includes(c))) return 'Asia/Hong_Kong';
    if (['sydney', 'australia'].some(c => cityLower.includes(c))) return 'Australia/Sydney';
    if (['mumbai', 'delhi', 'bangalore', 'india'].some(c => cityLower.includes(c))) return 'Asia/Kolkata';
    
    // Middle East
    if (['dubai', 'uae'].some(c => cityLower.includes(c))) return 'Asia/Dubai';
  }

  // Country-level defaults
  const countryTimezoneMap: Record<string, string> = {
    'united kingdom': 'Europe/London',
    'uk': 'Europe/London',
    'france': 'Europe/Paris',
    'germany': 'Europe/Berlin',
    'spain': 'Europe/Madrid',
    'italy': 'Europe/Rome',
    'netherlands': 'Europe/Amsterdam',
    'japan': 'Asia/Tokyo',
    'china': 'Asia/Shanghai',
    'india': 'Asia/Kolkata',
    'australia': 'Australia/Sydney',
    'brazil': 'America/Sao_Paulo',
    'mexico': 'America/Mexico_City',
  };

  return countryTimezoneMap[countryLower] || null;
}

/**
 * Detect recent promotion from employment history
 * A promotion is when:
 * 1. Title changes to a higher seniority level within the same company
 * 2. Happened within the last 12 months
 */
export function detectRecentPromotion(
  employmentHistory: Array<{
    started_at?: string;
    ended_at?: string | null;
    title?: string;
    organization?: { name?: string };
  }>
): boolean {
  if (employmentHistory.length < 2) return false;

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

  // Sort by start date (most recent first)
  const sortedJobs = [...employmentHistory]
    .filter(job => job.started_at)
    .sort((a, b) => {
      const dateA = new Date(a.started_at!).getTime();
      const dateB = new Date(b.started_at!).getTime();
      return dateB - dateA; // Most recent first
    });

  // Check if current role (first job, no end date) started within last 12 months
  const currentJob = sortedJobs[0];
  if (!currentJob || currentJob.ended_at) return false; // Not current job

  const currentJobStart = new Date(currentJob.started_at!);
  if (currentJobStart < twelveMonthsAgo) return false; // Too old

  // Check if there's a previous job at the same company with a lower title
  const currentCompany = currentJob.organization?.name?.toLowerCase();
  const currentTitle = currentJob.title?.toLowerCase() || '';

  for (let i = 1; i < sortedJobs.length; i++) {
    const prevJob = sortedJobs[i];
    const prevCompany = prevJob.organization?.name?.toLowerCase();
    const prevTitle = prevJob.title?.toLowerCase() || '';

    // Same company, different title
    if (prevCompany === currentCompany && prevTitle !== currentTitle) {
      // Check if title progression indicates promotion
      const seniorityLevels = [
        'intern', 'assistant', 'associate', 'coordinator',
        'specialist', 'analyst',
        'manager', 'senior manager',
        'director', 'senior director',
        'vp', 'vice president', 'svp', 'senior vice president',
        'president', 'ceo', 'chief'
      ];

      const prevLevel = seniorityLevels.findIndex(level => prevTitle.includes(level));
      const currentLevel = seniorityLevels.findIndex(level => currentTitle.includes(level));

      // Promotion if current level is higher than previous
      if (currentLevel > prevLevel && currentLevel > -1 && prevLevel > -1) {
        return true;
      }

      // Also check for explicit promotion keywords
      const promotionKeywords = ['senior', 'lead', 'head', 'chief', 'vp', 'director', 'manager'];
      const demotionKeywords = ['junior', 'assistant', 'associate', 'coordinator'];
      
      const hasPromotionKeyword = promotionKeywords.some(keyword => 
        currentTitle.includes(keyword) && !prevTitle.includes(keyword)
      );
      const hasDemotionKeyword = demotionKeywords.some(keyword => 
        currentTitle.includes(keyword) && !prevTitle.includes(keyword)
      );

      if (hasPromotionKeyword && !hasDemotionKeyword) {
        return true;
      }
    }
  }

  return false;
}

