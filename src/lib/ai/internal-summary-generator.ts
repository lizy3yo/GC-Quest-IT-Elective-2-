import Bytez from 'bytez.js';
import { logger } from '@/lib/winston';

export interface InternalSummaryOptions {
  content: string;
  title?: string;
  subject?: string;
  summaryType?: 'brief' | 'detailed' | 'bullet-points' | 'outline';
  maxLength?: number;
}

export interface GeneratedSummary {
  title: string;
  content: string;
  keyPoints: string[];
  mainTopics: string[];
  wordCount: number;
  readingTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  summaryType: 'brief' | 'detailed' | 'bullet-points' | 'outline';
  tags: string[];
  confidence: number;
}

export interface SummaryGenerationResult {
  summary: GeneratedSummary;
  originalWordCount: number;
  compressionRatio: number;
  processingTime: number;
  qualityScore: number;
}

export class InternalSummaryGenerator {
  private genAI: any;
  private fallbackModels: string[];

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY_Summaries;
    if (!apiKey) {
      throw new Error('Google AI API key for summaries not configured. Set GOOGLE_AI_API_KEY_Summaries');
    }

    logger.info('InternalSummaryGenerator initialized', {
      hasApiKey: !!apiKey,
      keyPreview: apiKey.substring(0, 10) + '...',
      keyLength: apiKey.length
    });

