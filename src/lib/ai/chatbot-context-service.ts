import { logger } from '@/lib/winston';
import User from '@/models/user';
import Activity from '@/models/activity';
import Flashcard from '@/models/flashcard';
import { Summary } from '@/models/summary';
import { PracticeTest } from '@/models/practice-test';
import { PracticeTestSubmission } from '@/models/practice-test-submission';
import StudyProgress from '@/models/study_progress';
import Assessment from '@/models/assessment';
import Submission from '@/models/submission';
import Class from '@/models/class';

export interface UserContext {
    profile: {
        username: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    };
    achievements: {
        totalFlashcards: number;
        totalSummaries: number;
        totalPracticeTests: number;
        totalActivities: number;
        recentAchievements: string[];
    };
    history: {
        recentActivities: Array<{
            type: string;
            action: string;
            createdAt: Date;
        }>;
        recentFlashcards: Array<{
            title: string;
            createdAt: Date;
        }>;
        recentSummaries: Array<{
            title: string;
            createdAt: Date;
        }>;
    };
    stats: {
        studyStreak: number;
        totalStudyTime: number;
        averageScore: number;
    };
    // New comprehensive stats
    quizStats: {
        totalQuizzesTaken: number;
        totalQuizzesCreated: number;
        averageQuizScore: number;
        highestQuizScore: number;
        lowestQuizScore: number;
        recentQuizResults: Array<{
            title: string;
            score: number;
            totalPoints: number;
            percentage: number;
            completedAt: Date;
        }>;
    };
    examStats: {
        totalExamsTaken: number;
        averageExamScore: number;
        recentExamResults: Array<{
            title: string;
            score: number;
            totalPoints: number;
            percentage: number;
            completedAt: Date;
        }>;
    };
    practiceTestStats: {
        totalCompleted: number;
        averageScore: number;
        recentResults: Array<{
            title: string;
            score: number;
            totalQuestions: number;
            percentage: number;
            completedAt: Date;
        }>;
    };
    classStats: {
        totalClasses: number;
        classNames: string[];
        totalStudentsInClasses?: number; // For teachers
    };
    leaderboardStats: {
        rank?: number;
        totalPoints: number;
        weeklyPoints: number;
    };
    studyPatterns: {
        mostActiveDay: string;
        mostStudiedSubject: string;
        averageSessionDuration: number;
        totalStudySessions: number;
    };
}

export class ChatbotContextService {
    /**
     * Get landing page context - information about the system
     */
    static getLandingPageContext(): string {
        return `
# GC Quest - Interactive Learning Platform

## What is GC Quest?
GC Quest is an intelligent quiz and flashcard learning platform designed for modern education. It combines interactive quizzes, smart flashcards, AI-powered content generation, and adaptive learning features to help students master any subject.

## Key Features:
1. **Dual Quiz Modes**:
   - **Live Quiz Presentations**: Real-time interactive quizzes for classroom engagement with instant feedback
   - **Self-Paced Quizzes**: Deadline-based assignments students can complete at their own pace
2. **AI-Powered Content Generation**:
   - **Smart Summarization**: Automatically generates clear, concise summaries from uploaded notes and documents (PDF, DOCX, TXT support)
   - **Flashcard Generation**: Transforms key concepts from summaries or documents into interactive flashcards for active recall
   - **Practice Test Creation**: Generates practice tests from your study materials to test knowledge
3. **Smart Flashcards**: Create custom flashcard decks with rich media support and spaced repetition
4. **Adaptive Learning**: AI-powered system that adjusts to student learning pace
5. **Progress Analytics**: Detailed tracking and insights for both students and teachers
6. **Study Modes**: Multiple learning approaches including Learn Mode, Test Mode, and Match Games
7. **Classroom Management**: Teachers can create classes, assign quizzes, and track student progress
8. **File Upload Interface**: Drag & drop interface supporting PDF, DOCX, and TXT formats

## How It Works:
1. **Upload or Create**: Upload your study materials (PDF, DOCX, TXT) or create content from scratch
2. **AI Enhancement**: Let AI generate summaries, flashcards, or practice tests from your materials
3. **Create Quizzes**: Build engaging quizzes with multiple question types and interactive elements
4. **Choose Your Mode**: Host live presentations for immediate engagement or assign deadline-based quizzes
5. **Track & Analyze**: Monitor student progress with detailed analytics and identify learning gaps

## Target Users:
- **Teachers**: Need tools to create engaging assessments and track student performance
- **Students**: Want interactive study materials, AI-generated summaries, and practice tests
- **Schools**: Looking for comprehensive learning management solutions
- **The Overloaded Student**: Needs quick summaries of long readings
- **The Active Learner**: Enjoys interactive study methods like flashcards and quizzes
- **The Efficient Achiever**: Values organized and accessible notes

## Benefits:
- Transform learning materials into digestible summaries with AI
- Real-time classroom engagement with live quizzes
- Flexible learning with self-paced assignments
- Create interactive flashcards for active learning automatically
- Scientifically-proven spaced repetition for flashcards
- Comprehensive progress tracking and analytics
- Interactive study modes that make learning fun
- Save time with AI-powered content generation

## Getting Started:
Sign up for free to start transforming your learning experience with GC Quest's interactive tools and AI-powered features.
`;
    }

