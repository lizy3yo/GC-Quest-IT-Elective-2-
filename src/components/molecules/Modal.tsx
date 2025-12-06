"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  // Optional custom footer. If provided, it will replace the default Close button footer.
  footer?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-4xl", footer }: ModalProps) {
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={`relative w-full ${maxWidth} bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all`}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {children}
          </div>

          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
            {footer ? (
              footer
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}