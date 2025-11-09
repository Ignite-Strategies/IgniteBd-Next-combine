import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AssessmentCalculationService
 * Generates assessment insights and recommendations using OpenAI
 */
class AssessmentCalculationService {
  
  /**
   * Calculate base score from assessment responses
   */
  static calculateBaseScore(assessmentData) {
    let score = 0;
    
    // Workload assessment (0-40 points)
    const workloadScore = this.calculateWorkloadScore(assessmentData.workTooMuch, assessmentData.assignTasks);
    score += workloadScore;
    
    // Growth goals (0-30 points)
    const growthScore = this.calculateGrowthScore(assessmentData.wantMoreClients);
    score += growthScore;
    
    // Revenue targets (0-30 points)
    const revenueScore = this.calculateRevenueScore(assessmentData.revenueGrowthPercent, assessmentData.totalVolume);
    score += revenueScore;
    
    return Math.min(100, Math.max(0, score)); // Ensure 0-100 range
  }
  
  /**
   * Calculate workload score (0-40 points)
   */
  static calculateWorkloadScore(workTooMuch, assignTasks) {
    let score = 0;
    
    // Work too much scoring (0-20 points)
    const workTooMuchScores = {
      'always': 0,
      'often': 5,
      'sometimes': 15,
      'rarely': 20
    };
    score += workTooMuchScores[workTooMuch] || 0;
    
    // Assign tasks scoring (0-20 points)
    const assignTasksScores = {
      'never': 0,
      'rarely': 5,
      'sometimes': 15,
      'always': 20
    };
    score += assignTasksScores[assignTasks] || 0;
    
    return score;
  }
  
  /**
   * Calculate growth score (0-30 points)
   */
  static calculateGrowthScore(wantMoreClients) {
    const growthScores = {
      'yes': 30,
      'maybe': 15,
      'no': 0
    };
    return growthScores[wantMoreClients] || 0;
  }
  
  /**
   * Calculate revenue score (0-30 points)
   */
  static calculateRevenueScore(revenueGrowthPercent, totalVolume) {
    let score = 0;
    
    // Revenue growth percentage (0-15 points)
    if (revenueGrowthPercent) {
      if (revenueGrowthPercent >= 50) score += 15;
      else if (revenueGrowthPercent >= 25) score += 10;
      else if (revenueGrowthPercent >= 10) score += 5;
    }
    
    // Total volume (0-15 points)
    if (totalVolume) {
      if (totalVolume >= 1000000) score += 15;
      else if (totalVolume >= 500000) score += 10;
      else if (totalVolume >= 100000) score += 5;
    }
    
    return score;
  }
  
  /**
   * Build GPT prompt for assessment analysis
   */
  static buildAssessmentPrompt(assessmentData, baseScore) {
    return `You are a business analyzer specializing in helping founders and CEOs scale their companies. Analyze the below user input and assess their growth potential.

ASSESSMENT DATA:
name=${assessmentData.name}
company=${assessmentData.company}
industry=${assessmentData.industry}
workTooMuch=${assessmentData.workTooMuch}
assignTasks=${assessmentData.assignTasks}
wantMoreClients=${assessmentData.wantMoreClients}
revenueGrowthPercent=${assessmentData.revenueGrowthPercent}%
totalVolume=$${assessmentData.totalVolume || 'Not specified'}
bdSpend=$${assessmentData.bdSpend || 'Not specified'}

ASSESSMENT REQUIREMENTS:
1. Relate with the user by acknowledging their feelings and goals
2. Repeat back what they want (more clients, growth targets)
3. Identify what they need (more BD, systematic approach)
4. Keep this standard since this is a funnel for our business
5. Prepare them for a deeper dive once they become a client

OUTPUT FORMAT:
Write exactly 2 paragraphs separated by a blank line:

PARAGRAPH 1: Relate with the user by acknowledging their feelings and goals. Start with "It sounds like you are feeling [their specific workload situation] and want [their specific growth goals]. You want [repeat back their exact goals from the assessment]."

PARAGRAPH 2: Provide analysis and what they need. Start with "To get there, you need [more BD spend/activities] and a systematic approach to [specific areas they need help with based on their industry and responses]."

IMPORTANT: 
- Write exactly 2 paragraphs, no more, no less
- Separate paragraphs with a blank line
- Make it specific to their industry and responses
- Keep it conversational and relatable
- Focus on their specific situation and goals
- No bullet points, no formatting, just 2 clean paragraphs`;
  }
  
  /**
   * Generate assessment insights using OpenAI
   */
  static async generateAssessmentInsights(assessmentData) {
    try {
      console.log(`🤖 Starting OpenAI assessment analysis for: ${assessmentData.name} at ${assessmentData.company}`);
      
      // Calculate base score
      const baseScore = this.calculateBaseScore(assessmentData);
      
      // Build prompt
      const prompt = this.buildAssessmentPrompt(assessmentData, baseScore);
      
      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a business analyzer specializing in helping founders and CEOs scale their companies. Analyze user input and assess growth potential. Provide insights in the specified JSON format."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      const gptResponse = completion.choices[0].message.content;
      
      // Split the response into 2 paragraphs
      const paragraphs = gptResponse.split('\n\n');
      const insights = {
        relateWithUser: paragraphs[0] || gptResponse,
        growthNeeds: paragraphs[1] || gptResponse
      };
      
      console.log(`✅ OpenAI assessment analysis completed successfully`);
      
      return {
        success: true,
        score: baseScore,
        insights: insights,
        rawGptResponse: gptResponse
      };
      
    } catch (error) {
      console.error('❌ OpenAI assessment analysis failed:', error);
      
      // Fallback insights if OpenAI fails
      const fallbackInsights = {
        igniteGrowthAssessment: "Ignite Growth Assessment",
        relateWithUser: "It sounds like you are feeling overwhelmed with tasks and want to grow your business - you want more clients and better delegation.",
        growthNeeds: "To get there, you need more business development activities and a systematic approach to delegation and growth planning.",
        deeperDive: "This assessment shows the foundation for a deeper dive into your specific growth strategy once you become a client.",
        nextSteps: "Ready to take the next step in your growth journey?"
      };
      
      return {
        success: false,
        error: error.message,
        score: this.calculateBaseScore(assessmentData),
        insights: fallbackInsights
      };
    }
  }
  
  /**
   * Get score interpretation
   */
  static getScoreInterpretation(score) {
    if (score >= 80) {
      return {
        level: "High Growth Potential",
        description: "Excellent delegation skills, clear growth goals, and strong revenue targets. You're well-positioned for scaling.",
        color: "green"
      };
    } else if (score >= 60) {
      return {
        level: "Medium Growth Potential", 
        description: "Good foundation with some areas for improvement in delegation and growth strategy.",
        color: "yellow"
      };
    } else if (score >= 40) {
      return {
        level: "Low-Medium Growth Potential",
        description: "Significant opportunities to improve delegation and growth planning for better scaling.",
        color: "orange"
      };
    } else {
      return {
        level: "Low Growth Potential",
        description: "Major improvements needed in delegation and growth strategy to unlock scaling potential.",
        color: "red"
      };
    }
  }
}

export default AssessmentCalculationService;