    /**
     * Get system features context for authenticated users
     */
    static getSystemFeaturesContext(): string {
        return `
# GC Quest System Features (Authenticated)

## Available Features:
1. **Create Quizzes**: Build interactive quizzes with multiple question types and rich media
2. **Live Quiz Mode**: Host real-time quiz presentations with instant feedback and engagement
3. **Deadline-Based Quizzes**: Assign self-paced quizzes with flexible deadlines
4. **AI Content Generation**:
   - **Generate Flashcards**: Create flashcards from text, uploaded files (PDF, DOCX, TXT), or existing summaries
   - **Generate Summaries**: Create AI-powered summaries from uploaded documents
   - **Generate Practice Tests**: Create practice tests from your study materials
5. **Flashcard Management**: Create and organize flashcard decks with spaced repetition
6. **Study Progress Tracking**: Monitor learning progress, scores, and achievements
7. **Class Management** (Teachers): Create classes, invite students, and assign assessments
8. **Analytics Dashboard**: View detailed insights on performance and learning patterns
9. **Library Management**: Organize flashcards, summaries, and practice tests in folders
10. **Activity History**: Track recent study activities, quiz attempts, and content generation
11. **Profile Management**: Customize your profile and settings

## How to Use:
- **Upload Files**: Go to Summaries or Flashcards section and upload PDF, DOCX, or TXT files
- **Generate from Text**: Paste text directly to generate flashcards, summaries, or practice tests
- **Create Quiz**: Go to Assessment section and build your quiz with different question types
- **Host Live Quiz**: Start a live presentation for real-time classroom engagement
- **Assign Quiz**: Set a deadline for students to complete at their own pace
- **Study Flashcards**: Use Learn Mode, Test Mode, or Match Games to practice
- **View Analytics**: Check your dashboard for progress insights and statistics
- **Organize Content**: Use folders to organize quizzes, flashcards, summaries, and practice tests by subject
- **View History**: Check your activity history and achievements in your profile

## System Purpose:
GC Quest helps you learn more effectively by:
- Creating engaging interactive quizzes and assessments
- Providing real-time feedback during live quiz sessions
- Offering flexible self-paced learning options
- Converting complex materials into simple summaries with AI
- Creating interactive flashcards for active recall automatically
- Generating practice tests to assess your knowledge
- Using spaced repetition for better knowledge retention
- Tracking your progress with detailed analytics
- Organizing all your study materials in one place
- Making learning fun with gamified study modes
`;
    }

