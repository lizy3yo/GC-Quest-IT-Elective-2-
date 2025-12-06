"use client";

import { useEffect } from "react";

interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string | null;
}

export default function LogoutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
}: LogoutConfirmationModalProps) {
  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Confirm Logout
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {userName
                  ? `Are you sure you want to log out, ${userName}?`
                  : "Are you sure you want to log out?"}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You will be redirected to the login page and will need to sign in
            again to access your account.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
