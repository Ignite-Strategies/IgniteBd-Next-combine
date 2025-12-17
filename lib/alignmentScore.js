import OpenAI from 'openai';

let cachedClient = null;

function getClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export async function getAlignmentScore(valueA, valueB) {
  if (!valueA || !valueB) {
    return null;
  }

  const client = getClient();

  if (!client) {
    console.warn(
      'Alignment score skipped: OPENAI_API_KEY is not configured.',
    );
    return null;
  }

  try {
    const prompt = `
    Compare the similarity between these two value propositions on a scale of 0–100.
    A: ${valueA}
    B: ${valueB}
    Respond ONLY with a number.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? '';
    const score = parseInt(text, 10);
    return Number.isNaN(score) ? null : score;
  } catch (error) {
    console.error('Alignment error:', error);
    return null;
  }
}

