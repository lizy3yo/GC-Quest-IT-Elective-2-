import Bytez from 'bytez.js';
import { logger } from '@/lib/winston';

// Use dedicated assessment API key or fall back to general keys
const apiKey = process.env.GOOGLE_AI_API_KEY_ASSESSMENT 
  || process.env.GOOGLE_AI_API_KEY_FLASHCARD 
  || process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  logger.warn('No Google AI API key found for assessment generation. Set GOOGLE_AI_API_KEY_ASSESSMENT, GOOGLE_AI_API_KEY_FLASHCARD, or GOOGLE_AI_API_KEY');
}

// Initialize Bytez client (uses OpenAI GPT-4.1)
const genAI = apiKey ? new Bytez(apiKey) : null;

// Fallback models in order of preference
const FALLBACK_MODELS = [
  'openai/gpt-4.1',
  'openai-community/gpt2',
  'google/gemma-3-1b-it'
];

export interface GenerateAssessmentOptions {
  content: string;
  category: 'Quiz' | 'Exam';
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit?: number;
  includeExplanations?: boolean;
  subject?: string;
  gradeLevel?: string;
  questionTypes?: {
    identification?: boolean;
    multipleChoice?: boolean;
    trueOrFalse?: boolean;
    paragraph?: boolean;
  };
}

export interface GeneratedQuestion {
  id: string;
  type: 'mcq' | 'short' | 'paragraph' | 'identification';
  title: string;
  required: boolean;
  options?: string[];
  correctAnswer?: string | string[];
  answer?: string;
  explanation?: string;
  points: number;
}

export interface GeneratedAssessment {
  title: string;
  description: string;
  type: 'MCQ' | 'Mixed';
  category: 'Quiz' | 'Exam';
  questions: GeneratedQuestion[];
  totalPoints: number;
  timeLimitMins: number;
}

/**
 * Generate assessment questions from content using Gemini AI
 */
export async function generateAssessment(options: GenerateAssessmentOptions): Promise<GeneratedAssessment> {
  try {
    // Check if API key is available
    if (!apiKey || !genAI) {
      throw new Error('Google AI API key not configured. Please contact administrator.');
    }

    const {
      content,
      category,
      questionCount,
      difficulty,
      timeLimit,
      includeExplanations = true,
      subject = 'General',
      gradeLevel = 'High School',
      questionTypes
    } = options;

    logger.info('Generating assessment with Bytez/OpenAI GPT-4.1', {
      category,
      questionCount,
      difficulty,
      contentLength: content.length
    });

    // Validate content length
    if (content.length < 100) {
      throw new Error('Content too short. Please provide at least 100 characters of content.');
    }

    if (content.length > 100000) {
      throw new Error('Content too long. Please limit to 100,000 characters.');
    }

    // Build the prompt based on category
    const promptTemplate = category === 'Quiz' 
      ? buildQuizPrompt(content, questionCount, difficulty, includeExplanations, subject, gradeLevel, questionTypes)
      : buildExamPrompt(content, questionCount, difficulty, includeExplanations, subject, gradeLevel, questionTypes);

    logger.info('Sending request to Bytez/OpenAI GPT-4.1', {
      promptLength: promptTemplate.length,
      model: 'openai/gpt-4.1'
    });

    // Use Bytez SDK to call model openai/gpt-4.1
    const model = genAI.model('openai/gpt-4.1');
    const res: any = await model.run([
      {
        role: 'user',
        content: promptTemplate
      }
    ]);

    if (res?.error) {
      throw new Error(`Model error: ${JSON.stringify(res.error)}`);
    }

    // Normalize output - Bytez returns { output: { role: 'assistant', content: 'text' } }
    let generatedText = '';
    const output = res?.output;
    
    if (!output) {
      generatedText = '';
    } else if (typeof output === 'string') {
      generatedText = output;
    } else if (typeof output === 'object' && !Array.isArray(output)) {
      // Primary case for Bytez: { role: 'assistant', content: 'JSON string' }
      if (typeof output.content === 'string') {
        generatedText = output.content;
      } else if (typeof output.text === 'string') {
        generatedText = output.text;
      } else if (output.message && typeof output.message.content === 'string') {
        generatedText = output.message.content;
      }
    } else if (Array.isArray(output)) {
      for (const item of output) {
        if (!item) continue;
        if (typeof item === 'string') generatedText += item;
        else if (typeof item === 'object') {
          if (typeof item.content === 'string') generatedText += item.content;
          else if (typeof item.text === 'string') generatedText += item.text;
          else if (Array.isArray(item.content)) {
            for (const c of item.content) {
              if (typeof c === 'string') generatedText += c;
              else if (typeof c.text === 'string') generatedText += c.text;
            }
          } else if (item.message && typeof item.message.content === 'string') {
            generatedText += item.message.content;
          }
        }
      }
    }

    logger.info('Received AI response', { 
      responseLength: generatedText.length 
    });

    // Parse the JSON response
    let parsedData: any;
    try {
      // Remove markdown code blocks if present
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON', { 
        error: parseError,
        responseText: generatedText.substring(0, 500)
      });
      throw new Error('AI generated invalid response format. Please try again.');
    }

    // Validate and structure the response
    if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
      throw new Error('AI response missing questions array');
    }

    // Process questions and assign IDs
    const questions: GeneratedQuestion[] = parsedData.questions.map((q: any, index: number) => ({
      id: `q_${Date.now()}_${index}`,
      type: q.type || 'mcq',
      title: q.title || q.question || '',
      required: true,
      options: q.options || undefined,
      correctAnswer: q.correctAnswer || q.answer || undefined,
      answer: typeof q.correctAnswer === 'string' ? q.correctAnswer : undefined,
      explanation: includeExplanations ? (q.explanation || '') : undefined,
      points: q.points || (category === 'Exam' ? 5 : 2)
    }));

    // Calculate total points
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

    // Calculate time limit if not provided
    const calculatedTimeLimit = timeLimit || calculateTimeLimit(questionCount, category, difficulty);

    const assessment: GeneratedAssessment = {
      title: parsedData.title || `AI Generated ${category}`,
      description: parsedData.description || `${category} generated from your content`,
      type: parsedData.type || 'Mixed',
      category,
      questions,
      totalPoints,
      timeLimitMins: calculatedTimeLimit
    };

    logger.info('Assessment generated successfully', {
      questionsGenerated: questions.length,
      totalPoints,
      timeLimitMins: calculatedTimeLimit
    });

    return assessment;

  } catch (error) {
    logger.error('Error generating assessment', { error });
    throw error;
  }
}

