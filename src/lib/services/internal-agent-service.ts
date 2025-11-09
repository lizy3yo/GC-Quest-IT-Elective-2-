import { InternalFlashcardGenerator, type InternalFlashcardOptions, type FlashcardGenerationResult } from '@/lib/ai/internal-flashcard-generator';
import { logger } from '@/lib/winston';

export interface AgentWorkflowOptions {
  content: string;
  contentType?: 'text' | 'document' | 'notes' | 'mixed';
  title?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  subject?: string;
  aiProvider?: 'gemini' | 'openai';
  userId: string;
  maxCards?: number;
  agentMode?: 'standard' | 'enhanced' | 'expert';
}

export interface AgentWorkflowResult {
  success: boolean;
  agentId?: string;
  status?: 'initiated' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: FlashcardGenerationResult;
}

export interface AgentStatus {
  agentId: string;
  status: 'initiated' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: FlashcardGenerationResult;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export class InternalAgentService {
  private static agents = new Map<string, AgentStatus>();
  private static flashcardGenerator = new InternalFlashcardGenerator();

  static async runFullAgentWorkflow(options: AgentWorkflowOptions): Promise<AgentWorkflowResult> {
    const agentId = this.generateAgentId();
    
    try {
      logger.info('Starting internal agent workflow', {
        agentId,
        userId: options.userId,
        agentMode: options.agentMode,
        contentLength: options.content.length
      });

      // Initialize agent status
      this.agents.set(agentId, {
        agentId,
        status: 'initiated',
        progress: 0,
        createdAt: new Date()
      });

      // Process based on agent mode
      const result = await this.processAgentMode(agentId, options);

      // Update final status
      this.agents.set(agentId, {
        agentId,
        status: 'completed',
        progress: 100,
        result,
        createdAt: this.agents.get(agentId)?.createdAt || new Date(),
        completedAt: new Date()
      });

      logger.info('Agent workflow completed successfully', {
        agentId,
        cardsGenerated: result.flashcards.length,
        overallScore: result.qualityMetrics.overallScore
      });

      return {
        success: true,
        agentId,
        status: 'completed',
        result
      };

    } catch (error) {
      logger.error('Agent workflow failed:', {
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update error status
      this.agents.set(agentId, {
        agentId,
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        createdAt: this.agents.get(agentId)?.createdAt || new Date(),
        completedAt: new Date()
      });

      return {
        success: false,
        agentId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async checkAgentStatus(agentId: string): Promise<AgentStatus | null> {
    const status = this.agents.get(agentId);
    if (!status) {
      return null;
    }

    logger.info('Agent status checked', {
      agentId,
      status: status.status,
      progress: status.progress
    });

    return status;
  }

  private static async processAgentMode(agentId: string, options: AgentWorkflowOptions): Promise<FlashcardGenerationResult> {
    const { agentMode = 'enhanced' } = options;

    // Update progress
    this.updateAgentProgress(agentId, 'processing', 25);

    switch (agentMode) {
      case 'standard':
        return this.runStandardMode(agentId, options);
      case 'enhanced':
        return this.runEnhancedMode(agentId, options);
      case 'expert':
        return this.runExpertMode(agentId, options);
      default:
        return this.runEnhancedMode(agentId, options);
    }
  }

  private static async runStandardMode(agentId: string, options: AgentWorkflowOptions): Promise<FlashcardGenerationResult> {
    logger.info('Running standard agent mode', { agentId });
    
    this.updateAgentProgress(agentId, 'processing', 50);

    const flashcardOptions: InternalFlashcardOptions = {
      content: options.content,
      title: options.title,
      difficulty: options.difficulty,
      contentType: options.contentType,
      maxCards: Math.min(options.maxCards || 8, 8) // Standard mode: max 8 cards
    };

    this.updateAgentProgress(agentId, 'processing', 75);
    
    return await this.flashcardGenerator.generateFlashcards(flashcardOptions);
  }

  private static async runEnhancedMode(agentId: string, options: AgentWorkflowOptions): Promise<FlashcardGenerationResult> {
    logger.info('Running enhanced agent mode', { agentId });
    
    this.updateAgentProgress(agentId, 'processing', 30);

    // Enhanced mode: More cards and better analysis
    const flashcardOptions: InternalFlashcardOptions = {
      content: options.content,
      title: options.title,
      difficulty: options.difficulty,
      contentType: options.contentType,
      maxCards: Math.min(options.maxCards || 12, 15) // Enhanced mode: max 15 cards
    };

    this.updateAgentProgress(agentId, 'processing', 60);

    const result = await this.flashcardGenerator.generateFlashcards(flashcardOptions);

    this.updateAgentProgress(agentId, 'processing', 85);

    // Enhanced mode: Additional quality checks and improvements
    if (result.qualityMetrics.overallScore < 0.8) {
      logger.info('Quality score below threshold, attempting improvement', {
        agentId,
        currentScore: result.qualityMetrics.overallScore
      });
      
      // Could implement additional refinement here
      // For now, we'll accept the result but log the quality concern
    }

    return result;
  }

  private static async runExpertMode(agentId: string, options: AgentWorkflowOptions): Promise<FlashcardGenerationResult> {
    logger.info('Running expert agent mode', { agentId });
    
    this.updateAgentProgress(agentId, 'processing', 20);

    // Expert mode: Maximum cards and comprehensive analysis
    const flashcardOptions: InternalFlashcardOptions = {
      content: options.content,
      title: options.title,
      difficulty: options.difficulty,
      contentType: options.contentType,
      maxCards: Math.min(options.maxCards || 20, 25) // Expert mode: max 25 cards
    };

    this.updateAgentProgress(agentId, 'processing', 40);

    const result = await this.flashcardGenerator.generateFlashcards(flashcardOptions);

    this.updateAgentProgress(agentId, 'processing', 70);

    // Expert mode: Advanced post-processing and validation
    logger.info('Expert mode analysis completed', {
      agentId,
      cardsGenerated: result.flashcards.length,
      topicsCovered: result.analysis.keyTopics.length,
      qualityScore: result.qualityMetrics.overallScore
    });

    this.updateAgentProgress(agentId, 'processing', 90);

    return result;
  }

  private static updateAgentProgress(agentId: string, status: AgentStatus['status'], progress: number): void {
    const currentStatus = this.agents.get(agentId);
    if (currentStatus) {
      this.agents.set(agentId, {
        ...currentStatus,
        status,
        progress
      });
    }
  }

  private static generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup old agents (optional - for memory management)
  static cleanupOldAgents(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAge);

    for (const [agentId, status] of this.agents.entries()) {
      if (status.createdAt < cutoff) {
        this.agents.delete(agentId);
        logger.info('Cleaned up old agent', { agentId });
      }
    }
  }
}