    // Initialize Bytez client with the summary API key
    this.genAI = new Bytez(apiKey);
    this.fallbackModels = [
      'openai/gpt-4.1',
      'openai-community/gpt2',
      'google/gemma-3-1b-it'
    ];
  }

  async generateSummary(options: InternalSummaryOptions): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    const { content, title, subject, summaryType = 'detailed', maxLength = 300 } = options;

    if (!content || content.trim().length < 100) {
      throw new Error('Content must be at least 100 characters long');
    }

    if (content.length > 100000) {
      throw new Error('Content too long. Please limit to 100,000 characters');
    }

    const prompt = this.createPrompt(content, title, subject, summaryType, maxLength);

    try {
      logger.info('Generating summary with Bytez/OpenAI GPT-4.1', {
        contentLength: content.length,
        summaryType,
        maxLength,
        subject
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

      // Calculate metrics
      const originalWordCount = content.split(/\s+/).length;
      const summaryWordCount = parsedResult.summary.content.split(/\s+/).length;
      const compressionRatio = Math.max(0, Math.round((1 - summaryWordCount / originalWordCount) * 100));
      const processingTime = Date.now() - startTime;

      const finalResult: SummaryGenerationResult = {
        summary: parsedResult.summary,
        originalWordCount,
        compressionRatio,
        processingTime,
        qualityScore: parsedResult.summary.confidence
      };

      // Validate the result
      this.validateResult(finalResult);

      logger.info('Summary generation completed successfully', {
        originalWords: originalWordCount,
        summaryWords: summaryWordCount,
        compressionRatio,
        processingTime,
        qualityScore: finalResult.qualityScore
      });

      return finalResult;

    } catch (error) {
      logger.error('Internal summary generation failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentLength: content.length
      });

      // Create fallback summary
      return this.createFallbackResult(content, title, subject, summaryType, maxLength, startTime);
    }
  }

  private createPrompt(
    content: string,
    title?: string,
    subject?: string,
    summaryType?: string,
    maxLength?: number
  ): string {
    return `You are an expert at creating concise, easy-to-understand summaries for students. Your goal is to distill complex content into clear, digestible summaries that capture the main concepts without getting lost in specific details.

INPUT:
- CONTENT: ${content}
- TITLE: ${title || 'Study Material'}
- SUBJECT: ${subject || 'General'}
- SUMMARY TYPE: ${summaryType}
- MAX LENGTH: ${maxLength} words

SUMMARY APPROACH:
Focus on creating a SHORT, CONCISE summary that:
- Explains the main concepts in simple terms
- Avoids excessive detail and specific examples
- Uses clear, straightforward language
- Helps students understand the big picture
- Is easy to read and remember

SUMMARY TYPES:
- brief: Very concise overview (100-200 words) - focus on core concepts only
- detailed: Balanced summary (300-500 words) - main concepts with some context
- bullet-points: Key concepts as clear bullet points
- outline: Main topics with brief explanations

WRITING STYLE:
- Use simple, clear language that students can easily understand
- Focus on WHAT the topic is about, not specific details
- Explain concepts in a way that makes sense to someone learning
- Avoid jargon unless necessary (and explain it if used)
- Make it conversational but informative

EXAMPLE TRANSFORMATION:
Instead of: "The lecture began by differentiating UI and UX. User Experience (UX) encompasses the overall experience a user has with a website or application, focusing on the flow and layout to ensure ease of understanding and navigation..."

Write: "This covers the basics of UI and UX design. UI (User Interface) is about how things look and what users click on. UX (User Experience) is about making websites and apps easy and enjoyable to use..."

JSON SCHEMA:
{
  "summary": {
    "title": "Clear, descriptive title (max 200 characters)",
    "content": "Concise, easy-to-understand summary focusing on main concepts (max 10000 characters)",
    "keyPoints": ["Simple key point 1 (max 500 chars)", "Simple key point 2", "Simple key point 3", "Simple key point 4", "Simple key point 5"],
    "mainTopics": ["Topic 1 (max 100 chars)", "Topic 2 (max 100 chars)", "Topic 3 (max 100 chars)"],
    "wordCount": ${maxLength},
    "readingTime": 2,
    "difficulty": "easy|medium|hard",
    "subject": "${subject || 'General'}",
    "summaryType": "${summaryType}",
    "tags": ["tag1", "tag2", "tag3"],
    "confidence": 0.9
  }
}

CRITICAL LENGTH CONSTRAINTS:
- title: Maximum 200 characters
- content: Maximum 10,000 characters
- keyPoints: Each point maximum 500 characters
- mainTopics: Each topic maximum 100 characters (KEEP THESE SHORT - just the topic name, not a description!)
- tags: Each tag maximum 50 characters

IMPORTANT: mainTopics should be SHORT topic names only (e.g., "Career Development", "Programming Basics", "Study Techniques"), NOT long descriptions or sentences!

QUALITY REQUIREMENTS:
1. Summary must be CONCISE and focused on main concepts
2. Use SIMPLE language that students can easily understand
3. Avoid unnecessary details and specific examples
4. Make it feel like a helpful study guide, not lecture notes
5. Key points should be clear and memorable
6. Focus on understanding, not memorization

Return ONLY the JSON object. No markdown, no code blocks, no additional text.

CRITICAL OUTPUT FORMAT:
- Return ONLY the JSON object
- NO markdown code blocks
- NO \`\`\`json or \`\`\` tags
- NO additional text or explanations
- Start directly with { and end with }`;
  }

  private parseAIResponse(response: string): { summary: GeneratedSummary } {
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
      if (!parsed.summary) {
        throw new Error('Invalid response structure - missing summary field');
      }

      // Enforce length constraints to prevent validation errors
      const summary = parsed.summary;
      
      // Truncate title if too long
      if (summary.title && summary.title.length > 200) {
        summary.title = summary.title.substring(0, 197) + '...';
      }
      
      // Truncate content if too long
      if (summary.content && summary.content.length > 10000) {
        summary.content = summary.content.substring(0, 9997) + '...';
      }
      
      // Truncate key points if too long
      if (Array.isArray(summary.keyPoints)) {
        summary.keyPoints = summary.keyPoints.map((point: string) => 
          point && point.length > 500 ? point.substring(0, 497) + '...' : point
        );
      }
      
      // Truncate main topics if too long (this is the critical fix)
      if (Array.isArray(summary.mainTopics)) {
        summary.mainTopics = summary.mainTopics.map((topic: string) => 
          topic && topic.length > 100 ? topic.substring(0, 97) + '...' : topic
        );
      }
      
      // Truncate tags if too long
      if (Array.isArray(summary.tags)) {
        summary.tags = summary.tags.map((tag: string) => 
          tag && tag.length > 50 ? tag.substring(0, 47) + '...' : tag
        );
      }

      return { summary } as { summary: GeneratedSummary };

    } catch (error) {
      logger.error('Failed to parse AI response:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: response.substring(0, 200)
      });
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  private validateResult(result: SummaryGenerationResult): void {
    if (!result.summary || !result.summary.content) {
      throw new Error('No summary content generated');
    }

    if (result.summary.content.length < 50) {
      throw new Error('Summary too short');
    }

    if (!result.summary.keyPoints || result.summary.keyPoints.length === 0) {
      throw new Error('No key points generated');
    }

    if (!result.summary.mainTopics || result.summary.mainTopics.length === 0) {
      throw new Error('No main topics identified');
    }

    logger.info('Summary validation passed', {
      contentLength: result.summary.content.length,
      keyPointsCount: result.summary.keyPoints.length,
      mainTopicsCount: result.summary.mainTopics.length,
      confidence: result.summary.confidence
    });
  }

  private createFallbackResult(
    content: string,
    title?: string,
    subject?: string,
    summaryType?: string,
    maxLength?: number,
    startTime?: number
  ): SummaryGenerationResult {
    logger.info('Creating fallback summary due to AI failure');

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const targetSentences = Math.min(Math.max(3, Math.floor((maxLength || 500) / 50)), sentences.length);

    const fallbackContent = sentences.slice(0, targetSentences).join('. ').trim() + '.';
    const wordCount = fallbackContent.split(/\s+/).length;

    const fallbackSummary: GeneratedSummary = {
      title: title || 'Summary',
      content: fallbackContent,
      keyPoints: sentences.slice(0, 5).map(s => s.trim().substring(0, 100)),
      mainTopics: ['General'],
      wordCount,
      readingTime: Math.ceil(wordCount / 250),
      difficulty: 'medium',
      subject: subject || 'General',
      summaryType: (summaryType as any) || 'detailed',
      tags: ['fallback', 'general'],
      confidence: 0.6
    };

    return {
      summary: fallbackSummary,
      originalWordCount: content.split(/\s+/).length,
      compressionRatio: Math.max(0, Math.round((1 - wordCount / content.split(/\s+/).length) * 100)),
      processingTime: startTime ? Date.now() - startTime : 0,
      qualityScore: 0.6
    };
  }
}