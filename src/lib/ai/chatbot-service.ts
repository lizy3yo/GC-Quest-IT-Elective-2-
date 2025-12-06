import Bytez from 'bytez.js';
import { logger } from '@/lib/winston';
import { ChatbotContextService, UserContext } from './chatbot-context-service';
import { containsProfanity, findProfanity } from './profanity-filter';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export interface ChatbotOptions {
    isAuthenticated: boolean;
    userId?: string;
    conversationHistory?: ChatMessage[];
    uploadedContent?: string;
    uploadedFileName?: string;
}

export interface ChatbotResponse {
    message: string;
    context: 'landing' | 'authenticated';
    suggestions?: string[];
}

export class ChatbotService {
    private genAI: any;
    private currentModel: string;
    private fallbackModels: string[];

    constructor() {
        // Priority order: Use dedicated chatbot key first, then fallback to shared keys
        const apiKey = process.env.GOOGLE_AI_API_KEY_Chatbot
            || process.env.GOOGLE_AI_API_KEY_FLASHCARD
            || process.env.GOOGLE_AI_API_KEY_Summaries;

        if (!apiKey) {
            logger.error('Google AI API key for chatbot not configured');
            throw new Error('Chatbot service is not properly configured. Please contact support.');
        }

        logger.info('ChatbotService initialized', {
            hasApiKey: !!apiKey,
            keyLength: apiKey.length,
            keyPreview: apiKey.substring(0, 20) + '...'
        });

        try {
            // Initialize Bytez client with the chatbot API key
            this.genAI = new Bytez(apiKey);
            this.currentModel = "openai/gpt-4.1"; // Using Bytez with OpenAI GPT-4.1
            this.fallbackModels = [
                'openai/gpt-4.1',
                'openai-community/gpt2',
                'google/gemma-3-1b-it'
            ];
        } catch (error) {
            logger.error('Failed to initialize Bytez:', error);
            throw new Error('Failed to initialize chatbot service');
        }
    }

    async chat(userMessage: string, options: ChatbotOptions): Promise<ChatbotResponse> {
        // Reject messages containing vulgar/prohibited language early
        if (containsProfanity(userMessage)) {
            const matches = findProfanity(userMessage);
            logger.warn('Chat message blocked due to profanity', { matches });
            throw new Error('Message contains prohibited language');
        }

        const { isAuthenticated, userId, conversationHistory = [], uploadedContent, uploadedFileName } = options;

        // Also check uploaded content at the service level as an additional safety net
        if (containsProfanity(uploadedContent)) {
            const matches = findProfanity(uploadedContent);
            logger.warn('Uploaded content blocked due to profanity', { matches, userId });
            throw new Error('Uploaded content contains prohibited language');
        }

        try {
            logger.info('Processing chat message', {
                isAuthenticated,
                hasUserId: !!userId,
                messageLength: userMessage.length,
                hasUploadedContent: !!uploadedContent
            });

            // Build context
            let systemContext = '';
            let userContextData: UserContext | null = null;

            if (isAuthenticated && userId) {
                // Authenticated user - get full context
                systemContext = ChatbotContextService.getSystemFeaturesContext();

                try {
                    userContextData = await ChatbotContextService.getUserContext(userId);
                    systemContext += '\n\n' + ChatbotContextService.formatUserContextForAI(userContextData);
                } catch (contextError) {
                    logger.warn('Failed to get user context, continuing without it:', contextError);
                    // Continue without user context - chatbot will still work
                }
            } else {
                // Landing page - only system info
                systemContext = ChatbotContextService.getLandingPageContext();
            }

            // Add uploaded content if present
            if (uploadedContent && uploadedFileName) {
                systemContext += `\n\n# Uploaded File Context:\nFile: ${uploadedFileName}\nContent:\n${uploadedContent.substring(0, 5000)}`;
            }

            // Create prompt
            const prompt = this.createPrompt(systemContext, userMessage, conversationHistory, isAuthenticated);

            // Use Bytez SDK with fallback models
            logger.info('Generating chatbot response with Bytez');

            let lastError: Error | null = null;
            
            for (const modelName of this.fallbackModels) {
                try {
                    logger.info(`Attempting chat with model: ${modelName}`);
                    
                    const model = this.genAI.model(modelName);
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
                    let responseText = '';
                    const output = res?.output;
                    
                    if (!output) {
                        responseText = '';
                    } else if (typeof output === 'string') {
                        responseText = output;
                    } else if (typeof output === 'object' && !Array.isArray(output)) {
                        if (typeof output.content === 'string') {
                            responseText = output.content;
                        } else if (typeof output.text === 'string') {
                            responseText = output.text;
                        } else if (output.message && typeof output.message.content === 'string') {
                            responseText = output.message.content;
                        }
                    } else if (Array.isArray(output)) {
                        for (const item of output) {
                            if (!item) continue;
                            if (typeof item === 'string') responseText += item;
                            else if (typeof item === 'object') {
                                if (typeof item.content === 'string') responseText += item.content;
                                else if (typeof item.text === 'string') responseText += item.text;
                                else if (Array.isArray(item.content)) {
                                    for (const c of item.content) {
                                        if (typeof c === 'string') responseText += c;
                                        else if (typeof c.text === 'string') responseText += c.text;
                                    }
                                } else if (item.message && typeof item.message.content === 'string') {
                                    responseText += item.message.content;
                                }
                            }
                        }
                    }

                    if (!responseText) {
                        throw new Error('No response text generated');
                    }

                    logger.info(`Chatbot response generated successfully with ${modelName}`, {
                        responseLength: responseText.length
                    });

                    // Generate suggestions based on context
                    const suggestions = this.generateSuggestions(userMessage, isAuthenticated, userContextData);

                    return {
                        message: responseText,
                        context: isAuthenticated ? 'authenticated' : 'landing',
                        suggestions
                    };
                    
                } catch (error) {
                    logger.warn(`Model ${modelName} failed:`, error instanceof Error ? error.message : 'Unknown error');
                    lastError = error instanceof Error ? error : new Error('Unknown error');
                    
                    // Provide specific error messages for certain errors
                    if (error instanceof Error) {
                        if (error.message.includes('401') || error.message.includes('API key')) {
                            throw new Error('Invalid API key. Please update your chatbot API key configuration.');
                        }
                    }
                    // Continue to next model for other errors
                }
            }
            
            // If all models failed, throw the last error
            throw lastError || new Error('All models failed to generate response');

        } catch (error) {
            logger.error('Chatbot error:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                errorType: error?.constructor?.name,
                fullError: JSON.stringify(error, null, 2),
                isAuthenticated,
                userId
            });

            // Provide more specific error messages
            if (error instanceof Error) {
                if (error.message.includes('API key') || error.message.includes('API_KEY')) {
                    throw new Error('Chatbot service configuration error. Please contact support.');
                }
                if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
                    throw new Error('Service is temporarily busy. Please try again in a moment.');
                }
                if (error.message.includes('PERMISSION_DENIED') || error.message.includes('403')) {
                    throw new Error('API key does not have permission. Please check your Google AI API key configuration.');
                }
                if (error.message.includes('INVALID_ARGUMENT') || error.message.includes('400')) {
                    throw new Error('Invalid request to AI service. Please try a different message.');
                }

                throw error; // Pass through the original error
            }