/**
 * Build prompt for quiz generation
 */
function buildQuizPrompt(
  content: string,
  questionCount: number,
  difficulty: string,
  includeExplanations: boolean,
  subject: string,
  gradeLevel: string,
  questionTypes?: {
    identification?: boolean;
    multipleChoice?: boolean;
    trueOrFalse?: boolean;
    paragraph?: boolean;
  }
): string {
  // Build allowed question types list and examples
  const allowedTypes: string[] = [];
  const exampleQuestions: string[] = [];
  
  if (questionTypes?.multipleChoice) {
    allowedTypes.push('multiple choice (mcq)');
    exampleQuestions.push(`    {
      "type": "mcq",
      "title": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      ${includeExplanations ? '"explanation": "Why this is correct",' : ''}
      "points": 2
    }`);
  }
  
  if (questionTypes?.identification) {
    allowedTypes.push('identification');
    exampleQuestions.push(`    {
      "type": "identification",
      "title": "Identify: description here",
      "answer": "Correct term or concept",
      ${includeExplanations ? '"explanation": "Additional context",' : ''}
      "points": 2
    }`);
  }
  
  if (questionTypes?.trueOrFalse) {
    allowedTypes.push('true/false');
    exampleQuestions.push(`    {
      "type": "true-false",
      "title": "True or False: Statement here",
      "options": ["True", "False"],
      "correctAnswer": "True",
      ${includeExplanations ? '"explanation": "Why this is correct",' : ''}
      "points": 1
    }`);
  }
  
  if (questionTypes?.paragraph) {
    allowedTypes.push('paragraph/essay');
    exampleQuestions.push(`    {
      "type": "paragraph",
      "title": "Essay question requiring detailed response?",
      "answer": "Comprehensive expected answer with main points",
      ${includeExplanations ? '"explanation": "Grading criteria and key elements",' : ''}
      "points": 5
    }`);
  }
  
  // If no types selected, allow all and show all examples
  const questionTypesText = allowedTypes.length > 0 
    ? `ONLY use these question types: ${allowedTypes.join(', ')}. Do NOT use any other question types.`
    : 'Mix of question types: multiple choice (mcq), identification, true/false, and paragraph';
  
  const examplesText = exampleQuestions.length > 0 
    ? exampleQuestions.join(',\n')
    : `    {
      "type": "mcq",
      "title": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      ${includeExplanations ? '"explanation": "Why this is correct",' : ''}
      "points": 2
    }`;

  return `You are an expert educational content creator. Generate a quiz based on the following content.

**Content:**
${content.substring(0, 50000)}

**Requirements:**
- Generate exactly ${questionCount} questions
- Difficulty level: ${difficulty}
- Subject: ${subject}
- Grade level: ${gradeLevel}
- ${questionTypesText}
- Each MCQ should have 4 options with one correct answer
- ${includeExplanations ? 'Include a brief explanation for each correct answer' : 'Do not include explanations'}
- Questions should test understanding, not just memorization
- Assign appropriate point values (typically 2-3 points per question for quizzes)

**Output Format (JSON):**
{
  "title": "Quiz title based on content",
  "description": "Brief description of what the quiz covers",
  "type": "Mixed",
  "questions": [
${examplesText}
  ]
}

**Important:** 
- Return ONLY valid JSON, no additional text
- Ensure all questions are clear and unambiguous
- Make sure the difficulty matches the specified level
- Base all questions on the provided content`;
}

