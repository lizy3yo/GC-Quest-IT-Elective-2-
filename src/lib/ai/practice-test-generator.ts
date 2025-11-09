import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/winston';

export interface PracticeTestOptions {
  content: string;
  title?: string;
  maxQuestions?: number;
  includeMultipleChoice?: boolean;
  includeWritten?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // in minutes
}

export interface MultipleChoiceQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  points: number;
}

export interface WrittenQuestion {
  question: string;
  expectedAnswer: string;
  rubric: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  points: number;
}

export interface PracticeTestResult {
  title: string;
  description: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  totalPoints: number;
  multipleChoiceQuestions: MultipleChoiceQuestion[];
  writtenQuestions: WrittenQuestion[];
  topics: string[];
  learningObjectives: string[];
  instructions: string;
}

export class PracticeTestGenerator {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY_PRACTICE_TEST || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('Google AI API key not configured. Set GOOGLE_AI_API_KEY_PRACTICE_TEST or GOOGLE_AI_API_KEY');
    }
    
    logger.info('PracticeTestGenerator initialized', {
      hasPracticeTestKey: !!process.env.GOOGLE_AI_API_KEY_PRACTICE_TEST,
      hasBackupKey: !!process.env.GOOGLE_AI_API_KEY,
      keyPreview: apiKey.substring(0, 10) + '...',
      keyLength: apiKey.length
    });
    
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generatePracticeTest(options: PracticeTestOptions): Promise<PracticeTestResult> {
    const {
      content,
      title,
      maxQuestions = 20,
      includeMultipleChoice = true,
      includeWritten = true,
      difficulty = 'medium',
      timeLimit = 30
    } = options;

    if (!content || content.trim().length < 100) {
      throw new Error('Content must be at least 100 characters long');
    }

    if (content.length > 100000) {
      throw new Error('Content too long. Please limit to 100,000 characters');
    }

    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        topK: 2000,
        maxOutputTokens: 8000,
      }
    });

    const prompt = this.createPrompt(
      content,
      title,
      maxQuestions,
      includeMultipleChoice,
      includeWritten,
      difficulty,
      timeLimit
    );

    try {
      logger.info('Generating practice test with AI', {
        contentLength: content.length,
        maxQuestions,
        difficulty,
        includeMultipleChoice,
        includeWritten
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      logger.info('AI response received for practice test', {
        responseLength: generatedText.length
      });

      const parsedResult = this.parseAIResponse(generatedText);
      this.validateResult(parsedResult);

      logger.info('Practice test generation completed successfully', {
        multipleChoiceCount: parsedResult.multipleChoiceQuestions.length,
        writtenCount: parsedResult.writtenQuestions.length,
        totalPoints: parsedResult.totalPoints
      });

      return parsedResult;

    } catch (error) {
      logger.error('Practice test generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentLength: content.length
      });

      throw new Error(`Failed to generate practice test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createPrompt(
    content: string,
    title?: string,
    maxQuestions?: number,
    includeMultipleChoice?: boolean,
    includeWritten?: boolean,
    difficulty?: string,
    timeLimit?: number
  ): string {
    const mcCount = Math.ceil((maxQuestions || 20) * 0.7); // 70% multiple choice
    const writtenCount = Math.floor((maxQuestions || 20) * 0.3); // 30% written

    return `You are an expert educational assessment designer. Analyze the provided study material and create a comprehensive, high-quality practice test that effectively evaluates understanding.

INPUT MATERIAL:
${content}

TEST SPECIFICATIONS:
- Title: ${title || 'Practice Test'}
- Difficulty Level: ${difficulty || 'medium'}
- Time Limit: ${timeLimit || 30} minutes
- Include Multiple Choice: ${includeMultipleChoice ? 'Yes' : 'No'} (${mcCount} questions)
- Include Written Response: ${includeWritten ? 'Yes' : 'No'} (${writtenCount} questions)
- Total Questions: ${maxQuestions || 20}

ASSESSMENT DESIGN PRINCIPLES:

1. QUESTION QUALITY:
   - Test understanding and application, not just memorization
   - Use Bloom's Taxonomy levels: Remember, Understand, Apply, Analyze
   - Ensure questions are clear, unambiguous, and academically rigorous
   - Avoid trick questions or trivial details

2. MULTIPLE CHOICE QUESTIONS:
   - 4 options per question (A, B, C, D)
   - All distractors must be plausible but clearly incorrect
   - Avoid "all of the above" or "none of the above" unless pedagogically valuable
   - Mix difficulty levels appropriately

3. WRITTEN QUESTIONS:
   - Require synthesis, analysis, or application of concepts
   - Provide clear rubric points for grading
   - Expected answers should be 2-5 sentences
   - Include partial credit opportunities

4. POINT DISTRIBUTION:
   - Multiple Choice: 2-3 points each (based on difficulty)
   - Written Response: 5-10 points each (based on complexity)
   - Total points should be between 50-100

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "${title || 'Practice Test'}",
  "description": "Brief overview of what this test covers",
  "subject": "Auto-detected subject area",
  "difficulty": "${difficulty || 'medium'}",
  "timeLimit": ${timeLimit || 30},
  "totalPoints": 0,
  "multipleChoiceQuestions": [
    {
      "question": "Clear, well-written question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why the correct answer is right and others are wrong",
      "difficulty": "easy|medium|hard",
      "topic": "Specific topic tested",
      "points": 2
    }
  ],
  "writtenQuestions": [
    {
      "question": "Open-ended question requiring analysis or synthesis",
      "expectedAnswer": "Example of a complete, high-quality answer",
      "rubric": [
        "Point 1: What to look for in answer",
        "Point 2: Additional requirement",
        "Point 3: Depth of analysis expected"
      ],
      "difficulty": "easy|medium|hard",
      "topic": "Specific topic tested",
      "points": 5
    }
  ],
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "learningObjectives": [
    "Students will understand X",
    "Students will be able to apply Y",
    "Students will analyze Z"
  ],
  "instructions": "Clear instructions for taking the test"
}

CRITICAL REQUIREMENTS:
1. Generate exactly ${mcCount} multiple choice questions (if enabled)
2. Generate exactly ${writtenCount} written questions (if enabled)
3. Distribute difficulty: 40% easy, 40% medium, 20% hard
4. Cover all major topics from the material
5. Return ONLY valid JSON - no markdown, no code blocks, no extra text
6. Start directly with { and end with }
7. Calculate totalPoints as sum of all question points

Generate the practice test now:`;
  }

  private parseAIResponse(response: string): PracticeTestResult {
    try {
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find JSON object boundaries
      const startIndex = cleanResponse.indexOf('{');
      const lastIndex = cleanResponse.lastIndexOf('}');
      
      if (startIndex === -1 || lastIndex === -1) {
        throw new Error('No valid JSON object found in response');
      }
      
      const jsonString = cleanResponse.substring(startIndex, lastIndex + 1);
      const parsed = JSON.parse(jsonString);
      
      // Validate required structure
      if (!parsed.title || !parsed.multipleChoiceQuestions || !parsed.writtenQuestions) {
        throw new Error('Invalid response structure - missing required fields');
      }

      // Calculate total points if not provided
      if (!parsed.totalPoints) {
        const mcPoints = parsed.multipleChoiceQuestions.reduce((sum: number, q: any) => sum + (q.points || 2), 0);
        const writtenPoints = parsed.writtenQuestions.reduce((sum: number, q: any) => sum + (q.points || 5), 0);
        parsed.totalPoints = mcPoints + writtenPoints;
      }
      
      return parsed as PracticeTestResult;
      
    } catch (error) {
      logger.error('Failed to parse AI response:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: response.substring(0, 500)
      });
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  private validateResult(result: PracticeTestResult): void {
    if (!result.multipleChoiceQuestions && !result.writtenQuestions) {
      throw new Error('No questions generated');
    }

    const totalQuestions = 
      (result.multipleChoiceQuestions?.length || 0) + 
      (result.writtenQuestions?.length || 0);

    if (totalQuestions === 0) {
      throw new Error('No questions generated');
    }

    // Validate multiple choice questions
    if (result.multipleChoiceQuestions) {
      for (const q of result.multipleChoiceQuestions) {
        if (!q.question || !q.options || q.options.length !== 4) {
          throw new Error('Invalid multiple choice question: must have question and 4 options');
        }
        if (q.correctAnswer < 0 || q.correctAnswer > 3) {
          throw new Error('Invalid correct answer index: must be 0-3');
        }
      }
    }

    // Validate written questions
    if (result.writtenQuestions) {
      for (const q of result.writtenQuestions) {
        if (!q.question || !q.expectedAnswer) {
          throw new Error('Invalid written question: must have question and expected answer');
        }
      }
    }

    logger.info('Practice test validation passed', {
      multipleChoiceCount: result.multipleChoiceQuestions?.length || 0,
      writtenCount: result.writtenQuestions?.length || 0,
      totalPoints: result.totalPoints
    });
  }
}
