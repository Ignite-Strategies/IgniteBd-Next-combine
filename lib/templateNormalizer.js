/**
 * Normalize and parse OpenAI response for template generation
 * Handles various response formats and ensures consistent structure
 */

/**
 * Normalize OpenAI response to template model structure
 * @param {any} aiResponse - Raw response from OpenAI (can be parsed JSON or string)
 * @returns {{ title: string, subject: string, body: string }} - Normalized template structure
 */
export function normalizeTemplateResponse(aiResponse) {
  // If it's already an object with the right structure, validate and return
  if (typeof aiResponse === 'object' && aiResponse !== null) {
    // Check if it has the expected fields (some AI responses use 'content' instead of 'body')
    const normalized = {
      title: extractField(aiResponse, ['title', 'name', 'templateTitle']) || 'AI Generated Template',
      subject: extractField(aiResponse, ['subject', 'emailSubject', 'subjectLine']) || '',
      body: extractField(aiResponse, ['body', 'content', 'emailBody', 'message', 'template']) || '',
    };

    // Validate required fields
    if (!normalized.subject || !normalized.body) {
      throw new Error('AI response missing required fields: subject and body are required');
    }

    // Clean and trim
    return {
      title: String(normalized.title).trim(),
      subject: String(normalized.subject).trim(),
      body: String(normalized.body).trim(),
    };
  }

  // If it's a string, try to parse as JSON
  if (typeof aiResponse === 'string') {
    try {
      const parsed = JSON.parse(aiResponse);
      return normalizeTemplateResponse(parsed);
    } catch (e) {
      // If it's not JSON, try to extract JSON from markdown
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return normalizeTemplateResponse(parsed);
        } catch (e2) {
          throw new Error('Failed to parse AI response as JSON');
        }
      }
      throw new Error('AI response is not valid JSON');
    }
  }

  throw new Error('Invalid AI response format');
}

/**
 * Extract field from object using multiple possible key names
 * @param {object} obj - Object to search
 * @param {string[]} keys - Array of possible key names (in order of preference)
 * @returns {string|undefined} - First matching value or undefined
 */
function extractField(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return undefined;
}

/**
 * Validate template structure
 * @param {{ title?: string, subject: string, body: string }} template - Template object
 * @returns {boolean} - True if valid
 */
export function validateTemplateStructure(template) {
  if (!template || typeof template !== 'object') {
    return false;
  }

  // Subject and body are required
  if (!template.subject || typeof template.subject !== 'string' || !template.subject.trim()) {
    return false;
  }

  if (!template.body || typeof template.body !== 'string' || !template.body.trim()) {
    return false;
  }

  // Title is optional, but if present should be a string
  if (template.title !== undefined && (typeof template.title !== 'string')) {
    return false;
  }

  return true;
}

