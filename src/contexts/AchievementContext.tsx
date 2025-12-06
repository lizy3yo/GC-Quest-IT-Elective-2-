'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AchievementUnlockToast from '@/components/organisms/achievements/achievements/AchievementUnlockToast';
import useAuth from '@/hooks/useAuth';

interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  earned?: boolean;
  progress?: number;
  total?: number;
}

interface AchievementContextType {
  checkForNewAchievements: (currentAchievements: Achievement[]) => void;
  showAchievement: (achievement: { title: string; description: string; icon: string }) => void;
  showAllUnlocked: (currentAchievements: Achievement[]) => void;
  resetTracking: () => void;
}

const AchievementContext = createContext<AchievementContextType | undefined>(undefined);

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [unlockedAchievement, setUnlockedAchievement] = useState<{
    title: string;
    description: string;
    icon: string;
  } | null>(null);
  const [previouslyUnlockedIds, setPreviouslyUnlockedIds] = useState<Set<number>>(new Set());
  const { user } = useAuth();

  console.log('🌍 AchievementProvider rendering, current unlocked achievement:', unlockedAchievement);

  // Load previously unlocked achievement IDs from localStorage on mount
  useEffect(() => {
    console.log('🌍 AchievementProvider MOUNTED');
    try {
      const unlockedRaw = typeof window !== 'undefined' ? localStorage.getItem('unlocked_achievements') : null;
      if (unlockedRaw) {
        const ids = JSON.parse(unlockedRaw);
        setPreviouslyUnlockedIds(new Set(ids));
      }
    } catch (e) {
      console.error('Failed to load unlocked achievements:', e);
    }
  }, []);

  // Function to compute achievements from user data
  const computeAchievements = useCallback(async (userId: string): Promise<Achievement[]> => {
    try {
      const userIdEncoded = encodeURIComponent(userId);
      
      // Fetch all necessary data
      const [flashcardsRes, summariesRes, activitiesRes] = await Promise.allSettled([
        fetch(`/api/student_page/flashcard?userId=${userIdEncoded}`, { credentials: 'include' }),
        fetch(`/api/student_page/summary?userId=${userIdEncoded}`, { credentials: 'include' }),
        fetch(`/api/student_page/history?userId=${userIdEncoded}&limit=200`, { credentials: 'include' })
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let flashcards: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activities: any[] = [];

      if (flashcardsRes.status === 'fulfilled' && flashcardsRes.value.ok) {
        const data = await flashcardsRes.value.json().catch(() => null);
        flashcards = Array.isArray(data?.flashcards) ? data.flashcards : [];
      }

      if (summariesRes.status === 'fulfilled' && summariesRes.value.ok) {
        // Summaries fetched but not used in current achievement calculations
        // Kept for future achievement types
      }

      if (activitiesRes.status === 'fulfilled' && activitiesRes.value.ok) {
        const data = await activitiesRes.value.json().catch(() => null);
        activities = Array.isArray(data?.activities) ? data.activities : [];
      }

      // Compute metrics
      const totalFlashcards = flashcards.length;

      // Cards reviewed
      const cardsReviewed = flashcards.reduce((s, fc) => s + (Number(fc.repetitionCount) || 0), 0);

      // Study sessions completed
      const studySessionsCompleted = activities.filter(a => {
        const t = (a.type || a.action || '')?.toString().toLowerCase();
        return t.includes('flashcard.study_complete');
      }).length;

      // Practice tests completed
      const practiceTestsCompleted = activities.filter(a => {
        const t = (a.type || a.action || '')?.toString().toLowerCase();
        return t.includes('practice_test.submit') || t.includes('practice_test.completed') || t.includes('test.submit');
      }).length;

      // Summary sessions completed
      const summarySessionsCompleted = activities.filter(a => {
        const t = (a.type || a.action || '')?.toString().toLowerCase();
        return t.includes('summary.read') || t.includes('summary.session') || t.includes('summary.completed');
      }).length;

      // Favorites studied
      const favoritesStudied = activities.filter(a => {
        const t = (a.type || a.action || '')?.toString().toLowerCase();
        return t.includes('flashcard.study_complete') && !!a.meta?.studiedFavorites;
      }).length;

      // Compute study streak
      const studyDates = new Set<string>();
      activities.forEach(a => {
        const type = (a.type || '')?.toString().toLowerCase();
        if (type.includes('flashcard.study_complete') || 
            type.includes('summary.read') || 
            type.includes('practice_test.submit')) {
          const date = new Date(a.createdAt);
          date.setHours(0, 0, 0, 0);
          studyDates.add(date.toISOString());
        }
      });

      let studyStreak = 0;
      const now = new Date();
      const today = new Date(now);
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

      // Total cards
      const totalCards = flashcards.reduce((sum, f) => sum + (Array.isArray(f.cards) ? f.cards.length : 0), 0);

      // Build achievements array
      const achievements: Achievement[] = [
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

      return achievements;
    } catch (error) {
      console.error('Failed to compute achievements:', error);
      return [];
    }
  }, []);

  const checkForNewAchievements = useCallback((currentAchievements: Achievement[]) => {
    console.log('🔍 Checking for new achievements...', {
      totalAchievements: currentAchievements.length,
      previouslyUnlocked: Array.from(previouslyUnlockedIds),
      currentAchievements: currentAchievements.map(a => ({ id: a.id, title: a.title, earned: a.earned }))
    });
    
    const unlocked = currentAchievements.filter(a => a.earned);
    console.log('🎯 Currently unlocked achievements:', unlocked.map(a => ({ id: a.id, title: a.title })));
    
    const currentlyUnlockedIds = new Set(unlocked.map(a => a.id));
    
    // Find newly unlocked achievement (not in previous set but in current set)
    const newlyUnlocked = unlocked.find(a => !previouslyUnlockedIds.has(a.id));
    
    console.log('✨ Newly unlocked achievement:', newlyUnlocked ? newlyUnlocked.title : 'None');
    
    if (newlyUnlocked) {
      console.log('🎉 SHOWING ACHIEVEMENT TOAST:', newlyUnlocked.title);
      // Show toast for the newly unlocked achievement
      setUnlockedAchievement({
        title: newlyUnlocked.title,
        description: newlyUnlocked.description,
        icon: newlyUnlocked.icon
      });
      
      // Update localStorage with all unlocked IDs
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('unlocked_achievements', JSON.stringify(Array.from(currentlyUnlockedIds)));
          console.log('💾 Saved to localStorage:', Array.from(currentlyUnlockedIds));
        }
      } catch (e) {
        console.error('Failed to save unlocked achievements:', e);
      }
      
      // Update state
      setPreviouslyUnlockedIds(currentlyUnlockedIds);
    } else {
      console.log('ℹ️ No new achievements unlocked');
    }
  }, [previouslyUnlockedIds]);

  // Global achievement checking - runs periodically and on activity events
  useEffect(() => {
    if (!user || !user._id) return;

    const checkIntervalRef = { current: undefined as NodeJS.Timeout | undefined };
    let mounted = true;

    const performCheck = async () => {
      if (!mounted || !user._id) return;
      
      console.log('🔍 Global achievement check triggered');
      const achievements = await computeAchievements(user._id as string);
      
      if (mounted && achievements.length > 0) {
        checkForNewAchievements(achievements);
      }
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(performCheck, 2000);

    // Periodic check every 30 seconds
    checkIntervalRef.current = setInterval(performCheck, 30000);

    // Listen for custom events that trigger achievement checks
    const handleActivityComplete = () => {
      console.log('📢 Activity completed, checking achievements...');
      setTimeout(performCheck, 1000); // Small delay to ensure activity is saved
    };

    window.addEventListener('checkAchievements', handleActivityComplete);
    window.addEventListener('flashcard:complete', handleActivityComplete);
    window.addEventListener('summary:complete', handleActivityComplete);
    window.addEventListener('test:complete', handleActivityComplete);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      window.removeEventListener('checkAchievements', handleActivityComplete);
      window.removeEventListener('flashcard:complete', handleActivityComplete);
      window.removeEventListener('summary:complete', handleActivityComplete);
      window.removeEventListener('test:complete', handleActivityComplete);
    };
  }, [user, computeAchievements, checkForNewAchievements]);

  const showAchievement = (achievement: { title: string; description: string; icon: string }) => {
    setUnlockedAchievement(achievement);
  };

  const showAllUnlocked = (currentAchievements: Achievement[]) => {
    const unlocked = currentAchievements.filter(a => a.earned);
    console.log('🎊 Showing ALL unlocked achievements:', unlocked.length);
    
    if (unlocked.length === 0) {
      console.log('⚠️ No unlocked achievements to show');
      return;
    }
    
    // Show them one by one with a delay
    unlocked.forEach((achievement, index) => {
      setTimeout(() => {
        console.log(`📢 Showing achievement ${index + 1}/${unlocked.length}:`, achievement.title);
        setUnlockedAchievement({
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon
        });
      }, index * 6000); // 6 seconds between each (5s display + 1s gap)
    });
    
    // Update localStorage with all unlocked IDs
    const currentlyUnlockedIds = new Set(unlocked.map(a => a.id));
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('unlocked_achievements', JSON.stringify(Array.from(currentlyUnlockedIds)));
      }
    } catch (e) {
      console.error('Failed to save unlocked achievements:', e);
    }
    setPreviouslyUnlockedIds(currentlyUnlockedIds);
  };

  const resetTracking = () => {
    console.log('🔄 Resetting achievement tracking');
    setPreviouslyUnlockedIds(new Set());
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('unlocked_achievements');
      }
    } catch (e) {
      console.error('Failed to reset tracking:', e);
    }
  };

  return (
    <AchievementContext.Provider value={{ checkForNewAchievements, showAchievement, showAllUnlocked, resetTracking }}>
      {children}
      {/* Global achievement toast - appears on all pages */}
      <AchievementUnlockToast
        achievement={unlockedAchievement}
        onClose={() => setUnlockedAchievement(null)}
      />
    </AchievementContext.Provider>
  );
}

export function useAchievements() {
  const context = useContext(AchievementContext);
  if (context === undefined) {
    throw new Error('useAchievements must be used within an AchievementProvider');
  }
  return context;
}
