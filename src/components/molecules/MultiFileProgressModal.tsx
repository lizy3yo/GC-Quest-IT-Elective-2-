"use client";

import { useEffect, useState, useRef } from "react";

export interface MultiFileProgressState {
  isOpen: boolean;
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  successCount: number;
  failedCount: number;
  startTime: number;
}

interface MultiFileProgressModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  subtitle?: string;
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  successCount: number;
  failedCount: number;
  startTime: number;
  showCloseButton?: boolean;
}

export default function MultiFileProgressModal({
  isOpen,
  onClose,
  title,
  subtitle = "Processing your files with AI...",
  currentFileIndex,
  totalFiles,
  currentFileName,
  successCount,
  failedCount,
  startTime,
  showCloseButton = true,
}: MultiFileProgressModalProps) {
  const [elapsedTime, setElapsedTime] = useState("0:00");
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update elapsed time every second
  useEffect(() => {
    if (!isOpen || !startTime) return;

    const updateTime = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setElapsedTime(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isOpen, startTime]);

  // Simulate gradual progress when processing (for single-item operations like AI generation)
  useEffect(() => {
    if (!isOpen) {
      setSimulatedProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    // Reset progress when modal opens
    setSimulatedProgress(0);

    // Simulate progress: fast at start, slower as it approaches 90%
    // This gives the illusion of work being done while waiting for the API
    progressIntervalRef.current = setInterval(() => {
      setSimulatedProgress((prev) => {
        if (prev >= 90) {
          // Slow down significantly after 90%
          return Math.min(prev + 0.1, 95);
        } else if (prev >= 70) {
          // Slow down after 70%
          return prev + 0.3;
        } else if (prev >= 50) {
          // Medium speed 50-70%
          return prev + 0.5;
        } else {
          // Fast progress 0-50%
          return prev + 1;
        }
      });
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Progress is based on completed files (success + failed), not current file being processed
  const completedFiles = successCount + failedCount;
  const actualProgress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
  
  // Use simulated progress for single-item operations, actual progress for multi-file
  const progressPercent = totalFiles <= 1 ? Math.round(simulatedProgress) : actualProgress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] p-4 flex items-center gap-3">
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeDasharray={`${progressPercent} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {progressPercent}%
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold">{title}</h3>
            <p className="text-white/80 text-sm">{subtitle}</p>
          </div>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Progress Content */}
        <div className="p-4 space-y-4">
          {/* File Progress */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              File {currentFileIndex + 1} of {totalFiles}
            </span>
            <span className="text-[#2E7D32] font-medium">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-[#2E7D32] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Current File */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Currently processing:
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {currentFileName}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalFiles}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {successCount}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">Success</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {failedCount}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
            </div>
          </div>

          {/* Elapsed Time */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Elapsed time: {elapsedTime}</span>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
            <svg
              className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Please don&apos;t close this page. Generation is in progress...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
