/**
 * PersonaParsingService
 * 
 * Parses OpenAI response into structured persona data
 * Matches the validation pattern used in TemplateAIGeneratorService
 */

export interface MinimalPersonaJSON {
  personName: string;
  title: string;
  company: string;
  coreGoal: string;
}

export class PersonaParsingService {
  /**
   * Parse OpenAI response into MinimalPersonaJSON
   * Strict parsing - no fallbacks. Malformed output is treated as a prompt bug.
   * With response_format: { type: 'json_object' }, malformed output should not occur.
   */
  static parse(content: string): MinimalPersonaJSON {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // No fallback parsing - malformed output is a prompt bug, not recoverable
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. This indicates a prompt issue, not a parsing issue.`);
    }

    // Extract persona data (could be nested or flat, but should be flat with response_format: json_object)
    const personaData = parsed.persona || parsed;

    // Validate required fields (matching template service validation pattern)
    if (!personaData.personName || typeof personaData.personName !== 'string') {
      throw new Error('AI response missing personName field or invalid type');
    }
    if (!personaData.title || typeof personaData.title !== 'string') {
      throw new Error('AI response missing title field or invalid type');
    }
    if (!personaData.company || typeof personaData.company !== 'string') {
      throw new Error('AI response missing company field or invalid type');
    }
    if (!personaData.coreGoal || typeof personaData.coreGoal !== 'string') {
      throw new Error('AI response missing coreGoal field or invalid type');
    }

    // Return validated response (trimmed like template service)
    return {
      personName: personaData.personName.trim(),
      title: personaData.title.trim(),
      company: personaData.company.trim(),
      coreGoal: personaData.coreGoal.trim(),
    };
  }
}

