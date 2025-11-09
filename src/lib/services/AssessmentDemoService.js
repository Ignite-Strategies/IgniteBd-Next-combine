import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Simple Assessment Demo Service
 * Direct OpenAI call without complex model saves - just like TripWell demo
 */
const assessmentDemoService = async (assessmentData) => {
  try {
    console.log('🎯 Generating assessment demo for:', assessmentData.name);
    
    const prompt = `You are a business growth consultant. Analyze this assessment and provide insights.

ASSESSMENT DATA:
- Name: ${assessmentData.name}
- Company: ${assessmentData.company}
- Industry: ${assessmentData.industry}
- Works too much: ${assessmentData.workTooMuch}
- Assigns tasks: ${assessmentData.assignTasks}
- Wants more clients: ${assessmentData.wantMoreClients}
- Revenue growth target: ${assessmentData.revenueGrowthPercent}%
- Total volume: $${assessmentData.totalVolume || 'Not specified'}
- BD spend: $${assessmentData.bdSpend || 'Not specified'}

Provide exactly 2 paragraphs:

PARAGRAPH 1: Relate with them by acknowledging their situation and goals. Start with "It sounds like you are feeling [their workload situation] and want [their growth goals]. You want [repeat their exact goals]."

PARAGRAPH 2: Give them what they need. Start with "To get there, you need [specific BD/growth activities] and a systematic approach to [their specific challenges based on industry]."

Keep it conversational, specific to their industry, and focused on their exact situation. No bullet points, just 2 clean paragraphs.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a business growth consultant. Provide personalized insights based on assessment data. Keep responses conversational and specific to the user's industry and goals."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const gptResponse = completion.choices[0].message.content;
    
    // Split into 2 paragraphs
    const paragraphs = gptResponse.split('\n\n');
    
    return {
      success: true,
      assessmentDemo: {
        name: assessmentData.name,
        company: assessmentData.company,
        industry: assessmentData.industry,
        relateWithUser: paragraphs[0] || gptResponse,
        growthNeeds: paragraphs[1] || gptResponse,
        rawResponse: gptResponse
      }
    };

  } catch (error) {
    console.error("❌ Error in assessmentDemoService:", error);
    
    // Fallback response if OpenAI fails
    return {
      success: true,
      assessmentDemo: {
        name: assessmentData.name,
        company: assessmentData.company,
        industry: assessmentData.industry,
        relateWithUser: `It sounds like you are feeling overwhelmed with tasks and want to grow your business. You want more clients and better delegation to scale effectively.`,
        growthNeeds: `To get there, you need more business development activities and a systematic approach to delegation and growth planning in the ${assessmentData.industry} industry.`,
        rawResponse: "Fallback response due to OpenAI error"
      }
    };
  }
};

export default assessmentDemoService;
