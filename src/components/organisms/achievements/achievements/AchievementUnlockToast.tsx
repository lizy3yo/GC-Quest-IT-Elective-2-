'use client';

import { useEffect, useState } from 'react';

interface AchievementUnlockToastProps {
  achievement: {
    title: string;
    description: string;
    icon: string;
  } | null;
  onClose: () => void;
}

export default function AchievementUnlockToast({ achievement, onClose }: AchievementUnlockToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Debug: Log component mount
  useEffect(() => {
    console.log('🎨 AchievementUnlockToast component MOUNTED');
    return () => console.log('🎨 AchievementUnlockToast component UNMOUNTED');
  }, []);

  useEffect(() => {
    console.log('🎨 Toast component received achievement:', achievement);
    
    if (achievement) {
      console.log('✨ Achievement data:', {
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon
      });
      // Play achievement unlock sound
      try {
        // Create a simple celebratory sound using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create a pleasant "ding" sound
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        // Silently fail if audio doesn't work
        console.log('Could not play achievement sound');
      }
      
      // Trigger entrance animation
      setTimeout(() => {
        console.log('🎬 Starting entrance animation');
        setIsVisible(true);
      }, 50);

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        console.log('⏰ Auto-hiding after 5 seconds');
        handleClose();
      }, 5000);

      return () => {
        console.log('🧹 Cleaning up toast timer');
        clearTimeout(timer);
      };
    } else {
      console.log('⚠️ Toast: No achievement to display');
    }
  }, [achievement]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      onClose();
    }, 300); // Match exit animation duration
  };

  if (!achievement) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-out ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-full opacity-0 scale-95'
      }`}
      style={{ maxWidth: '400px' }}
    >
      <div className="bg-gradient-to-br from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 rounded-2xl shadow-2xl p-6 border-2 border-teal-400 dark:border-teal-500 relative overflow-hidden">
        {/* Animated background sparkles */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-2 left-2 w-2 h-2 bg-white rounded-full animate-ping"></div>
          <div className="absolute top-4 right-8 w-1 h-1 bg-white rounded-full animate-pulse"></div>
          <div className="absolute bottom-3 left-8 w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
          <div className="absolute bottom-6 right-4 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center text-white"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="relative flex items-start gap-4">
          {/* Icon with animation */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl animate-bounce">
              <span role="img" aria-label={achievement.title}>
                {achievement.icon}
              </span>
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 pt-1">
            <div className="text-xs font-bold text-teal-100 uppercase tracking-wider mb-1">
              🎉 Achievement Unlocked!
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              {achievement.title}
            </h3>
            <p className="text-sm text-teal-50">
              {achievement.description}
            </p>
          </div>
        </div>

        {/* Progress bar animation */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div 
            className="h-full bg-white/60 animate-shrink-width"
            style={{ 
              animation: 'shrinkWidth 5s linear forwards'
            }}
          ></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