            throw new Error('Failed to generate response. Please try again.');
        }
    }

    private createPrompt(
        systemContext: string,
        userMessage: string,
        conversationHistory: ChatMessage[],
        isAuthenticated: boolean
    ): string {
        const conversationHistoryText = conversationHistory
            .slice(-5) // Last 5 messages
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n');

        return `You are the GC Quest AI Study Assistant, a helpful, knowledgeable, and friendly AI assistant for the GC Quest learning platform.

IMPORTANT: The platform name is "GC Quest" - NEVER mention "NoteWise" or any other platform name.

${systemContext}

# Your Role:
${isAuthenticated ? `
- Act as a personalized AI study assistant that knows the user's complete learning data
- Analyze their quiz scores, exam results, practice test performance, and study patterns
- Provide specific, data-driven study advice based on their actual performance
- Identify weak areas from their quiz/exam results and suggest focused study strategies
- Celebrate their achievements and encourage continued progress
- Help users understand how to use GC Quest features
- Guide them on creating live quizzes and deadline-based assignments
- Recommend specific actions based on their data (e.g., "Your Math quiz scores are lower - consider creating more Math flashcards")
- Track their study streak and motivate them to maintain it
- Suggest optimal study times based on their activity patterns
` : `
- Explain what GC Quest is and how it works
- Describe the dual quiz modes (Live Quiz Presentations and Self-Paced Quizzes)
- Explain the features and benefits
- Answer questions about the platform
- Encourage users to sign up
- Be enthusiastic about GC Quest's capabilities
`}

# Study Advice Guidelines (for authenticated users):
When providing study advice, consider:
1. If average quiz score is below 70%, suggest reviewing weak topics and creating more flashcards
2. If study streak is broken, encourage them to get back on track
3. If they haven't taken practice tests recently, recommend taking one to assess knowledge
4. If exam scores are lower than quiz scores, suggest more focused exam preparation
5. Identify their most studied subject and suggest diversifying if needed
6. If they have low activity, suggest setting daily study goals
7. Praise high scores and consistent study habits
8. For teachers: provide insights on class performance and quiz creation tips

# Conversation Style:
- Be friendly, helpful, and conversational
- Keep responses concise (2-4 paragraphs max)
- Use simple language that students understand
- Be encouraging and supportive
- Always refer to the platform as "GC Quest" - never use other platform names
- When giving study advice, be specific and reference their actual data
- Use emojis sparingly to make responses engaging (📚, ✨, 🎯, 💪)
- If asked about their stats, provide accurate numbers from the context
- For personal data questions (achievements, history, scores), use the provided user context

${conversationHistoryText ? `# Recent Conversation:\n${conversationHistoryText}\n` : ''}

# User Question:
${userMessage}

# Your Response:
Provide a helpful, personalized response based on the user's actual data and context above. If they ask about their performance or need study advice, analyze their stats and give specific, actionable recommendations. Keep it concise and encouraging. Remember to ONLY mention "GC Quest" as the platform name.`;
    }

    private generateSuggestions(
        userMessage: string,
        isAuthenticated: boolean,
        userContext: UserContext | null
    ): string[] {
        if (!isAuthenticated) {
            return [
                "What features does GC Quest offer?",
                "How do live quiz presentations work?",
                "What is GC Quest?",
                "How do I get started?"
            ];
        }

        // Authenticated suggestions based on context
        const suggestions: string[] = [];

        if (userContext) {
            if (userContext.achievements.totalFlashcards === 0) {
                suggestions.push("How do I create my first flashcard set?");
            }
            if (userContext.achievements.totalSummaries === 0) {
                suggestions.push("How do I create a quiz?");
            }
            if (userContext.achievements.totalPracticeTests === 0) {
                suggestions.push("What are the different quiz modes?");
            }
            suggestions.push("What are my recent achievements?");
            suggestions.push("Show me my study history");
        }

        // Default suggestions
        if (suggestions.length < 4) {
            suggestions.push(
                "How do I create a live quiz?",
                "Can I assign deadline-based quizzes?",
                "How does the flashcard system work?",
                "How do I track student progress?"
            );
        }

        return suggestions.slice(0, 4);
    }
}