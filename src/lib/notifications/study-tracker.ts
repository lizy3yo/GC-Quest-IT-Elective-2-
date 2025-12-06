/**
 * Study Activity Tracker
 * Tracks user study sessions and maintains streak data
 */

export interface StudySession {
  date: string;
  flashcardsStudied: number;
  testsCompleted: number;
  minutesStudied: number;
}

/**
 * Record a study session
 */
export function recordStudySession(flashcards: number = 0, tests: number = 0, minutes: number = 0) {
  const today = new Date().toISOString().split('T')[0];
  const lastStudyDate = localStorage.getItem('lastStudyDate');
  
  // Update last study date
  localStorage.setItem('lastStudyDate', today);
  
  // Update streak
  if (lastStudyDate) {
    const lastDate = new Date(lastStudyDate);
    const currentDate = new Date(today);
    const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day - increment streak
      const currentStreak = parseInt(localStorage.getItem('studyStreak') || '0');
      localStorage.setItem('studyStreak', (currentStreak + 1).toString());
    } else if (daysDiff > 1) {
      // Streak broken - reset to 1
      localStorage.setItem('studyStreak', '1');
    }
    // If daysDiff === 0, same day - don't change streak
  } else {
    // First time studying
    localStorage.setItem('studyStreak', '1');
  }
  
  // Update total flashcards studied
  const totalFlashcards = parseInt(localStorage.getItem('totalFlashcardsStudied') || '0');
  localStorage.setItem('totalFlashcardsStudied', (totalFlashcards + flashcards).toString());
  
  // Update total tests completed
  const totalTests = parseInt(localStorage.getItem('totalTestsCompleted') || '0');
  localStorage.setItem('totalTestsCompleted', (totalTests + tests).toString());
  
  // Update total study time
  const totalMinutes = parseInt(localStorage.getItem('totalStudyMinutes') || '0');
  localStorage.setItem('totalStudyMinutes', (totalMinutes + minutes).toString());
  
  // Store session data
  const sessions = getStudySessions();
  const existingSession = sessions.find(s => s.date === today);
  
  if (existingSession) {
    existingSession.flashcardsStudied += flashcards;
    existingSession.testsCompleted += tests;
    existingSession.minutesStudied += minutes;
  } else {
    sessions.push({
      date: today,
      flashcardsStudied: flashcards,
      testsCompleted: tests,
      minutesStudied: minutes,
    });
  }
  
  // Keep only last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSessions = sessions.filter(s => new Date(s.date) >= thirtyDaysAgo);
  
  localStorage.setItem('studySessions', JSON.stringify(recentSessions));
}

/**
 * Get all study sessions
 */
export function getStudySessions(): StudySession[] {
  const sessions = localStorage.getItem('studySessions');
  return sessions ? JSON.parse(sessions) : [];
}

/**
 * Get current study streak
 */
export function getStudyStreak(): number {
  return parseInt(localStorage.getItem('studyStreak') || '0');
}

/**
 * Get total flashcards studied
 */
export function getTotalFlashcardsStudied(): number {
  return parseInt(localStorage.getItem('totalFlashcardsStudied') || '0');
}

/**
 * Set pending tests count
 */
export function setPendingTests(count: number) {
  localStorage.setItem('pendingTests', count.toString());
}

/**
 * Get pending tests count
 */
export function getPendingTests(): number {
  return parseInt(localStorage.getItem('pendingTests') || '0');
}

/**
 * Clear dismissed notifications (useful for testing)
 */
export function clearDismissedNotifications() {
  localStorage.removeItem('dismissedNotifications');
}

/**
 * Reset session notification flag (useful for testing)
 */
export function resetSessionNotification() {
  sessionStorage.removeItem('hasDismissedNotification');
}

/**
 * Initialize study tracking (call on app load)
 */
export function initializeStudyTracking() {
  // Check if we need to reset streak due to inactivity
  const lastStudyDate = localStorage.getItem('lastStudyDate');
  if (lastStudyDate) {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = new Date(lastStudyDate);
    const currentDate = new Date(today);
    const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 1) {
      // Streak broken - reset to 0
      localStorage.setItem('studyStreak', '0');
    }
  }
}
