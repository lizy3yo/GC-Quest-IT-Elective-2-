"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Notification {
  id: string;
  type: 'streak' | 'achievement' | 'reminder' | 'tip' | 'update';
  badge?: string;
  title: string;
  message: string;
  emoji?: string;
  actionText?: string;
  actionUrl?: string;
  priority?: number; // Higher priority shows first
  expiresAt?: Date;
}

interface NotificationContextType {
  currentNotification: Notification | null;
  dismissNotification: () => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);

  // Fetch notifications from API or generate them
  const fetchNotifications = async () => {
    try {
      // Try to fetch from API first
      const token = localStorage.getItem('accessToken');
      if (token) {
        const response = await fetch('/api/v1/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.notifications && data.notifications.length > 0) {
            setNotifications(data.notifications);
            return;
          }
        }
      }
    } catch {
      console.log('Using fallback notifications');
    }

    // Fallback to generated notifications
    const generatedNotifications = await generateNotifications();
    setNotifications(generatedNotifications);
  };

  // Generate dynamic notifications based on user activity
  const generateNotifications = async (): Promise<Notification[]> => {
    const now = new Date();
    const notifs: Notification[] = [];

    // Check for study streak
    const lastStudyDate = localStorage.getItem('lastStudyDate');
    if (lastStudyDate) {
      const daysSinceStudy = Math.floor((now.getTime() - new Date(lastStudyDate).getTime()) / (1000 * 60 * 60 * 24));
      const streakCount = parseInt(localStorage.getItem('studyStreak') || '0');
      
      if (streakCount >= 30) {
        const messages = [
          `Incredible! ${streakCount} days of dedication. Did you know? It takes 66 days on average to form a habit!`,
          `${streakCount}-day streak! Fun fact: Your brain has created new neural pathways from this consistency!`,
          `Wow! ${streakCount} consecutive days! Studies show consistent learners retain 80% more information.`,
        ];
        notifs.push({
          id: 'streak-30',
          type: 'streak',
          badge: 'Legend',
          title: `${streakCount}-Day Streak! 🏆`,
          message: messages[Math.floor(Math.random() * messages.length)],
          emoji: '🏆',
          actionText: "Keep Going!",
          actionUrl: '/student_page/study_mode',
          priority: 10,
        });
      } else if (streakCount >= 14) {
        const messages = [
          `Two weeks strong! Fun fact: Your brain is 20% more efficient at recalling information now!`,
          `${streakCount} days! Did you know? Spaced repetition increases retention by up to 200%!`,
          `Amazing progress! Studies show 14-day learners are 3x more likely to reach their goals.`,
        ];
        notifs.push({
          id: 'streak-14',
          type: 'streak',
          badge: 'Hot',
          title: `${streakCount}-Day Streak! 🔥`,
          message: messages[Math.floor(Math.random() * messages.length)],
          emoji: '🔥',
          actionText: "Let's Go!",
          actionUrl: '/student_page/study_mode',
          priority: 10,
        });
      } else if (streakCount >= 7) {
        const messages = [
          `One week strong! Fun fact: Your brain forms new neural connections after just 7 days of practice!`,
          `7 days in a row! Did you know? Consistent study improves memory retention by 40%!`,
          `A full week! Studies show weekly learners are twice as likely to master new skills.`,
          `Seven days! Your hippocampus (memory center) is getting stronger every day!`,
        ];
        notifs.push({
          id: 'streak-7',
          type: 'streak',
          badge: 'New',
          title: `${streakCount}-Day Study Streak! 🔥`,
          message: messages[Math.floor(Math.random() * messages.length)],
          emoji: '🔥',
          actionText: "Let's Go!",
          actionUrl: '/student_page/study_mode',
          priority: 10,
        });
      } else if (streakCount >= 3) {
        const messages = [
          `${streakCount} days! You're building momentum. Fun fact: It takes 3 days to start forming a habit!`,
          `Three days strong! Your brain is already adapting to this new routine!`,
          `${streakCount}-day streak! Keep going - you're on the path to mastery!`,
        ];
        notifs.push({
          id: 'streak-3',
          type: 'streak',
          badge: 'Hot',
          title: `${streakCount}-Day Streak! 🌟`,
          message: messages[Math.floor(Math.random() * messages.length)],
          emoji: '🌟',
          actionText: 'Continue',
          actionUrl: '/student_page/study_mode',
          priority: 8,
        });
      } else if (daysSinceStudy > 1) {
        const messages = [
          "Welcome back! Fun fact: Even short study sessions help maintain neural pathways!",
          "We missed you! Did you know? Returning to study after a break can boost creativity!",
          "Ready to continue? Your brain consolidates memories during rest - now let's build on them!",
          "Back for more? Studies show that comeback sessions often lead to breakthrough moments!",
        ];
        notifs.push({
          id: 'comeback',
          type: 'reminder',
          badge: 'Reminder',
          title: 'Welcome Back! 👋',
          message: messages[Math.floor(Math.random() * messages.length)],
          emoji: '👋',
          actionText: 'Start Studying',
          actionUrl: '/student_page/study_mode',
          priority: 9,
        });
      }
    }

    // Check for pending practice tests with motivational messages
    const pendingTests = parseInt(localStorage.getItem('pendingTests') || '0');
    if (pendingTests > 0) {
      const messages = [
        `Complete your practice tests! Fun fact: Testing yourself is one of the most effective study methods!`,
        `${pendingTests} test${pendingTests > 1 ? 's' : ''} waiting. Did you know? Practice tests can improve exam scores by 30%!`,
        `Ready to test your knowledge? Studies show practice tests reduce exam anxiety by 40%!`,
        `Time to practice! Fun fact: Testing helps identify weak spots 3x faster than reviewing notes!`,
      ];
      notifs.push({
        id: 'pending-tests',
        type: 'reminder',
        badge: 'Action',
        title: `${pendingTests} Practice Test${pendingTests > 1 ? 's' : ''} Waiting 📝`,
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '📝',
        actionText: 'Take Test',
        actionUrl: '/student_page/practice_tests',
        priority: 7,
      });
    }

    // Study tips rotation with fun facts
    const studyTips = [
      {
        id: 'tip-spaced',
        title: 'Study Tip: Spaced Repetition 🧠',
        message: 'Review flashcards at increasing intervals. Fun fact: This technique can improve retention by up to 200%!',
        actionText: 'Try It',
      },
      {
        id: 'tip-active',
        title: 'Study Tip: Active Recall 💡',
        message: 'Test yourself instead of re-reading. Did you know? Active recall is 50% more effective than passive review!',
        actionText: 'Start Quiz',
      },
      {
        id: 'tip-breaks',
        title: 'Study Tip: Take Breaks ☕',
        message: 'Use the Pomodoro technique: 25 min study, 5 min break. Your brain needs rest to consolidate information!',
        actionText: 'Got It',
      },
      {
        id: 'tip-sleep',
        title: 'Study Tip: Sleep Well 😴',
        message: 'Your brain consolidates memories during sleep. Fun fact: Students who sleep 7-9 hours score 10% higher!',
        actionText: 'Noted',
      },
      {
        id: 'tip-interleaving',
        title: 'Study Tip: Mix It Up 🔀',
        message: 'Study different subjects in one session. Interleaving improves problem-solving by 43%!',
        actionText: 'Try It',
      },
      {
        id: 'tip-teaching',
        title: 'Study Tip: Teach Others 👥',
        message: 'Explain concepts to someone else. Fun fact: Teaching increases your own retention by 90%!',
        actionText: 'Share',
      },
      {
        id: 'tip-handwriting',
        title: 'Study Tip: Write by Hand ✍️',
        message: 'Handwritten notes boost memory. Did you know? Writing activates more brain regions than typing!',
        actionText: 'Got It',
      },
      {
        id: 'tip-exercise',
        title: 'Study Tip: Move Your Body 🏃',
        message: 'Exercise before studying! Just 20 minutes of cardio can boost memory and focus for 2 hours.',
        actionText: 'Nice',
      },
      {
        id: 'tip-water',
        title: 'Study Tip: Stay Hydrated 💧',
        message: 'Drink water while studying. Fun fact: Even mild dehydration can reduce cognitive performance by 10%!',
        actionText: 'Will Do',
      },
      {
        id: 'tip-music',
        title: 'Study Tip: Background Music 🎵',
        message: 'Classical or lo-fi music can help! Studies show it reduces stress and improves concentration.',
        actionText: 'Listen',
      },
      {
        id: 'tip-morning',
        title: 'Study Tip: Morning Power 🌅',
        message: 'Your brain is most alert 2-3 hours after waking. Morning study sessions are 15% more effective!',
        actionText: 'Noted',
      },
      {
        id: 'tip-chunking',
        title: 'Study Tip: Chunk Information 📦',
        message: 'Break content into smaller chunks. Fun fact: Your brain can hold 7±2 items in short-term memory!',
        actionText: 'Try It',
      },
      {
        id: 'tip-mnemonics',
        title: 'Study Tip: Use Mnemonics 🎯',
        message: 'Create memory tricks! Did you know? Mnemonics can improve recall by up to 77%!',
        actionText: 'Create One',
      },
      {
        id: 'tip-environment',
        title: 'Study Tip: Change Locations 🏠',
        message: 'Study in different places. Your brain associates information with environments, boosting recall!',
        actionText: 'Got It',
      },
      {
        id: 'tip-questions',
        title: 'Study Tip: Ask Questions ❓',
        message: 'Turn headings into questions. Fun fact: Question-based learning increases retention by 34%!',
        actionText: 'Try It',
      },
    ];

    const randomTip = studyTips[Math.floor(Math.random() * studyTips.length)];
    notifs.push({
      id: randomTip.id,
      type: 'tip',
      badge: 'Tip',
      title: randomTip.title,
      message: randomTip.message,
      actionText: randomTip.actionText,
      priority: 3,
    });

    // Achievement notifications with fun facts
    const totalFlashcards = parseInt(localStorage.getItem('totalFlashcardsStudied') || '0');
    
    if (totalFlashcards >= 1000) {
      const messages = [
        `1,000+ flashcards! Fun fact: You've engaged your brain over 10,000 times. That's neural network gold!`,
        `Incredible! 1,000+ cards studied. Did you know? You're in the top 1% of dedicated learners!`,
        `1,000 flashcards! Your brain has created thousands of new synaptic connections. You're literally smarter!`,
      ];
      notifs.push({
        id: 'achievement-1000',
        type: 'achievement',
        badge: 'Master',
        title: '1,000 Flashcards! 🏆',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🏆',
        actionText: 'View Stats',
        actionUrl: '/student_page/achievements',
        priority: 10,
      });
    } else if (totalFlashcards >= 500 && totalFlashcards < 550) {
      const messages = [
        `500 flashcards! Fun fact: You've spent approximately 25 hours actively learning. That's dedication!`,
        `Half a thousand! Did you know? Flashcard users retain 80% more information than traditional note-takers!`,
        `500 cards mastered! Studies show you're building long-term memory that lasts years, not weeks!`,
      ];
      notifs.push({
        id: 'achievement-500',
        type: 'achievement',
        badge: 'Expert',
        title: '500 Flashcards Mastered! 🌟',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🌟',
        actionText: 'View Stats',
        actionUrl: '/student_page/achievements',
        priority: 9,
      });
    } else if (totalFlashcards >= 250 && totalFlashcards < 260) {
      const messages = [
        `250 flashcards! Fun fact: You've activated your hippocampus over 2,500 times. Memory champion in the making!`,
        `Quarter of a thousand! Did you know? You're building expertise that compounds over time!`,
        `250 cards! Your brain's retrieval speed has increased by an estimated 30%. You're getting faster!`,
      ];
      notifs.push({
        id: 'achievement-250',
        type: 'achievement',
        badge: 'Rising Star',
        title: '250 Flashcards! ⭐',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '⭐',
        actionText: 'View Stats',
        actionUrl: '/student_page/achievements',
        priority: 9,
      });
    } else if (totalFlashcards >= 100 && totalFlashcards < 110) {
      const messages = [
        `100 flashcards! Fun fact: You've made over 1,000 neural connections. Your brain is physically changing!`,
        `Century club! Did you know? 100 flashcards is the tipping point where learning becomes exponential!`,
        `100 cards mastered! Studies show you're now 3x more likely to retain this information long-term!`,
        `First hundred! Fun fact: Your brain's pattern recognition has improved by approximately 25%!`,
      ];
      notifs.push({
        id: 'achievement-100',
        type: 'achievement',
        badge: 'Achievement',
        title: '100 Flashcards Mastered! 🎉',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🎉',
        actionText: 'View Stats',
        actionUrl: '/student_page/achievements',
        priority: 9,
      });
    } else if (totalFlashcards >= 50 && totalFlashcards < 55) {
      const messages = [
        `50 flashcards! Fun fact: You've already built the foundation for long-term memory success!`,
        `Halfway to 100! Did you know? Consistent flashcard use can double your exam scores!`,
        `50 cards! Your brain is forming new pathways. Keep going - the best is yet to come!`,
      ];
      notifs.push({
        id: 'achievement-50',
        type: 'achievement',
        badge: 'Milestone',
        title: '50 Flashcards! 🎯',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🎯',
        actionText: 'View Stats',
        actionUrl: '/student_page/achievements',
        priority: 8,
      });
    }

    // Check for pending study room invites
    try {
      const response = await fetch('/api/student_page/study-rooms/invites');
      if (response.ok) {
        const data = await response.json();
        if (data.invites && data.invites.length > 0) {
          const invite = data.invites[0]; // Show the most recent invite
          notifs.push({
            id: `invite-${invite.roomId}`,
            type: 'update',
            badge: 'Invite',
            title: `Study Room Invite! 📨`,
            message: `${invite.invitedBy.firstName} ${invite.invitedBy.lastName} invited you to join "${invite.roomName}"`,
            emoji: '📨',
            actionText: 'View Invites',
            actionUrl: '/student_page/study_rooms',
            priority: 9,
          });
        }
      }
    } catch (error) {
      console.log('Could not check invites');
    }

    // New feature announcements with fun facts
    const hasSeenFeature = localStorage.getItem('seenFeature_studyRooms');
    if (!hasSeenFeature) {
      const messages = [
        'Collaborate with classmates in real-time! Fun fact: Group study can improve retention by 60%!',
        'Join study rooms now! Did you know? Peer learning helps you understand concepts 2x faster!',
        'Study together, succeed together! Studies show collaborative learning boosts motivation by 75%!',
      ];
      notifs.push({
        id: 'feature-study-rooms',
        type: 'update',
        badge: 'New Feature',
        title: 'Study Rooms Are Here! 🚀',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🚀',
        actionText: 'Explore',
        actionUrl: '/student_page/study_rooms',
        priority: 6,
      });
    }
    
    // Additional motivational messages based on time of day
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Morning motivation (6 AM - 11 AM)
    if (hour >= 6 && hour < 11 && Math.random() < 0.3) {
      const messages = [
        'Good morning! Fun fact: Your brain is 15% more alert in the morning. Perfect time to study!',
        'Rise and shine! Did you know? Morning learners retain 20% more information than evening studiers!',
        'Morning brain power! Studies show problem-solving skills peak 2-3 hours after waking up!',
      ];
      notifs.push({
        id: 'morning-motivation',
        type: 'tip',
        badge: 'Morning',
        title: 'Perfect Time to Study! 🌅',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🌅',
        actionText: 'Start Now',
        actionUrl: '/student_page/study_mode',
        priority: 5,
      });
    }
    
    // Weekend motivation
    if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.3) {
      const messages = [
        'Weekend study session! Fun fact: 30 minutes of weekend review prevents 80% of Monday forgetting!',
        'Happy weekend! Did you know? Weekend learners are 40% more likely to ace their exams!',
        'Weekend warrior! Studies show consistent weekend study builds unstoppable momentum!',
      ];
      notifs.push({
        id: 'weekend-motivation',
        type: 'tip',
        badge: 'Weekend',
        title: 'Weekend Study Power! 🎯',
        message: messages[Math.floor(Math.random() * messages.length)],
        emoji: '🎯',
        actionText: 'Study Now',
        actionUrl: '/student_page/study_mode',
        priority: 5,
      });
    }

    // Sort by priority (highest first)
    return notifs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  };

  // Select the highest priority notification
  useEffect(() => {
    fetchNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notifications.length > 0) {
      // Check if user has dismissed a notification this session
      const hasDismissedThisSession = sessionStorage.getItem('hasDismissedNotification');
      
      if (hasDismissedThisSession === 'true') {
        // User already dismissed a notification this session, don't show another
        setCurrentNotification(null);
        return;
      }

      // Filter out expired notifications
      const validNotifications = notifications.filter(n => {
        if (!n.expiresAt) return true;
        return new Date(n.expiresAt) > new Date();
      });

      // Get dismissed notifications from localStorage
      const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
      const activeNotifications = validNotifications.filter(n => !dismissed.includes(n.id));

      if (activeNotifications.length > 0) {
        setCurrentNotification(activeNotifications[0]);
        // Don't mark as seen yet - only mark when user dismisses it
      } else {
        setCurrentNotification(null);
      }
    }
  }, [notifications]);

  const dismissNotification = () => {
    if (currentNotification) {
      // Save dismissed notification ID
      const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]');
      dismissed.push(currentNotification.id);
      localStorage.setItem('dismissedNotifications', JSON.stringify(dismissed));

      // Mark feature as seen if it's a feature notification
      if (currentNotification.type === 'update') {
        localStorage.setItem(`seenFeature_${currentNotification.id.replace('feature-', '')}`, 'true');
      }

      // Hide notification (don't show another one this session)
      setCurrentNotification(null);
      
      // Mark that user has dismissed their notification for this session
      sessionStorage.setItem('hasDismissedNotification', 'true');
    }
  };

  const refreshNotifications = () => {
    fetchNotifications();
  };

  return (
    <NotificationContext.Provider value={{ currentNotification, dismissNotification, refreshNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
