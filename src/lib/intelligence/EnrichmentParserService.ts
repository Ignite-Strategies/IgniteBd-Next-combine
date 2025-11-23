/**
 * EnrichmentParserService
 * 
 * Extracts intelligence scores from Apollo enrichment payload
 * Converts raw enrichment data into structured intelligence scores (0-100)
 */

export interface ApolloEnrichmentPayload {
  person?: {
    seniority?: string;
    title?: string;
    organization?: {
      name?: string;
      employees?: number;
      estimated_num_employees?: number;
      annual_revenue?: number;
      revenue_range?: string;
      growth_rate?: number;
      funding_events?: Array<{
        date?: string;
        amount?: number;
      }>;
    };
    employment_history?: Array<{
      started_at?: string;
      ended_at?: string | null;
      title?: string;
    }>;
  };
}

/**
 * Extract seniority score (0-100) from Apollo payload
 * 
 * Scoring logic:
 * - C-level (CEO, CTO, CFO, etc.): 90-100
 * - VP/Director: 70-89
 * - Manager/Senior: 50-69
 * - Individual Contributor: 30-49
 * - Entry/Junior: 0-29
 */
export function extractSeniorityScore(apollo: ApolloEnrichmentPayload): number {
  const seniority = apollo.person?.seniority?.toLowerCase() || '';
  const title = apollo.person?.title?.toLowerCase() || '';

  // C-level executives
  if (
    seniority.includes('executive') ||
    title.includes('ceo') ||
    title.includes('cto') ||
    title.includes('cfo') ||
    title.includes('coo') ||
    title.includes('president') ||
    title.includes('founder')
  ) {
    return 95;
  }

  // VP level
  if (
    seniority.includes('vp') ||
    seniority.includes('vice president') ||
    title.includes('vp') ||
    title.includes('vice president')
  ) {
    return 80;
  }

  // Director level
  if (
    seniority.includes('director') ||
    title.includes('director') ||
    title.includes('head of')
  ) {
    return 70;
  }

  // Manager/Senior level
  if (
    seniority.includes('manager') ||
    seniority.includes('senior') ||
    title.includes('manager') ||
    title.includes('senior') ||
    title.includes('lead')
  ) {
    return 60;
  }

  // Individual contributor
  if (
    seniority.includes('individual') ||
    seniority.includes('contributor') ||
    title.includes('specialist') ||
    title.includes('analyst') ||
    title.includes('coordinator')
  ) {
    return 40;
  }

  // Entry/Junior
  if (
    seniority.includes('entry') ||
    seniority.includes('junior') ||
    seniority.includes('associate') ||
    title.includes('junior') ||
    title.includes('associate')
  ) {
    return 20;
  }

  // Default: assume mid-level if title exists but no clear seniority
  if (title) {
    return 50;
  }

  // No data
  return 0;
}

/**
 * Extract buying power score (0-100) from Apollo payload
 * 
 * Scoring logic based on:
 * - Title/role authority (decision-making power)
 * - Company size (larger = more budget)
 * - Revenue indicators
 */
