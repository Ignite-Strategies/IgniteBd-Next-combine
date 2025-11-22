'use server';

import { OpenAI } from 'openai';
import { getParserConfig, type UniversalParserType } from '@/lib/parsers/typePrompts';
import { getRedis } from '@/lib/redis';
import { randomUUID } from 'crypto';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

/**
 * Normalize parsed data according to Data Normalization Policy
 * Server responsibilities: trim strings, convert numbers, handle undefined/null, ensure arrays
 */
function normalizeParsedData(data: any): any {
  if (data === null || data === undefined) {
    return {};
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    // Primitive values: return as-is (will be handled by Zod coercion)
    return data;
  }

  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      // Convert undefined → null
      normalized[key] = null;
    } else if (value === null) {
      normalized[key] = null;
    } else if (typeof value === 'string') {
      // Trim strings
      const trimmed = value.trim();
      // Don't auto-convert numeric strings here - let Zod handle coercion
      normalized[key] = trimmed;
    } else if (typeof value === 'number') {
      // Numbers stay as numbers
      normalized[key] = value;
    } else if (Array.isArray(value)) {
      // Ensure arrays are always arrays
      normalized[key] = value;
    } else if (typeof value === 'object') {
      // Recursively normalize nested objects
      normalized[key] = normalizeParsedData(value);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

export interface UniversalParseResult {
  success: boolean;
  parsed?: any;
  explanation?: string;
  error?: string;
  inputId?: string; // Redis key for retrieving stored result
}

/**
 * Universal Parser Server Action
 * Extracts structured data from raw text using GPT and validates with Zod schemas
 */
export async function universalParse({
  raw,
  context,
  type,
  companyHqId,
}: {
  raw: string;
  context?: string;
  type: UniversalParserType;
  companyHqId: string;
}): Promise<UniversalParseResult> {
  try {
    if (!raw || !raw.trim()) {
      return {
        success: false,
        error: 'Raw text is required',
      };
    }

    // Get parser config for this type
    const config = getParserConfig(type);
    const { schema, systemPrompt } = config;

    // Build user prompt
    let userPrompt = `Extract product definition information from this raw text:\n\n${raw}`;

    if (context && context.trim()) {
      userPrompt += `\n\nEditor's Notes / Context:\n${context}\n\nUse this context to guide interpretation, but only extract facts that are present in the raw text.`;
    }

    userPrompt += `\n\nReturn ONLY valid JSON matching the schema. Do not include markdown code blocks, just the raw JSON object.`;

    // Get OpenAI client
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    console.log(`🤖 Calling OpenAI (${model}) for universal parser (type: ${type})...`);

    // Call OpenAI with config from parser type
    const temperature = config.temperature ?? 0.3;
    const outputFormat = config.outputFormat ?? 'json_object';

    const completion = await openai.chat.completions.create({
      model,
      temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: outputFormat as 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received');
    }

    // Parse JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Normalize data before validation
    const normalizedData = normalizeParsedData(parsedData);

    // Validate with Zod schema (with coercion)
    const validationResult = schema.safeParse(normalizedData);

    if (!validationResult.success) {
      console.error('❌ Zod validation failed:', validationResult.error);
      // Format Zod errors for user-friendly display
      const errorMessages = validationResult.error.errors.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      return {
        success: false,
        error: `Validation failed: ${errorMessages.join('; ')}`,
        parsed: normalizedData, // Return normalized data anyway for preview
      };
    }

    // Generate explanation
    const explanation = `Successfully extracted ${Object.keys(validationResult.data).length} fields from the raw text.`;

    // Store parsed result in Redis with inputId
    const inputId = `parser:${type}:${randomUUID()}`;
    try {
      const redisClient = getRedis();
      const dataToStore = JSON.stringify({
        type,
        parsed: validationResult.data,
        explanation,
        rawText: raw,
        context: context || null,
        companyHqId,
        parsedAt: new Date().toISOString(),
      });
      
      // Store with 24 hour TTL
      await redisClient.setex(inputId, 24 * 60 * 60, dataToStore);
      console.log(`✅ Parsed result stored in Redis: ${inputId}`);
    } catch (redisError) {
      console.warn('⚠️ Failed to store in Redis (non-critical):', redisError);
      // Continue even if Redis fails
    }

    console.log(`✅ Universal parser completed successfully (type: ${type})`);

    return {
      success: true,
      parsed: validationResult.data,
      explanation,
      inputId,
    };
  } catch (error) {
    console.error('❌ Universal parser error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse data',
    };
  }
}

/**
 * Get stored parser result from Redis by inputId
 */
export async function getParserResult(inputId: string): Promise<UniversalParseResult | null> {
  try {
    const redisClient = getRedis();
    const data = await redisClient.get(inputId);
    
    if (!data) {
      return null;
    }
    
    const stored = typeof data === 'string' ? JSON.parse(data) : data;
    
    return {
      success: true,
      parsed: stored.parsed,
      explanation: stored.explanation,
      inputId,
    };
  } catch (error) {
    console.error('❌ Failed to get parser result from Redis:', error);
    return null;
  }
}

