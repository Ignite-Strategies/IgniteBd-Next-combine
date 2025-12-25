/**
 * Apollo API Helper
 * 
 * Separates Apollo LOOKUP (light) from Apollo ENRICH (deep)
 * 
 * LOOKUP (/people/match) - Used for preview only
 * - Returns: name, title, company, avatar
 * - No emails, no phones, no full enrichment
 * 
 * ENRICH (/people/enrich) - Used for full enrichment
 * - Returns: complete profile data including emails, phones, etc.
 */

const APOLLO_API_URL = 'https://api.apollo.io/api/v1';

/**
 * Get Apollo API key (lazy evaluation to avoid build-time execution)
 * Environment variables should only be accessed at runtime, not during module load
 */
function getApolloApiKey() {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error('APOLLO_API_KEY environment variable is not set');
  }
  return apiKey;
}

export interface ApolloPersonMatchResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    email?: string;
    title?: string;
    seniority?: string;
    department?: string;
    linkedin_url?: string;
    phone_numbers?: Array<{ raw_number?: string; sanitized_number?: string }>;
    city?: string;
    state?: string;
    country?: string;
    organization?: {
      name?: string;
      website_url?: string;
      primary_domain?: string;
    };
    photo_url?: string; // Avatar URL
  };
}

export interface NormalizedContactData {
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  seniority?: string;
  department?: string;
  linkedinUrl?: string;
  phone?: string | null;
  city?: string;
  state?: string;
  country?: string;
  companyName?: string;
  companyDomain?: string;
  avatarUrl?: string;
}

/**
 * Normalize Apollo's response into our internal Contact shape
 */
export function normalizeApolloResponse(apolloData: ApolloPersonMatchResponse): NormalizedContactData {
  const person = apolloData.person;
  if (!person) {
    return {};
  }

  const normalized: NormalizedContactData = {};

  // Email
  if (person.email) {
    normalized.email = person.email;
  }

  // Name fields
  if (person.name) {
    normalized.fullName = person.name;
  }
  if (person.first_name) {
    normalized.firstName = person.first_name;
  }
  if (person.last_name) {
    normalized.lastName = person.last_name;
  }

  // Title and role
  if (person.title) {
    normalized.title = person.title;
  }
  if (person.seniority) {
    normalized.seniority = person.seniority;
  }
  if (person.department) {
    normalized.department = person.department;
  }

  // LinkedIn
  if (person.linkedin_url) {
    normalized.linkedinUrl = person.linkedin_url;
  }

  // Phone - take first phone number if available
  if (person.phone_numbers && person.phone_numbers.length > 0) {
    const phoneNumber = person.phone_numbers[0];
    normalized.phone = phoneNumber.sanitized_number || phoneNumber.raw_number || null;
  }

  // Location
  if (person.city) {
    normalized.city = person.city;
  }
  if (person.state) {
    normalized.state = person.state;
  }
  if (person.country) {
    normalized.country = person.country;
  }

  // Avatar
  if (person.photo_url) {
    normalized.avatarUrl = person.photo_url;
  }

  // Company information
  if (person.organization) {
    if (person.organization.name) {
      normalized.companyName = person.organization.name;
    }
    if (person.organization.primary_domain) {
      normalized.companyDomain = person.organization.primary_domain;
    } else if (person.organization.website_url) {
      // Extract domain from website URL if primary_domain is not available
      try {
        const url = new URL(person.organization.website_url);
        normalized.companyDomain = url.hostname.replace(/^www\./, '');
      } catch {
        // Invalid URL, skip
      }
    }
  }

  return normalized;
}

/**
 * Normalize LinkedIn URL for Apollo API
 */
function normalizeLinkedInUrl(linkedinUrl: string): string {
  let normalizedUrl = linkedinUrl.trim();
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  // Validate LinkedIn URL
  try {
    const url = new URL(normalizedUrl);
    if (!url.hostname.includes('linkedin.com')) {
      throw new Error('Invalid LinkedIn URL');
    }
  } catch {
    throw new Error('Invalid LinkedIn URL format');
  }

  return normalizedUrl;
}

