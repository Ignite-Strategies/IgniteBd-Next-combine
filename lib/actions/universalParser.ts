'use server';

import { OpenAI } from 'openai';
import { getParserConfig, type UniversalParserType } from '@/lib/parsers/parserConfigs';
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

export interface UniversalParseResult {
  success: boolean;
  parsed?: any;
  explanation?: string;
  error?: string;
  inputId?: string; // Redis key for retrieving stored result
}

/**
 * Universal Parser Server Action
 * Thin router that loads config and orchestrates parsing
 * Zero hardcoded prompts or schemas - everything comes from configs
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

    // Load parser config for this type
    const config = getParserConfig(type);
    if (!config) {
      throw new Error(`Parser type "${type}" is not supported`);
    }

    // Build prompts from config
    const systemPrompt = config.systemPrompt;
    const userPrompt = config.buildUserPrompt(raw, context ?? null);

    // Get OpenAI client
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    console.log(`🤖 Calling OpenAI (${model}) for universal parser (type: ${type})...`);

    // Call OpenAI with production-grade settings
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0, // Deterministic, no hallucinations
      response_format: { type: 'json_object' }, // JSON-only output
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
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received');
    }

    // Extract JSON cleanly - OpenAI with json_object format should return pure JSON
    let parsedData;
    try {
      parsedData = JSON.parse(content);
    } catch (parseError) {
      // Fallback: Try to extract JSON from markdown code blocks (shouldn't happen with json_object format)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
        console.warn('⚠️ Extracted JSON from markdown (unexpected with json_object format)');
      } else {
        throw new Error(`Invalid JSON response from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    // Normalize using config-specific normalization rules
    const normalizedData = config.normalize(parsedData);

    // Validate with Zod schema from config
    const validationResult = config.schema.safeParse(normalizedData);

    if (!validationResult.success) {
      console.error('❌ Zod validation failed:', validationResult.error);
      // Format Zod errors for user-friendly display
      const errorMessages = validationResult.error.issues.map(
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