    /**
     * Get user-specific context (achievements, history, stats)
     */
    static async getUserContext(userId: string): Promise<UserContext> {
        try {
            // Get user profile
            const user = await User.findById(userId).select('username firstName lastName email role');
            if (!user) {
                throw new Error('User not found');
            }

            const isTeacher = user.role === 'teacher';
            const isStudent = user.role === 'student';

            // Get counts
            const [flashcardCount, summaryCount, practiceTestCount, activityCount] = await Promise.all([
                Flashcard.countDocuments({ user: userId }),
                Summary.countDocuments({ userId: userId }),
                PracticeTest.countDocuments({ user: userId }),
                Activity.countDocuments({ user: userId })
            ]);

            // Get recent activities
            const recentActivities = await Activity.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('type action createdAt meta');

            // Get recent flashcards
            const recentFlashcards = await Flashcard.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title createdAt');

            // Get recent summaries
            const recentSummaries = await Summary.find({ userId: userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title createdAt');

            // Get quiz/assessment stats
            let quizSubmissions: any[] = [];
            let examSubmissions: any[] = [];
            let quizzesCreated = 0;
            
            if (isStudent) {
                // Get student's quiz submissions
                quizSubmissions = await Submission.find({ 
                    studentId: userId,
                    status: { $in: ['submitted', 'graded'] }
                })
                .sort({ submittedAt: -1 })
                .limit(20)
                .lean();
                
                // Get assessment details for each submission
                const assessmentIds = [...new Set(quizSubmissions.map((s: any) => s.assessmentId))];
                const assessments = await Assessment.find({ _id: { $in: assessmentIds } })
                    .select('title type totalPoints')
                    .lean();
                const assessmentMap = new Map(assessments.map((a: any) => [a._id.toString(), a]));
                
                // Attach assessment info to submissions
                quizSubmissions = quizSubmissions.map((s: any) => ({
                    ...s,
                    assessment: assessmentMap.get(s.assessmentId) || null,
                    score: s.score || 0
                }));
                
                // Separate quizzes and exams based on assessment type
                examSubmissions = quizSubmissions.filter((s: any) => 
                    s.assessment?.type === 'exam' || s.assessment?.type === 'Exam'
                );
                quizSubmissions = quizSubmissions.filter((s: any) => 
                    s.assessment?.type !== 'exam' && s.assessment?.type !== 'Exam'
                );
            } else if (isTeacher) {
                // Get teacher's created assessments count
                quizzesCreated = await Assessment.countDocuments({ createdBy: userId });
            }

            // Calculate quiz stats
            const quizScores = quizSubmissions.map((s: any) => ({
                score: s.score || 0,
                total: s.assessment?.totalPoints || 100,
                percentage: s.assessment?.totalPoints ? Math.round((s.score / s.assessment.totalPoints) * 100) : 0
            }));
            const avgQuizScore = quizScores.length > 0 
                ? Math.round(quizScores.reduce((sum, s) => sum + s.percentage, 0) / quizScores.length) 
                : 0;
            const highestQuizScore = quizScores.length > 0 
                ? Math.max(...quizScores.map(s => s.percentage)) 
                : 0;
            const lowestQuizScore = quizScores.length > 0 
                ? Math.min(...quizScores.map(s => s.percentage)) 
                : 0;

            // Calculate exam stats
            const examScores = examSubmissions.map((s: any) => ({
                score: s.score || 0,
                total: s.assessment?.totalPoints || 100,
                percentage: s.assessment?.totalPoints ? Math.round((s.score / s.assessment.totalPoints) * 100) : 0
            }));
            const avgExamScore = examScores.length > 0 
                ? Math.round(examScores.reduce((sum, s) => sum + s.percentage, 0) / examScores.length) 
                : 0;

            // Get practice test submissions
            const practiceTestSubmissions = await PracticeTestSubmission.find({ user: userId })
                .populate('practiceTest', 'title')
                .sort({ completedAt: -1 })
                .limit(10)
                .lean();
            
            const ptScores = practiceTestSubmissions.map((s: any) => ({
                score: s.score || 0,
                total: s.totalQuestions || 1,
                percentage: s.totalQuestions ? Math.round((s.score / s.totalQuestions) * 100) : 0
            }));
            const avgPTScore = ptScores.length > 0 
                ? Math.round(ptScores.reduce((sum, s) => sum + s.percentage, 0) / ptScores.length) 
                : 0;

            // Get class stats
            let classes: any[] = [];
            let totalStudentsInClasses = 0;
            
            if (isTeacher) {
                classes = await Class.find({ teacher: userId }).select('name students').lean();
                totalStudentsInClasses = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);
            } else if (isStudent) {
                classes = await Class.find({ students: userId }).select('name').lean();
            }

            // Calculate study patterns from activities
            const allActivities = await Activity.find({ user: userId })
                .select('type createdAt meta')
                .lean();
            
            // Most active day
            const dayCount: Record<string, number> = {};
            const subjectCount: Record<string, number> = {};
            allActivities.forEach((a: any) => {
                const day = new Date(a.createdAt).toLocaleDateString('en-US', { weekday: 'long' });
                dayCount[day] = (dayCount[day] || 0) + 1;
                if (a.meta?.subject) {
                    subjectCount[a.meta.subject] = (subjectCount[a.meta.subject] || 0) + 1;
                }
            });
            const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
            const mostStudiedSubject = Object.entries(subjectCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

            // Calculate study streak from activities
            let studyStreak = 0;
            const studyDates = new Set<string>();
            allActivities.forEach((a: any) => {
                const type = (a.type || '').toLowerCase();
                if (type.includes('flashcard.study') || type.includes('summary.read') || type.includes('practice_test')) {
                    const date = new Date(a.createdAt);
                    date.setHours(0, 0, 0, 0);
                    studyDates.add(date.toISOString());
                }
            });
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            for (let i = 0; i < 365; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() - i);
                if (studyDates.has(checkDate.toISOString())) {
                    studyStreak++;
                } else if (i > 0) {
                    break;
                }
            }

            // Calculate achievements
            const recentAchievements: string[] = [];
            if (flashcardCount >= 10) recentAchievements.push(`Created ${flashcardCount} flashcard sets`);
            if (summaryCount >= 5) recentAchievements.push(`Generated ${summaryCount} summaries`);
            if (practiceTestSubmissions.length >= 3) recentAchievements.push(`Completed ${practiceTestSubmissions.length} practice tests`);
            if (activityCount >= 50) recentAchievements.push(`Reached ${activityCount} study activities`);
            if (avgQuizScore >= 80) recentAchievements.push(`Maintaining ${avgQuizScore}% average quiz score`);
            if (studyStreak >= 7) recentAchievements.push(`${studyStreak} day study streak!`);

            return {
                profile: {
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: user.role
                },
                achievements: {
                    totalFlashcards: flashcardCount,
                    totalSummaries: summaryCount,
                    totalPracticeTests: practiceTestCount,
                    totalActivities: activityCount,
                    recentAchievements
                },
                history: {
                    recentActivities: recentActivities.map(a => ({
                        type: a.type,
                        action: a.action,
                        createdAt: a.createdAt!
                    })),
                    recentFlashcards: recentFlashcards.map((f: any) => ({
                        title: f.title,
                        createdAt: f.createdAt!
                    })),
                    recentSummaries: recentSummaries.map((s: any) => ({
                        title: s.title,
                        createdAt: s.createdAt
                    }))
                },
                stats: {
                    studyStreak,
                    totalStudyTime: allActivities.length * 5, // Estimate 5 mins per activity
                    averageScore: avgQuizScore || avgPTScore || 0
                },
                quizStats: {
                    totalQuizzesTaken: quizSubmissions.length,
                    totalQuizzesCreated: quizzesCreated,
                    averageQuizScore: avgQuizScore,
                    highestQuizScore,
                    lowestQuizScore,
                    recentQuizResults: quizSubmissions.slice(0, 5).map((s: any) => ({
                        title: s.assessment?.title || 'Unknown Quiz',
                        score: s.score || 0,
                        totalPoints: s.assessment?.totalPoints || 100,
                        percentage: s.assessment?.totalPoints ? Math.round((s.score / s.assessment.totalPoints) * 100) : 0,
                        completedAt: s.submittedAt
                    }))
                },
                examStats: {
                    totalExamsTaken: examSubmissions.length,
                    averageExamScore: avgExamScore,
                    recentExamResults: examSubmissions.slice(0, 5).map((s: any) => ({
                        title: s.assessment?.title || 'Unknown Exam',
                        score: s.score || 0,
                        totalPoints: s.assessment?.totalPoints || 100,
                        percentage: s.assessment?.totalPoints ? Math.round((s.score / s.assessment.totalPoints) * 100) : 0,
                        completedAt: s.submittedAt
                    }))
                },
                practiceTestStats: {
                    totalCompleted: practiceTestSubmissions.length,
                    averageScore: avgPTScore,
                    recentResults: practiceTestSubmissions.slice(0, 5).map((s: any) => ({
                        title: (s.practiceTest as any)?.title || 'Unknown Test',
                        score: s.score || 0,
                        totalQuestions: s.totalQuestions || 0,
                        percentage: s.totalQuestions ? Math.round((s.score / s.totalQuestions) * 100) : 0,
                        completedAt: s.completedAt
                    }))
                },
                classStats: {
                    totalClasses: classes.length,
                    classNames: classes.map((c: any) => c.name),
                    totalStudentsInClasses: isTeacher ? totalStudentsInClasses : undefined
                },
                leaderboardStats: {
                    totalPoints: activityCount * 10, // Simple point calculation
                    weeklyPoints: recentActivities.length * 10
                },
                studyPatterns: {
                    mostActiveDay,
                    mostStudiedSubject,
                    averageSessionDuration: 15, // Estimate
                    totalStudySessions: allActivities.filter((a: any) => 
                        a.type?.includes('study') || a.type?.includes('flashcard')
                    ).length
                }
            };
        } catch (error) {
            logger.error('Failed to get user context:', error);
            throw error;
        }
    }

    /**
     * Format user context for AI prompt
     */
    static formatUserContextForAI(context: UserContext): string {
        const isTeacher = context.profile.role === 'teacher';
        
        let output = `
# User Profile:
- Name: ${context.profile.firstName} ${context.profile.lastName}
- Username: ${context.profile.username}
- Role: ${context.profile.role}

# Overall Achievements:
- Total Flashcard Sets Created: ${context.achievements.totalFlashcards}
- Total Summaries Generated: ${context.achievements.totalSummaries}
- Total Practice Tests: ${context.achievements.totalPracticeTests}
- Total Study Activities: ${context.achievements.totalActivities}
${context.achievements.recentAchievements.length > 0 ? `- Milestones Reached:\n${context.achievements.recentAchievements.map(a => `  * ${a}`).join('\n')}` : ''}

# Study Stats:
- Current Study Streak: ${context.stats.studyStreak} days
- Estimated Total Study Time: ${Math.round(context.stats.totalStudyTime / 60)} hours
- Overall Average Score: ${context.stats.averageScore}%

# Quiz Performance:
- Total Quizzes Taken: ${context.quizStats.totalQuizzesTaken}
${isTeacher ? `- Total Quizzes Created: ${context.quizStats.totalQuizzesCreated}` : ''}
- Average Quiz Score: ${context.quizStats.averageQuizScore}%
- Highest Quiz Score: ${context.quizStats.highestQuizScore}%
- Lowest Quiz Score: ${context.quizStats.lowestQuizScore}%
${context.quizStats.recentQuizResults.length > 0 ? `- Recent Quiz Results:\n${context.quizStats.recentQuizResults.map(r => `  * ${r.title}: ${r.percentage}% (${r.score}/${r.totalPoints} points)`).join('\n')}` : '- No recent quiz results'}

# Exam Performance:
- Total Exams Taken: ${context.examStats.totalExamsTaken}
- Average Exam Score: ${context.examStats.averageExamScore}%
${context.examStats.recentExamResults.length > 0 ? `- Recent Exam Results:\n${context.examStats.recentExamResults.map(r => `  * ${r.title}: ${r.percentage}% (${r.score}/${r.totalPoints} points)`).join('\n')}` : '- No recent exam results'}

# Practice Test Performance:
- Total Practice Tests Completed: ${context.practiceTestStats.totalCompleted}
- Average Practice Test Score: ${context.practiceTestStats.averageScore}%
${context.practiceTestStats.recentResults.length > 0 ? `- Recent Practice Test Results:\n${context.practiceTestStats.recentResults.map(r => `  * ${r.title}: ${r.percentage}% (${r.score}/${r.totalQuestions} correct)`).join('\n')}` : '- No recent practice test results'}

# Class Information:
- Total Classes: ${context.classStats.totalClasses}
${context.classStats.classNames.length > 0 ? `- Class Names: ${context.classStats.classNames.join(', ')}` : '- No classes enrolled/created'}
${isTeacher && context.classStats.totalStudentsInClasses !== undefined ? `- Total Students Across Classes: ${context.classStats.totalStudentsInClasses}` : ''}

# Leaderboard Stats:
- Total Points Earned: ${context.leaderboardStats.totalPoints}
- Weekly Points: ${context.leaderboardStats.weeklyPoints}
${context.leaderboardStats.rank ? `- Current Rank: #${context.leaderboardStats.rank}` : ''}

# Study Patterns:
- Most Active Day: ${context.studyPatterns.mostActiveDay}
- Most Studied Subject: ${context.studyPatterns.mostStudiedSubject}
- Total Study Sessions: ${context.studyPatterns.totalStudySessions}

# Recent Activity:
${context.history.recentActivities.slice(0, 5).map(a => `- ${a.action} (${a.type}) - ${new Date(a.createdAt).toLocaleDateString()}`).join('\n') || '- No recent activities'}

# Recent Flashcards:
${context.history.recentFlashcards.map(f => `- ${f.title} - ${new Date(f.createdAt).toLocaleDateString()}`).join('\n') || '- No flashcards created yet'}

# Recent Summaries:
${context.history.recentSummaries.map(s => `- ${s.title} - ${new Date(s.createdAt).toLocaleDateString()}`).join('\n') || '- No summaries generated yet'}
`;

        return output;
    }
}