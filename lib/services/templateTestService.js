/**
 * Template Test Service
 * 
 * Service for testing template hydration with realistic sample data
 * Provides preview capabilities to help users see how templates will look
 */

import { hydrateTemplate, extractVariables } from '@/lib/templateVariables';
import { generateTestData, generateMultipleTestDataSets } from '@/lib/templateTestText';

class TemplateTestService {
  /**
   * Generate a hydrated preview of a template with realistic test data
   * @param {string} templateContent - Template content with {{variableName}} tags
   * @param {Object} options - Options for test data generation
   * @param {Object} options.formData - Form data from template builder (for context-aware generation)
   * @returns {Object} Preview data with hydrated content and test data used
   */
  static generatePreview(templateContent, options = {}) {
    if (!templateContent || typeof templateContent !== 'string') {
      return {
        hydratedContent: '',
        testData: null,
        variables: [],
        error: 'Template content is required',
      };
    }

    const { formData = {} } = options;
    
    // Extract variables from template
    const variables = extractVariables(templateContent);
    
    // Generate test data with context from form if available
    const testData = generateTestData({
      typeOfPerson: formData.typeOfPerson,
      timeHorizon: formData.timeHorizon,
      desiredOutcome: formData.desiredOutcome,
      myBusinessName: formData.myBusinessDescription,
      knowledgeOfBusiness: formData.knowledgeOfBusiness,
    });
    
    // Ensure testData has contactData and metadata (safety check)
    const safeContactData = testData?.contactData || {};
    const safeMetadata = testData?.metadata || {};
    
    // Hydrate the template
    const hydratedContent = hydrateTemplate(
      templateContent,
      safeContactData,
      safeMetadata
    );
    
    return {
      hydratedContent,
      testData,
      variables,
      error: null,
    };
  }

  /**
   * Generate multiple preview variations (different contacts)
   * Useful for showing how template looks with different people
   * @param {string} templateContent - Template content with {{variableName}} tags
   * @param {number} count - Number of variations to generate
   * @param {Object} options - Options for test data generation
   * @returns {Array} Array of preview objects
   */
  static generateMultiplePreviews(templateContent, count = 3, options = {}) {
    if (!templateContent || typeof templateContent !== 'string') {
      return [];
    }

    const { formData = {} } = options;
    
    // Generate multiple test data sets
    const testDataSets = generateMultipleTestDataSets(count, {
      typeOfPerson: formData.typeOfPerson,
      timeHorizon: formData.timeHorizon,
      desiredOutcome: formData.desiredOutcome,
      myBusinessName: formData.myBusinessDescription,
      knowledgeOfBusiness: formData.knowledgeOfBusiness,
    });
    
    // Extract variables once
    const variables = extractVariables(templateContent);
    
    // Generate previews for each test data set
    return testDataSets.map((testData) => {
      const safeContactData = testData?.contactData || {};
      const safeMetadata = testData?.metadata || {};
      const hydratedContent = hydrateTemplate(
        templateContent,
        safeContactData,
        safeMetadata
      );
      
      return {
        hydratedContent,
        testData,
        variables,
      };
    });
  }

  /**
   * Validate template hydration (check for missing variables)
   * @param {string} templateContent - Template content with {{variableName}} tags
   * @param {Object} testData - Test data to use for validation
   * @returns {Object} Validation result
   */
  static validateHydration(templateContent, testData = null) {
    if (!templateContent || typeof templateContent !== 'string') {
      return {
        valid: false,
        missingVariables: [],
        error: 'Template content is required',
      };
    }

    // Use provided test data or generate default
    const data = testData || generateTestData();
    const safeContactData = data?.contactData || {};
    const safeMetadata = data?.metadata || {};
    
    // Hydrate template
    const hydratedContent = hydrateTemplate(
      templateContent,
      safeContactData,
      safeMetadata
    );
    
    // Check for remaining variables (not replaced)
    const remainingVariables = extractVariables(hydratedContent);
    
    return {
      valid: remainingVariables.length === 0,
      missingVariables: remainingVariables.map(v => v.name),
      hydratedContent,
      testData: data,
    };
  }

  /**
   * Get preview with specific contact data (for testing with real contact)
   * @param {string} templateContent - Template content with {{variableName}} tags
   * @param {Object} contactData - Real contact data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Preview data
   */
  static generatePreviewWithContact(templateContent, contactData = {}, metadata = {}) {
    if (!templateContent || typeof templateContent !== 'string') {
      return {
        hydratedContent: '',
        variables: [],
        error: 'Template content is required',
      };
    }

    const variables = extractVariables(templateContent);
    const hydratedContent = hydrateTemplate(templateContent, contactData, metadata);
    
    return {
      hydratedContent,
      variables,
      contactData,
      metadata,
      error: null,
    };
  }

  /**
   * Get a quick preview (simplified version for inline use)
   * @param {string} templateContent - Template content with {{variableName}} tags
   * @param {Object} formData - Form data for context
   * @returns {string} Hydrated content string
   */
  static getQuickPreview(templateContent, formData = {}) {
    const preview = this.generatePreview(templateContent, { formData });
    return preview.hydratedContent || templateContent;
  }
}

export default TemplateTestService;

