"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState({
    notifications: true,
    studyReminders: true,
    emailUpdates: false,
    autoGenerateFlashcards: true
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Customize your NoteWise experience.
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-4 sm:space-y-6">
          {/* Appearance Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Appearance
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                  className="w-full sm:max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </div>

          {/* General Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Notifications
            </h2>
            
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Notifications
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Receive notifications about your study progress
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('notifications')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    settings.notifications ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Study Reminders
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Get reminded to study your flashcards
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('studyReminders')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    settings.studyReminders ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.studyReminders ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* AI Features */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              AI Features
            </h2>
            
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Auto-Generate Flashcards
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Automatically create flashcards from uploaded notes
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('autoGenerateFlashcards')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    settings.autoGenerateFlashcards ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoGenerateFlashcards ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Communication */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Communication
            </h2>
            
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Email Updates
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Receive weekly progress reports via email
                  </p>
                </div>
                <button
                  onClick={() => handleToggle('emailUpdates')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                    settings.emailUpdates ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.emailUpdates ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Account
            </h2>
            
            <div className="space-y-3 sm:space-y-4">
              <button className="w-full text-left p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      Export Data
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Download all your flashcards and study data
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-500 transition-colors flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </button>

              <button className="w-full text-left p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-900 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                      Delete Account
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-red-400 group-hover:text-red-500 transition-colors flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-end">
          <button className="w-full sm:w-auto bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors font-medium">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}