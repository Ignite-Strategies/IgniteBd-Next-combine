/**
 * Apollo API Helper
 * 
 * Apollo enrichment service for Contact model.
 * Uses Apollo's People Match API to enrich contacts by email.
 */

const APOLLO_API_URL = 'https://api.apollo.io/api/v1';
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

if (!APOLLO_API_KEY) {
  console.warn('⚠️ APOLLO_API_KEY environment variable is not set');
}

export interface ApolloPersonMatchResponse {
  person?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
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
  };
}

export interface NormalizedContactData {
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
}

/**
 * Normalize Apollo's response into our internal Contact shape
 */
function normalizeApolloResponse(apolloData: ApolloPersonMatchResponse): NormalizedContactData {
  const person = apolloData.person;
  if (!person) {
    return {};
  }

  const normalized: NormalizedContactData = {};

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
 * Search for a person by email using Apollo's People Match API
 * 
 * @param email - Email address to search for
 * @returns Promise<ApolloPersonMatchResponse>
 */
export async function searchPersonByEmail(email: string): Promise<ApolloPersonMatchResponse> {
  if (!APOLLO_API_KEY) {
    throw new Error('APOLLO_API_KEY environment variable is not set');
  }

  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required');
  }

  try {
    const response = await fetch(`${APOLLO_API_URL}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: APOLLO_API_KEY,
        email: email.trim().toLowerCase(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apollo API error: ${response.status} - ${errorText}`);
    }

    const data: ApolloPersonMatchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Apollo searchPersonByEmail error:', error);
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
  if (!APOLLO_API_KEY) {
    throw new Error('APOLLO_API_KEY environment variable is not set');
  }

  if (!domain) {
    throw new Error('Domain is required');
  }

  // Remove protocol and www if present
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').trim();

  try {
    // Apollo's organization search endpoint
    const response = await fetch(`${APOLLO_API_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: APOLLO_API_KEY,
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
 * Enrich a contact using Apollo
 * This is the main enrichment function that normalizes Apollo's response
 * 
 * @param email - Email address to enrich
 * @returns Promise<NormalizedContactData> Normalized contact data ready for Contact model
 */
export async function enrichContact(email: string): Promise<NormalizedContactData> {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required');
  }

  try {
    const apolloResponse = await searchPersonByEmail(email);
    const normalized = normalizeApolloResponse(apolloResponse);
    return normalized;
  } catch (error) {
    console.error('❌ Apollo enrichContact error:', error);
    throw error;
  }
}