/**
 * Build prompt for exam generation
 */
function buildExamPrompt(
  content: string,
  questionCount: number,
  difficulty: string,
  includeExplanations: boolean,
  subject: string,
  gradeLevel: string,
  questionTypes?: {
    identification?: boolean;
    multipleChoice?: boolean;
    trueOrFalse?: boolean;
    paragraph?: boolean;
  }
): string {
  // Build allowed question types list and examples
  const allowedTypes: string[] = [];
  const exampleQuestions: string[] = [];
  
  if (questionTypes?.multipleChoice) {
    allowedTypes.push('multiple choice (mcq)');
    exampleQuestions.push(`    {
      "type": "mcq",
      "title": "Multiple choice question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option C",
      ${includeExplanations ? '"explanation": "Detailed explanation",' : ''}
      "points": 5
    }`);
  }
  
  if (questionTypes?.identification) {
    allowedTypes.push('identification');
    exampleQuestions.push(`    {
      "type": "identification",
      "title": "Identify and explain: concept or term",
      "answer": "Correct answer with explanation",
      ${includeExplanations ? '"explanation": "Additional context",' : ''}
      "points": 5
    }`);
  }
  
  if (questionTypes?.trueOrFalse) {
    allowedTypes.push('true/false');
    exampleQuestions.push(`    {
      "type": "true-false",
      "title": "True or False: Complex statement requiring analysis",
      "options": ["True", "False"],
      "correctAnswer": "True",
      ${includeExplanations ? '"explanation": "Detailed reasoning",' : ''}
      "points": 3
    }`);
  }
  
  if (questionTypes?.paragraph) {
    allowedTypes.push('paragraph/essay');
    exampleQuestions.push(`    {
      "type": "paragraph",
      "title": "Essay question requiring comprehensive analysis and evaluation?",
      "answer": "Detailed expected answer covering key points, analysis, and synthesis",
      ${includeExplanations ? '"explanation": "Grading rubric and key evaluation criteria",' : ''}
      "points": 10
    }`);
  }
  
  // If no types selected, allow all
  const questionTypesText = allowedTypes.length > 0 
    ? `ONLY use these question types: ${allowedTypes.join(', ')}. Do NOT use any other question types.`
    : 'Mix of question types: multiple choice (mcq), identification, true/false, and paragraph';
  
  const examplesText = exampleQuestions.length > 0 
    ? exampleQuestions.join(',\n')
    : `    {
      "type": "mcq",
      "title": "Multiple choice question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option C",
      ${includeExplanations ? '"explanation": "Detailed explanation",' : ''}
      "points": 5
    }`;

  return `You are an expert educational assessment designer. Generate a comprehensive exam based on the following content.

**Content:**
${content.substring(0, 50000)}

**Requirements:**
- Generate exactly ${questionCount} questions
- Difficulty level: ${difficulty}
- Subject: ${subject}
- Grade level: ${gradeLevel}
- Comprehensive coverage of the content
- ${questionTypesText}
- Each MCQ should have 4 options with one correct answer
- Include some higher-order thinking questions (analysis, evaluation, application)
- ${includeExplanations ? 'Include detailed explanations for correct answers' : 'Do not include explanations'}
- Assign appropriate point values (typically 5-10 points per question for exams)
- Questions should progressively increase in difficulty

**Output Format (JSON):**
{
  "title": "Exam title based on content",
  "description": "Comprehensive description of exam coverage and objectives",
  "type": "Mixed",
  "questions": [
${examplesText}
  ]
}

**Important:** 
- Return ONLY valid JSON, no additional text
- Ensure questions are appropriately challenging for an exam
- Cover different aspects and sections of the content
- Include a mix of recall, comprehension, and application questions
- Make sure the difficulty matches the specified level`;
}

/**
 * Calculate appropriate time limit based on question count and category
 */
function calculateTimeLimit(questionCount: number, category: 'Quiz' | 'Exam', difficulty: string): number {
  const baseTimePerQuestion = category === 'Quiz' ? 1.5 : 3; // minutes
  const difficultyMultiplier = difficulty === 'hard' ? 1.3 : difficulty === 'easy' ? 0.8 : 1;
  
  const calculatedTime = Math.ceil(questionCount * baseTimePerQuestion * difficultyMultiplier);
  
  // Round to nearest 5 minutes
  return Math.max(5, Math.round(calculatedTime / 5) * 5);
}

/**
 * Validate generated assessment
 */
export function validateGeneratedAssessment(assessment: GeneratedAssessment): boolean {
  if (!assessment.title || !assessment.questions || assessment.questions.length === 0) {
    return false;
  }

  for (const question of assessment.questions) {
    if (!question.title || !question.type) {
      return false;
    }

    if (question.type === 'mcq') {
      if (!question.options || question.options.length < 2 || !question.correctAnswer) {
        return false;
      }
    }
  }

  return true;
}