export function extractBuyingPowerScore(apollo: ApolloEnrichmentPayload): number {
  const title = apollo.person?.title?.toLowerCase() || '';
  const org = apollo.person?.organization;
  const employees = org?.employees || org?.estimated_num_employees || 0;
  const revenue = org?.annual_revenue || 0;
  const revenueRange = org?.revenue_range?.toLowerCase() || '';

  let score = 0;

  // Title-based authority (0-60 points)
  if (
    title.includes('ceo') ||
    title.includes('founder') ||
    title.includes('president') ||
    title.includes('owner')
  ) {
    score += 60;
  } else if (
    title.includes('cfo') ||
    title.includes('cto') ||
    title.includes('coo') ||
    title.includes('vp') ||
    title.includes('vice president')
  ) {
    score += 50;
  } else if (
    title.includes('director') ||
    title.includes('head of') ||
    title.includes('chief')
  ) {
    score += 40;
  } else if (
    title.includes('manager') ||
    title.includes('senior') ||
    title.includes('lead')
  ) {
    score += 25;
  } else if (title) {
    score += 15;
  }

  // Company size (0-25 points)
  if (employees >= 10000) {
    score += 25;
  } else if (employees >= 1000) {
    score += 20;
  } else if (employees >= 100) {
    score += 15;
  } else if (employees >= 10) {
    score += 10;
  } else if (employees > 0) {
    score += 5;
  }

  // Revenue indicators (0-15 points)
  if (revenue >= 1000000000) {
    // $1B+
    score += 15;
  } else if (revenue >= 100000000) {
    // $100M+
    score += 12;
  } else if (revenue >= 10000000) {
    // $10M+
    score += 10;
  } else if (revenue >= 1000000) {
    // $1M+
    score += 7;
  } else if (revenue > 0) {
    score += 5;
  } else if (revenueRange.includes('million') || revenueRange.includes('billion')) {
    score += 8;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Extract urgency score (0-100) from Apollo payload
 * 
 * Scoring logic based on:
 * - Recent job changes (recent change = higher urgency)
 * - Company growth indicators (growing = higher urgency)
 * - Funding events (recent funding = higher urgency)
 */
export function extractUrgencyScore(apollo: ApolloEnrichmentPayload): number {
  const org = apollo.person?.organization;
  const employmentHistory = apollo.person?.employment_history || [];
  const fundingEvents = org?.funding_events || [];
  const growthRate = org?.growth_rate || 0;

  let score = 50; // Base score (neutral)

  // Recent job change (within last 6 months = high urgency)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

  for (const job of employmentHistory) {
    if (job.started_at) {
      const startDate = new Date(job.started_at);
      if (startDate >= sixMonthsAgo && !job.ended_at) {
        // Recent job change, still in role
        score += 30;
        break;
      }
    }
  }

  // Company growth indicators
  if (growthRate > 50) {
    score += 20; // High growth = urgent need
  } else if (growthRate > 20) {
    score += 15;
  } else if (growthRate > 0) {
    score += 10;
  }

  // Recent funding (within last 12 months = higher urgency)
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  for (const event of fundingEvents) {
    if (event.date) {
      const eventDate = new Date(event.date);
      if (eventDate >= oneYearAgo) {
        score += 15; // Recent funding = growth mode
        break;
      }
    }
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Extract company intelligence from Apollo payload
 * 
 * Returns:
 * - companyHealthScore: 0-100 (computed from multiple factors)
 * - headcount: Number of employees
 * - revenue: Annual revenue
 * - growthRate: Growth rate percentage
 */
export function extractCompanyIntelligence(apollo: ApolloEnrichmentPayload): {
  companyHealthScore: number;
  headcount: number | null;
  revenue: number | null;
  growthRate: number | null;
} {
  const org = apollo.person?.organization;
  const employees = org?.employees || org?.estimated_num_employees || null;
  const revenue = org?.annual_revenue || null;
  const growthRate = org?.growth_rate || null;
  const revenueRange = org?.revenue_range?.toLowerCase() || '';

  let healthScore = 50; // Base score

  // Headcount scoring (0-30 points)
  if (employees) {
    if (employees >= 1000) {
      healthScore += 30; // Large, established
    } else if (employees >= 100) {
      healthScore += 25; // Mid-size
    } else if (employees >= 10) {
      healthScore += 15; // Small but growing
    } else if (employees > 0) {
      healthScore += 5; // Very small
    }
  }

  // Revenue scoring (0-30 points)
  if (revenue) {
    if (revenue >= 1000000000) {
      healthScore += 30; // $1B+
    } else if (revenue >= 100000000) {
      healthScore += 25; // $100M+
    } else if (revenue >= 10000000) {
      healthScore += 20; // $10M+
    } else if (revenue >= 1000000) {
      healthScore += 15; // $1M+
    } else if (revenue > 0) {
      healthScore += 10;
    }
  } else if (revenueRange) {
    // Fallback to revenue range if exact revenue not available
    if (revenueRange.includes('billion')) {
      healthScore += 25;
    } else if (revenueRange.includes('million')) {
      healthScore += 15;
    }
  }

  // Growth rate scoring (0-20 points)
  if (growthRate !== null && growthRate !== undefined) {
    if (growthRate > 50) {
      healthScore += 20; // High growth
    } else if (growthRate > 20) {
      healthScore += 15;
    } else if (growthRate > 0) {
      healthScore += 10;
    } else if (growthRate < -10) {
      healthScore -= 10; // Declining
    }
  }

  // Funding events (0-20 points)
  const fundingEvents = org?.funding_events || [];
  if (fundingEvents.length > 0) {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    
    const recentFunding = fundingEvents.some(event => {
      if (event.date) {
        return new Date(event.date) >= twoYearsAgo;
      }
      return false;
    });

    if (recentFunding) {
      healthScore += 20; // Recent funding = healthy
    } else {
      healthScore += 10; // Has funding history
    }
  }

  return {
    companyHealthScore: Math.min(100, Math.max(0, healthScore)),
    headcount: employees,
    revenue: revenue || null,
    growthRate: growthRate || null,
  };
}

