'use client';

import { useEffect } from 'react';
import { useAchievements } from '@/contexts/AchievementContext';


/**
 * Hook to track achievement unlocks by listening to activity events
 * Call this hook on pages where user actions happen (flashcards, summaries, practice tests)
 */
export function useAchievementTracking() {
  const { showAchievement } = useAchievements();

  useEffect(() => {
    // Listen for custom achievement unlock events
    const handleAchievementUnlock = (event: Event) => {
      const customEvent = event as CustomEvent<{ achievement: { title: string; description: string; icon: string } }>;
      const { achievement } = customEvent.detail;
      if (achievement) {
        showAchievement(achievement);
      }
    };

    window.addEventListener('achievement:unlock', handleAchievementUnlock);

    return () => {
      window.removeEventListener('achievement:unlock', handleAchievementUnlock);
    };
  }, [showAchievement]);
}

/**
 * Helper function to trigger achievement unlock event
 * Call this when an action completes (e.g., after creating flashcard, completing study session)
 */
export function triggerAchievementCheck(achievementData?: {
  title: string;
  description: string;
  icon: string;
}) {
  // If specific achievement data is provided, dispatch unlock event
  if (achievementData) {
    const event = new CustomEvent('achievement:unlock', {
      detail: { achievement: achievementData }
    });
    window.dispatchEvent(event);
  }
  
  // Always trigger a global check
  const checkEvent = new Event('checkAchievements');
  window.dispatchEvent(checkEvent);
  console.log('🚀 Achievement check triggered!');
}

/**
 * Helper functions to trigger achievement checks after specific activities
 * These dispatch events that the AchievementProvider listens to
 */
export function notifyFlashcardComplete() {
  console.log('📚 Flashcard session completed, triggering achievement check');
  window.dispatchEvent(new Event('flashcard:complete'));
  window.dispatchEvent(new Event('checkAchievements'));
}

export function notifySummaryComplete() {
  console.log('📖 Summary session completed, triggering achievement check');
  window.dispatchEvent(new Event('summary:complete'));
  window.dispatchEvent(new Event('checkAchievements'));
}

export function notifyTestComplete() {
  console.log('✅ Test completed, triggering achievement check');
  window.dispatchEvent(new Event('test:complete'));
  window.dispatchEvent(new Event('checkAchievements'));
}

export function notifyFlashcardCreated() {
  console.log('🎯 Flashcard created, triggering achievement check');
  window.dispatchEvent(new Event('checkAchievements'));
}
