'use client';

import { useEffect } from 'react';
import { useAchievements } from '@/contexts/AchievementContext';
import useAuth from '@/hooks/useAuth';
import { useStudentFlashcards, useStudentSummaries, useStudentHistory } from '@/hooks/useStudentRequest';

/**
 * Global achievement monitor that runs on all pages
 * Automatically checks for newly unlocked achievements and triggers notifications
 */
export default function AchievementMonitor() {
  const { user } = useAuth();
  const { checkForNewAchievements } = useAchievements();

  // Use standardized hooks to fetch data
  const flashcardsQuery = useStudentFlashcards();
  const summariesQuery = useStudentSummaries();
  const historyQuery = useStudentHistory();

  // Note: hooks internally handle polling/caching. We derive arrays from their data shapes below.

  // Calculate achievements whenever hook data changes
  useEffect(() => {
    if (!user?._id) return;

    const flashcardsData = flashcardsQuery.data?.flashcards ?? [];
    const summariesData = summariesQuery.data?.summaries ?? [];
    const activitiesData = (historyQuery.data && (historyQuery.data as any).activities) ?? historyQuery.data ?? [];

    // Calculate all metrics
    const totalFlashcards = flashcardsData.length;
    const totalSummaries = summariesData.length;

    const studySessionsCompleted = activitiesData.filter((a: any) =>
      String(a.type || '').toLowerCase().includes('flashcard.study_complete')
    ).length;

    const summarySessionsCompleted = activitiesData.filter((a: any) =>
      String(a.type || '').toLowerCase().includes('summary.read')
    ).length;

    const practiceTestsCompleted = activitiesData.filter((a: any) =>
      String(a.type || '').toLowerCase().includes('practice_test.submit')
    ).length;

    const cardsReviewed = activitiesData.filter((a: any) =>
      String(a.type || '').toLowerCase().includes('flashcard.card_reviewed')
    ).length;

    const favoritesStudied = activitiesData.filter((a: any) =>
      String(a.type || '').toLowerCase().includes('flashcard.study_complete') && a.metadata?.isFavorite
    ).length;

    // Calculate study streak
    const studyDates = new Set<string>();
    activitiesData.forEach((a: any) => {
      const type = String(a.type || '').toLowerCase();
      if (type.includes('flashcard.study_complete') || type.includes('summary.read') || type.includes('practice_test.submit')) {
        const date = new Date(a.createdAt || a.timestamp || a.date);
        if (!isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          studyDates.add(date.toISOString());
        }
      }
    });

    let studyStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const key = checkDate.toISOString();

      if (studyDates.has(key)) {
        studyStreak++;
      } else {
        if (i === 0) continue;
        break;
      }
    }

    const totalCards = flashcardsData.reduce((sum: number, f: any) => sum + (Array.isArray(f.cards) ? f.cards.length : 0), 0);

    // Build achievements array (same as achievements page)
    const achievements = [
      { id: 1, title: 'First Steps', description: 'Created your first flashcard set', icon: '🎯', earned: totalFlashcards >= 1 },
      { id: 2, title: 'Study Streak', description: 'Studied for 7 days in a row', icon: '🔥', earned: studyStreak >= 7, progress: studyStreak, total: 7 },
      { id: 3, title: 'Knowledge Master', description: 'Created 10 flashcard sets', icon: '🏆', progress: totalFlashcards, total: 10, earned: totalFlashcards >= 10 },
      { id: 4, title: 'Perfect Score', description: 'Got 100% on a practice test', icon: '⭐', progress: practiceTestsCompleted, total: 1, earned: practiceTestsCompleted >= 1 },
      { id: 5, title: 'Deck Finisher', description: 'Complete 5 study sessions', icon: '🏁', progress: studySessionsCompleted, total: 5, earned: studySessionsCompleted >= 5 },
      { id: 6, title: 'Streak Holder', description: 'Keep a study streak for 14 days', icon: '📅', progress: studyStreak, total: 14, earned: studyStreak >= 14 },
      { id: 7, title: 'Flashcard Novice', description: 'Create 3 flashcard sets', icon: '📚', progress: totalFlashcards, total: 3, earned: totalFlashcards >= 3 },
      { id: 8, title: 'Flashcard Collector', description: 'Create 25 flashcard sets', icon: '🧩', progress: totalFlashcards, total: 25, earned: totalFlashcards >= 25 },
      { id: 9, title: 'Summary Starter', description: 'Read your first summary', icon: '✍️', progress: summarySessionsCompleted, total: 1, earned: summarySessionsCompleted >= 1 },
      { id: 10, title: 'Summary Scholar', description: 'Read 5 summaries', icon: '📖', progress: summarySessionsCompleted, total: 5, earned: summarySessionsCompleted >= 5 },
      { id: 11, title: 'Review Apprentice', description: 'Review 50 cards', icon: '🔁', progress: cardsReviewed, total: 50, earned: cardsReviewed >= 50 },
      { id: 12, title: 'Review Pro', description: 'Review 200 cards', icon: '⚡', progress: cardsReviewed, total: 200, earned: cardsReviewed >= 200 },
      { id: 13, title: 'Marathoner', description: 'Study streak of 30 days', icon: '🏃‍♀️', progress: studyStreak, total: 30, earned: studyStreak >= 30 },
      { id: 14, title: 'Active Week', description: 'Study 7 times in the last 7 days', icon: '📆', progress: 0, total: 7, earned: false },
      { id: 15, title: 'Session Master', description: 'Complete 10 study sessions', icon: '🎓', progress: studySessionsCompleted, total: 10, earned: studySessionsCompleted >= 10 },
      { id: 16, title: 'Card Collector', description: 'Add 100 cards total', icon: '🃏', progress: totalCards, total: 100, earned: totalCards >= 100 },
      { id: 17, title: 'Card Hoarder', description: 'Add 500 cards total', icon: '📦', progress: totalCards, total: 500, earned: totalCards >= 500 },
      { id: 18, title: 'Favorites Fan', description: 'Study favorites 3 times', icon: '⭐', progress: favoritesStudied, total: 3, earned: favoritesStudied >= 3 },
      { id: 19, title: 'Centurion', description: 'Create 100 flashcard sets', icon: '💯', progress: totalFlashcards, total: 100, earned: totalFlashcards >= 100 },
      { id: 20, title: 'Study Champion', description: 'Complete 50 study sessions', icon: '🏅', progress: studySessionsCompleted, total: 50, earned: studySessionsCompleted >= 50 }
    ];

    console.log('🔍 AchievementMonitor: Checking achievements globally', {
      totalFlashcards,
      studySessionsCompleted,
      summarySessionsCompleted,
      practiceTestsCompleted,
      studyStreak,
      unlockedCount: achievements.filter((a: any) => a.earned).length,
      unlockedAchievements: achievements.filter((a: any) => a.earned).map((a: any) => ({ id: a.id, title: a.title, icon: a.icon }))
    });

    // Check for newly unlocked achievements
    checkForNewAchievements(achievements);
  }, [
    flashcardsQuery.data,
    summariesQuery.data,
    historyQuery.data,
    user?._id,
    checkForNewAchievements,
  ]);

  // This component doesn't render anything - it just monitors in the background
  return null;
}
