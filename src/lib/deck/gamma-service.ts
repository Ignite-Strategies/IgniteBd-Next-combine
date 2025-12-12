/**
 * Gamma API Service
 * Handles communication with Gamma Generate API
 */

const GAMMA_API_URL = 'https://public-api.gamma.app/v0.2/generations';

export interface GammaGenerateOptions {
  imageOptions?: {
    source?: 'auto' | 'unsplash' | 'none';
  };
}

export interface GammaGenerateResponse {
  id?: string;
  url?: string;
  fileUrl?: string;
  pptxUrl?: string;
  deckUrl?: string;
  status?: string;
  error?: string;
}

/**
 * Generates a deck using Gamma API
 * 
 * @param blob - The Gamma-formatted blob string
 * @returns Promise with fileUrl (deck URL or PPTX export URL)
 */
export async function generateDeckWithGamma(
  blob: string
): Promise<{ fileUrl: string }> {
  const apiKey = process.env.GAMMA_API_KEY;

  if (!apiKey) {
    throw new Error('GAMMA_API_KEY environment variable is not set');
  }

  try {
    const response = await fetch(GAMMA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputText: blob,
        options: {
          imageOptions: {
            source: 'auto',
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gamma API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        // If parsing fails, use the raw text
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      // Handle rate limits
      if (response.status === 429) {
        throw new Error('Gamma API rate limit exceeded. Please try again later.');
      }

      throw new Error(errorMessage);
    }

    const data: GammaGenerateResponse = await response.json();

    // Extract fileUrl from response
    // Gamma API may return different field names depending on the response format
    const fileUrl =
      data.fileUrl ||
      data.pptxUrl ||
      data.deckUrl ||
      data.url;

    if (!fileUrl) {
      // If no direct URL, construct it from the ID if available
      if (data.id) {
        // Gamma typically returns a deck ID that can be accessed at:
        // https://gamma.app/deck/{id}
        // Or we might need to poll for the result
        throw new Error(
          'Gamma API returned a generation ID but no file URL. The deck may still be processing.'
        );
      }

      throw new Error('Gamma API response did not include a file URL');
    }

    return { fileUrl };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate deck with Gamma: ${String(error)}`);
  }
}

