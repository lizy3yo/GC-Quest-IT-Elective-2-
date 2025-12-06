"use client";

import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme, mounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`${className}`}>
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  const themes = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' }
  ] as const;

  const currentTheme = themes.find(t => t.value === theme) || themes[2];

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
        aria-label="Toggle theme"
      >
        <span className="text-lg">{currentTheme.icon}</span>
        {showLabel && <span className="text-sm font-medium">{currentTheme.label}</span>}
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-20 backdrop-blur-sm">
            {themes.map((themeOption) => (
              <button
                key={themeOption.value}
                onClick={() => {
                  setTheme(themeOption.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  theme === themeOption.value 
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-lg">{themeOption.icon}</span>
                <span className="text-sm font-medium">{themeOption.label}</span>
                {theme === themeOption.value && (
                  <svg className="w-4 h-4 ml-auto text-teal-600 dark:text-teal-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}