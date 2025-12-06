import Bytez from 'bytez.js';
import { logger } from '@/lib/winston';

export interface InternalFlashcardOptions {
  content: string;
  title?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  contentType?: 'text' | 'document' | 'notes' | 'mixed';
  maxCards?: number;
}

export interface FlashcardAnalysis {
  contentType: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  keyTopics: string[];
  optimalCardCount: number;
  strategy: 'definition' | 'process' | 'concept' | 'application';
}

export interface GeneratedFlashcard {
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  type: 'concept' | 'application' | 'comparison' | 'process';
  tags: string[];
  confidence: number;
  reasoning: string;
  example: string;
  commonMistake: string;
  reviewInterval: number;
}

export interface QualityMetrics {
  overallScore: number;
  avgConfidence: number;
  topicCoverage: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  questionTypes: {
    concept: number;
    application: number;
    comparison: number;
    process: number;
  };
}

export interface FlashcardGenerationResult {
  analysis: FlashcardAnalysis;
  flashcards: GeneratedFlashcard[];
  qualityMetrics: QualityMetrics;
  summary: {
    cardsGenerated: number;
    mainTopics: string[];
    learningObjectives: string[];
    recommendedUse: string;
  };
}

export class InternalFlashcardGenerator {
  private genAI: any;
  private fallbackModels: string[];

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY_FLASHCARD || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('Google AI API key not configured. Set GOOGLE_AI_API_KEY_FLASHCARD or GOOGLE_AI_API_KEY');
    }
    
    // Debug logging
    logger.info('InternalFlashcardGenerator initialized', {
      hasFlashcardKey: !!process.env.GOOGLE_AI_API_KEY_FLASHCARD,
      hasBackupKey: !!process.env.GOOGLE_AI_API_KEY,
      keyPreview: apiKey ? apiKey.substring(0, 10) + '...' : undefined,
      keyLength: apiKey ? apiKey.length : 0
    });

    // Initialize Bytez client with the flashcard API key (uses models like openai/gpt-4.1)
    this.genAI = new Bytez(apiKey);
    this.fallbackModels = [
      'openai/gpt-4.1',
      'openai-community/gpt2',
      'google/gemma-3-1b-it'
    ];
  }

  async generateFlashcards(options: InternalFlashcardOptions): Promise<FlashcardGenerationResult> {
    const { content, title, difficulty, contentType = 'text', maxCards = 10 } = options;

    if (!content || content.trim().length < 50) {
      throw new Error('Content must be at least 50 characters long');
    }

    if (content.length > 50000) {
      throw new Error('Content too long. Please limit to 50,000 characters');
    }

    const prompt = this.createPrompt(content, title, difficulty, contentType, maxCards);

    try {
      logger.info('Generating flashcards with OpenAI GPT-4.1', {
        contentLength: content.length,
        maxCards,
        difficulty,
        contentType
      });

      // Use Bytez SDK to call model openai/gpt-4.1
      const model = this.genAI.model('openai/gpt-4.1');
      const res: any = await model.run([
        {
          role: 'user',
          content: prompt
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

      logger.info('AI response received', {
        responseLength: generatedText.length
      });

      // Parse the JSON response
      const parsedResult = this.parseAIResponse(generatedText);
      
      // Validate the result
      this.validateResult(parsedResult);

      logger.info('Flashcard generation completed successfully', {
        cardsGenerated: parsedResult.flashcards.length,
        overallScore: parsedResult.qualityMetrics.overallScore
      });

      return parsedResult;

    } catch (error) {
      logger.error('Internal flashcard generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentLength: content.length
      });

      // Create fallback flashcards
      return this.createFallbackResult(content, title, difficulty, maxCards);
    }
  }

  private createPrompt(
    content: string, 
    title?: string, 
    difficulty?: string, 
    contentType?: string, 
    maxCards?: number
  ): string {
    return `You are an expert educational designer specializing in creating ULTRA-CONCISE, high-quality flashcards. Analyze the content, then generate a complete set of brief, pedagogically-sound flashcards with built-in quality assurance.

CRITICAL: MAXIMUM BREVITY REQUIRED - Questions: 8-15 words ONLY. Answers: 1-3 sentences ONLY (20-40 words TOTAL). NO EXCEPTIONS. Longer answers will be rejected.

EXAMPLE OF CORRECT LENGTH:
Question: "Why do plants need sunlight?" (6 words)
Answer: "Sunlight provides energy for photosynthesis. Without it, plants die." (10 words, 2 sentences)

INPUT:
- CONTENT: ${content}
- TITLE: ${title || 'Study Material'}
- DIFFICULTY: ${difficulty || 'medium'}

PROCESS (execute all steps in sequence):

STEP 1: CONTENT ANALYSIS
- Identify 2-5 major topics and key concepts
- Determine optimal flashcard count (5-15 cards based on content density)
- Auto-detect subject area and learning strategy
- Assess content difficulty and complexity

STEP 2: FLASHCARD GENERATION
- Create diverse, understanding-focused questions (not just recall)
- Include mix of: concept, application, comparison, process questions
- Ensure answers are complete with explanations, examples, and common mistakes
- Vary question formats and difficulty appropriately

STEP 3: QUALITY ASSURANCE
- Self-evaluate each card for clarity, completeness, and educational value
- Refine any cards scoring below 0.8 on quality metrics
- Ensure proper difficulty distribution and topic coverage

OUTPUT REQUIREMENTS:
- Return ONLY a JSON object with the final flashcard set
- Each card must test understanding, not memorization
- Include confidence scores and reasoning for each card
- Provide analysis summary and quality metrics

JSON SCHEMA:
{
  "analysis": {
    "contentType": "text|document|notes|mixed",
    "subject": "Auto-detected subject area",
    "difficulty": "easy|medium|hard", 
    "keyTopics": ["topic1", "topic2", "topic3"],
    "optimalCardCount": ${maxCards || 10},
    "strategy": "definition|process|concept|application"
  },
  "flashcards": [
    {
      "question": "Understanding-focused question that requires reasoning",
      "answer": "Complete explanation with reasoning, concrete example, and common mistake to avoid",
      "difficulty": "easy|medium|hard",
      "topic": "Main topic this card covers",
      "type": "concept|application|comparison|process",
      "tags": ["subject", "topic", "skill"],
      "confidence": 0.9,
      "reasoning": "Why this card is valuable for learning",
      "example": "Concrete example or scenario",
      "commonMistake": "Typical error students make and why it's wrong",
      "reviewInterval": 3
    }
  ],
  "qualityMetrics": {
    "overallScore": 0.89,
    "avgConfidence": 0.87,
    "topicCoverage": 1.0,
    "difficultyDistribution": {"easy": 3, "medium": 5, "hard": 2},
    "questionTypes": {"concept": 4, "application": 3, "comparison": 2, "process": 1}
  },
  "summary": {
    "cardsGenerated": ${maxCards || 10},
    "mainTopics": ["topic1", "topic2"],
    "learningObjectives": ["Understand X", "Apply Y", "Compare Z"],
    "recommendedUse": "Study sequence and spaced repetition suggestions"
  }
}

QUALITY RULES:
1. Questions must be ultra-concise (8-15 words) and test WHY/HOW/WHAT-IF, not just WHAT
2. Answers must be 1-3 sentences maximum (20-40 words total) with: core point + brief example
3. No verbatim copying from source content - transform and abstract
4. Ensure variety in question types and formats
5. All cards must have confidence > 0.7 (refine if lower)
6. Total cards should match analysis.optimalCardCount ±1
7. Cover all keyTopics with appropriate depth
8. ULTRA-CONCISENESS IS CRITICAL - flashcards should be instantly readable

Return ONLY the JSON object. No markdown, no code blocks, no additional text.

CRITICAL OUTPUT FORMAT:
- Return ONLY the JSON object
- NO markdown code blocks
- NO \`\`\`json or \`\`\` tags
- NO additional text or explanations
- Start directly with { and end with }`;
  }

  private parseAIResponse(response: string): FlashcardGenerationResult {
    try {
      // Clean the response - remove any markdown formatting
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
      if (!parsed.analysis || !parsed.flashcards || !parsed.qualityMetrics || !parsed.summary) {
        throw new Error('Invalid response structure - missing required fields');
      }
      
      return parsed as FlashcardGenerationResult;
      
    } catch (error) {
      logger.error('Failed to parse AI response:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: response.substring(0, 200)
      });
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  private validateResult(result: FlashcardGenerationResult): void {
    if (!result.flashcards || result.flashcards.length === 0) {
      throw new Error('No flashcards generated');
    }

    // Validate each flashcard
    for (const card of result.flashcards) {
      if (!card.question || !card.answer) {
        throw new Error('Invalid flashcard: missing question or answer');
      }
      
      if (card.question.split(' ').length > 15) {
        logger.warn('Question too long:', card.question);
      }
      
      if (card.answer.split(' ').length > 40) {
        logger.warn('Answer too long:', card.answer);
      }
    }

    logger.info('Flashcard validation passed', {
      cardCount: result.flashcards.length,
      avgConfidence: result.qualityMetrics.avgConfidence
    });
  }

  private createFallbackResult(
    content: string, 
    title?: string, 
    difficulty?: string, 
    maxCards?: number
  ): FlashcardGenerationResult {
    logger.info('Creating fallback flashcards due to AI failure');

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const cardCount = Math.min(maxCards || 10, Math.max(3, Math.floor(sentences.length / 2)));
    
    const fallbackCards: GeneratedFlashcard[] = [];
    
    for (let i = 0; i < cardCount && i < sentences.length - 1; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length > 30) {
        fallbackCards.push({
          question: `What is the significance of this concept?`,
          answer: sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''),
          difficulty: (difficulty as any) || 'medium',
          topic: 'General',
          type: 'concept',
          tags: ['fallback', 'general'],
          confidence: 0.7,
          reasoning: 'Fallback card created due to AI processing failure',
          example: 'Review the source material for more context',
          commonMistake: 'Not understanding the broader context',
          reviewInterval: 3
        });
      }
    }

    return {
      analysis: {
        contentType: 'text',
        subject: 'General',
        difficulty: (difficulty as any) || 'medium',
        keyTopics: ['general'],
        optimalCardCount: cardCount,
        strategy: 'concept'
      },
      flashcards: fallbackCards,
      qualityMetrics: {
        overallScore: 0.7,
        avgConfidence: 0.7,
        topicCoverage: 1.0,
        difficultyDistribution: { easy: 0, medium: cardCount, hard: 0 },
        questionTypes: { concept: cardCount, application: 0, comparison: 0, process: 0 }
      },
      summary: {
        cardsGenerated: cardCount,
        mainTopics: ['General'],
        learningObjectives: ['Review key concepts'],
        recommendedUse: 'Basic review - consider providing more structured content for better results'
      }
    };
  }
}