/**
 * Apollo LOOKUP - Light lookup using /people/match
 * 
 * Used ONLY for preview - returns basic info (name, title, company, avatar)
 * Does NOT return emails or phones
 * 
 * @param options - { linkedinUrl?: string, email?: string }
 * @returns Promise<ApolloPersonMatchResponse> Light lookup response
 */
export async function lookupPerson(options: { linkedinUrl?: string; email?: string }): Promise<ApolloPersonMatchResponse> {
  const { linkedinUrl, email } = options;

  const apiKey = getApolloApiKey();

  if (!linkedinUrl && !email) {
    throw new Error('Either linkedinUrl or email is required');
  }

  if (email && !email.includes('@')) {
    throw new Error('Valid email address is required');
  }

  // Prepare request body
  const requestBody: any = {};
  if (linkedinUrl) {
    requestBody.linkedin_url = normalizeLinkedInUrl(linkedinUrl);
  }
  if (email) {
    requestBody.email = email.trim().toLowerCase();
  }

  try {
    const response = await fetch(`${APOLLO_API_URL}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `Apollo API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: ApolloPersonMatchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Apollo lookupPerson error:', error);
    throw error;
  }
}

/**
 * Apollo ENRICH - Deep lookup using /people/enrich
 * 
 * Used ONLY for enrichment - returns full profile data including emails, phones, etc.
 * 
 * @param options - { linkedinUrl?: string, email?: string }
 * @returns Promise<ApolloPersonMatchResponse> Full enrichment response
 */
export async function enrichPerson(options: { linkedinUrl?: string; email?: string }): Promise<ApolloPersonMatchResponse> {
  const { linkedinUrl, email } = options;

  const apiKey = getApolloApiKey();

  if (!linkedinUrl && !email) {
    throw new Error('Either linkedinUrl or email is required');
  }

  if (email && !email.includes('@')) {
    throw new Error('Valid email address is required');
  }

  // Prepare request body
  const requestBody: any = {};
  if (linkedinUrl) {
    requestBody.linkedin_url = normalizeLinkedInUrl(linkedinUrl);
  }
  if (email) {
    requestBody.email = email.trim().toLowerCase();
  }

  try {
    const response = await fetch(`${APOLLO_API_URL}/people/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorMessage = `Apollo API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        const errorText = await response.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data: ApolloPersonMatchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Apollo enrichPerson error:', error);
    throw error;
  }
}

/**
 * Search for a company by domain using Apollo's API
 * 
 * @param domain - Company domain (e.g., "example.com")
 * @returns Promise<Object> Company data from Apollo
 */
export async function searchCompanyByDomain(domain: string): Promise<Object> {
  const apiKey = getApolloApiKey();

  if (!domain) {
    throw new Error('Domain is required');
  }

  // Remove protocol and www if present
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').trim();

  try {
    const response = await fetch(`${APOLLO_API_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_keywords: cleanDomain,
        per_page: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Apollo searchCompanyByDomain error:', error);
    throw error;
  }
}

/**
 * @deprecated Use lookupPerson() for preview or enrichPerson() for enrichment
 * This function is kept for backward compatibility but will be removed
 */
export async function enrichContact(email?: string, linkedinUrl?: string): Promise<NormalizedContactData> {
  console.warn('⚠️ enrichContact() is deprecated. Use enrichPerson() instead.');
  
  if (!email && !linkedinUrl) {
    throw new Error('Either email or LinkedIn URL is required');
  }

  try {
    const apolloResponse = await enrichPerson({ email, linkedinUrl });
    const normalized = normalizeApolloResponse(apolloResponse);
    return normalized;
  } catch (error) {
    console.error('❌ Apollo enrichContact error:', error);
    throw error;
  }
}
