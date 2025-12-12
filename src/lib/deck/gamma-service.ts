/**
 * Gamma API Service
 * Handles communication with Gamma Generate API (v1.0)
 * 
 * Gamma v1.0 generation is ASYNCHRONOUS:
 * - POST returns only generationId
 * - GET /generations/{generationId} returns status and result
 */

const GAMMA_API_URL = 'https://public-api.gamma.app/v1.0/generations';

export interface GammaGenerateResponse {
  generationId: string;  // Returned from POST - use this to check status
}

export interface GammaStatusResponse {
  status: 'pending' | 'processing' | 'ready' | 'error';
  id?: string;      // Deck ID (only when status === 'ready')
  url?: string;     // Shareable deck URL (only when status === 'ready')
  error?: string;   // Error message (only when status === 'error')
}

/**
 * Starts a deck generation using Gamma API (asynchronous)
 * 
 * @param inputText - Human-readable structured narrative (not JSON, not markdown)
 * @returns Promise with generationId (use this to check status)
 */
export async function generateDeckWithGamma(
  inputText: string
): Promise<{ generationId: string }> {
  const apiKey = process.env.GAMMA_API_KEY;

  if (!apiKey) {
    throw new Error('GAMMA_API_KEY environment variable is not set');
  }

  const requestBody = {
    inputText: inputText,
    textMode: 'generate', // Required: 'generate' | 'condense' | 'preserve'
  };

  console.log('🎨 Gamma API Request:', {
    url: GAMMA_API_URL,
    method: 'POST',
    inputTextLength: inputText.length,
    hasApiKey: !!apiKey,
    requestBodyPreview: inputText.substring(0, 200) + '...',
  });

  try {
    const response = await fetch(GAMMA_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('🎨 Gamma API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gamma API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        // Extract all possible error fields
        errorMessage = errorJson.error || 
                      errorJson.message || 
                      errorJson.detail ||
                      errorJson.description ||
                      errorMessage;
        
        // Log full error response for debugging
        console.error('❌ Gamma API error response:', {
          status: response.status,
          statusText: response.statusText,
          errorJson,
          errorText,
        });
      } catch {
        // If parsing fails, use the raw text
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
        console.error('❌ Gamma API error (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
      }

      // Handle rate limits
      if (response.status === 429) {
        throw new Error('Gamma API rate limit exceeded. Please try again later.');
      }

      throw new Error(errorMessage);
    }

    const data: GammaGenerateResponse = await response.json();

    // Log the full response for debugging
    console.log('🎨 Gamma API POST response data:', JSON.stringify(data, null, 2));

    // POST only returns generationId - this is expected and successful
    if (!data.generationId) {
      throw new Error(
        `Gamma API response missing generationId. Got: ${JSON.stringify(data)}`
      );
    }

    return { generationId: data.generationId };
  } catch (error) {
    // Log the full error for debugging
    console.error('❌ Gamma API catch block error:', {
      error,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorString: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });

    if (error instanceof Error) {
      throw error;
    }
    
    // Handle non-Error objects (like API response errors)
    if (error && typeof error === 'object') {
      const errorDetails = JSON.stringify(error, null, 2);
      throw new Error(`Failed to generate deck with Gamma: ${errorDetails}`);
    }
    
    throw new Error(`Failed to generate deck with Gamma: ${String(error)}`);
  }
}

/**
 * Checks the status of a Gamma generation
 * 
 * @param generationId - The generationId returned from POST
 * @returns Promise with status and result (id/url when ready)
 */
export async function checkGammaGenerationStatus(
  generationId: string
): Promise<GammaStatusResponse> {
  const apiKey = process.env.GAMMA_API_KEY;

  if (!apiKey) {
    throw new Error('GAMMA_API_KEY environment variable is not set');
  }

  const statusUrl = `${GAMMA_API_URL}/${generationId}`;

  console.log('🎨 Checking Gamma generation status:', generationId);

  try {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Gamma API status check error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || 
                      errorJson.message || 
                      errorJson.detail ||
                      errorJson.description ||
                      errorMessage;
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      throw new Error(errorMessage);
    }

    const data: GammaStatusResponse = await response.json();

    console.log('🎨 Gamma generation status:', {
      generationId,
      status: data.status,
      hasId: !!data.id,
      hasUrl: !!data.url,
    });

    return data;
  } catch (error) {
    console.error('❌ Gamma status check error:', {
      generationId,
      error,
      errorType: typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Failed to check Gamma generation status: ${String(error)}`);
  }
}

