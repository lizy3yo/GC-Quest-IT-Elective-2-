"use client";

import React from "react";

export type QuestionType = 'identification' | 'mcq' | 'true-false' | 'paragraph';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  image?: string;
  color?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  image?: string;
  timeLimit?: number;
  points?: number;
  options?: QuestionOption[];
  correctAnswer?: string | string[];
  answer?: string; // Legacy field for identification questions
  explanation?: string;
}

interface KahootQuestionEditorProps {
  question: Question;
  questionNumber: number;
  onChange: (question: Question) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

const QUESTION_TYPES = [
  { type: 'identification', label: 'Identification', icon: '🔍', description: 'Type the answer' },
  { type: 'mcq', label: 'Multiple Choice', icon: '🎯', description: 'Choose from options' },
  { type: 'true-false', label: 'True or False', icon: '✓✗', description: 'Binary choice' },
  { type: 'paragraph', label: 'Essay', icon: '📝', description: 'Long form answer' },
];

const OPTION_COLORS = [
  { bg: 'bg-red-500', text: 'text-white', label: 'Red', icon: '▲' },
  { bg: 'bg-blue-500', text: 'text-white', label: 'Blue', icon: '◆' },
  { bg: 'bg-yellow-500', text: 'text-white', label: 'Yellow', icon: '●' },
  { bg: 'bg-green-500', text: 'text-white', label: 'Green', icon: '■' },
];

export default function KahootQuestionEditor({
  question,
  questionNumber,
  onChange,
  onDelete,
  onDuplicate,
}: KahootQuestionEditorProps) {
  // Debug: Log question data
  React.useEffect(() => {
    console.log('KahootQuestionEditor - Question data:', {
      id: question.id,
      type: question.type,
      title: question.title,
      hasOptions: !!question.options,
      optionsLength: question.options?.length,
      options: question.options,
      optionsIsArray: Array.isArray(question.options),
      fullQuestion: question
    });
  }, [question]);

  const updateQuestion = (updates: Partial<Question>) => {
    onChange({ ...question, ...updates });
  };

  const addOption = () => {
    const newOption: QuestionOption = {
      id: `opt_${Date.now()}`,
      text: '',
      isCorrect: false,
      color: OPTION_COLORS[question.options?.length || 0]?.label || 'Red',
    };
    updateQuestion({ options: [...(question.options || []), newOption] });
  };

  const updateOption = (optionId: string, updates: Partial<QuestionOption>) => {
    const updatedOptions = question.options?.map(opt =>
      opt.id === optionId ? { ...opt, ...updates } : opt
    );
    updateQuestion({ options: updatedOptions });
  };

  const removeOption = (optionId: string) => {
    const updatedOptions = question.options?.filter(opt => opt.id !== optionId);
    updateQuestion({ options: updatedOptions });
  };

  const initializeOptions = () => {
    const defaultOptions: QuestionOption[] = [
      { id: `opt_${Date.now()}_1`, text: '', isCorrect: false, color: 'Red' },
      { id: `opt_${Date.now()}_2`, text: '', isCorrect: false, color: 'Blue' },
    ];
    updateQuestion({ options: defaultOptions });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#2E7D32] dark:bg-[#2E7D32] rounded-lg flex items-center justify-center text-white font-semibold text-sm">
            {questionNumber}
          </div>
          <select
            value={question.type}
            onChange={(e) => updateQuestion({ type: e.target.value as QuestionType })}
            className="px-4 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
          >
            {QUESTION_TYPES.map((qt) => (
              <option key={qt.type} value={qt.type} className="text-slate-900 dark:text-white">
                {qt.icon} {qt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
            >
              Duplicate
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-medium transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Question Input */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <input
          type="text"
          value={question.title}
          onChange={(e) => updateQuestion({ title: e.target.value })}
          placeholder="Enter your question here..."
          className="w-full bg-transparent text-slate-900 dark:text-white text-xl font-semibold placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Correct Answer Input (for identification type) */}
      {question.type === 'identification' && (
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Correct Answer
          </label>
          <input
            type="text"
            value={(question.correctAnswer as string) || ''}
            onChange={(e) => updateQuestion({ correctAnswer: e.target.value })}
            placeholder="Enter the correct answer..."
            className="w-full bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-base placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
          />
        </div>
      )}

      {/* Answer Options (for quiz type) */}
      {(question.type === 'mcq' || question.type === 'true-false') && (
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Answer Choices
            </label>
            {(!question.options || question.options.length === 0) && (
              <button
                onClick={initializeOptions}
                className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg font-medium transition-colors text-sm"
              >
                + Add Answer Choices
              </button>
            )}
          </div>
          
          {(!question.options || question.options.length === 0) ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 border border-amber-200 dark:border-amber-800 text-center">
              <div className="text-amber-800 dark:text-amber-300 text-base font-medium mb-1">⚠️ No Answer Choices</div>
              <div className="text-amber-700 dark:text-amber-400 text-sm">This question needs answer choices. Click the button above to add them.</div>
            </div>
          ) : (
            <>
              {question.options.map((option, idx) => {
            const colorConfig = OPTION_COLORS[idx] || OPTION_COLORS[0];
            const isCorrect = option.isCorrect;
            return (
              <div
                key={option.id}
                className={`rounded-lg p-4 flex items-center gap-3 border-2 transition-all ${
                  isCorrect 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600' 
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${colorConfig.bg} ${colorConfig.text}`}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => updateOption(option.id, { text: e.target.value })}
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    className="w-full bg-transparent text-slate-900 dark:text-white text-base font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg transition-colors ${
                  isCorrect 
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
                    : 'bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500'
                }`}>
                  <input
                    type="checkbox"
                    checked={option.isCorrect}
                    onChange={(e) => {
                      // For single-select, uncheck all others when one is checked
                      if (e.target.checked && question.type === 'mcq') {
                        const updatedOptions = question.options?.map(opt => ({
                          ...opt,
                          isCorrect: opt.id === option.id
                        }));
                        updateQuestion({ options: updatedOptions });
                      } else {
                        updateOption(option.id, { isCorrect: e.target.checked });
                      }
                    }}
                    className="w-4 h-4 rounded cursor-pointer accent-green-600"
                  />
                  <span className="text-sm font-medium whitespace-nowrap">
                    {option.isCorrect ? '✓ Correct' : 'Mark Correct'}
                  </span>
                </label>
                {question.options && question.options.length > 2 && (
                  <button
                    onClick={() => removeOption(option.id)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
                    title="Remove option"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
              })}

              {question.type !== 'true-false' && question.options.length < 4 && (
                <button
                  onClick={addOption}
                  className="w-full py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-xl">+</span> Add Answer Option
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Settings Row */}
      <div className="grid grid-cols-2 gap-4 p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Time Limit
          </label>
          <select
              value={question.timeLimit ?? 0}
              onChange={(e) => updateQuestion({ timeLimit: parseInt(e.target.value) })}
              className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent cursor-pointer"
            >
              <option value={0}>No timer (default)</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={20}>20 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Points
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={question.points || 1}
              onChange={(e) => updateQuestion({ points: parseInt(e.target.value) || 1 })}
              min={1}
              max={100}
              className="w-full bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
            />
            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">pts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
