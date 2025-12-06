"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/contexts/ToastContext';
import LoadingTemplate2 from '@/components/molecules/loading_template_2/loading_template_2/loading2';
import QuestionPagination from '@/components/molecules/QuestionPagination';

interface Question {
    id: string;
    type: 'short' | 'paragraph' | 'mcq' | 'checkboxes' | 'identification' | 'enumeration' | 'match' | 'title' | 'image' | 'section';
    title: string;
    required?: boolean;
    options?: string[];
    answer?: string | string[];
    items?: string[];
    pairs?: { left: string; right?: string }[];
    description?: string;
    src?: string;
    alt?: string;
    points?: number;
    maxAnswers?: number; // For questions that allow multiple answers
}

interface Assessment {
    id: string;
    title: string;
    description?: string;
    type: 'MCQ' | 'TF' | 'Practical' | 'Written' | 'Mixed';
    category: 'Quiz' | 'Exam' | 'Activity';
    format: 'online' | 'file_submission';
    questions: Question[];
    timeLimitMins?: number;
    maxAttempts?: number;
    published: boolean;
    dueDate?: Date;
    instructions?: string;
    totalPoints?: number;
    settings?: {
        lockdown?: boolean;
        showProgress?: boolean;
        allowBacktrack?: boolean;
        autoSubmit?: boolean;
    };
}

interface StudentAnswer {
    questionId: string;
    answer: string | string[] | { [key: string]: string };
}

export default function StudentAssessmentPage({
    params
}: {
    params: Promise<{ studentclassId: string; assessmentId: string }>
}) {
    const router = useRouter();
    const { user } = useAuth();

    const [studentclassId, setStudentclassId] = useState<string | null>(null);
    const [assessmentId, setAssessmentId] = useState<string | null>(null);
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasStarted, setHasStarted] = useState(false);
    const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState<any>(null);
    const [lockedInfo, setLockedInfo] = useState<{
        locked: boolean;
        scheduledOpen: string | null;
        scheduledClose: string | null;
        dueDate: string | null;
    } | null>(null);

    // Toast notifications
    const { showSuccess, showError, showInfo } = useToast();

    // Extract params
    useEffect(() => {
        const unwrap = async () => {
            const p = await params;
            setStudentclassId(p.studentclassId);
            setAssessmentId(p.assessmentId);
        };
        unwrap();
    }, [params]);

    // Fetch assessment function wrapped in useCallback
    const fetchAssessment = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${assessmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                // Handle specific error cases
                if (response.status === 403 && result.data?.locked) {
                    // Assessment is locked - set locked state for UI
                    setLockedInfo(result.data);
                    setLoading(false);
                    return;
                }
                throw new Error(result.error || `Failed to load assessment: ${response.statusText}`);
            }

            if (!result.success) {
                throw new Error(result.error || 'Failed to load assessment');
            }

            const assessmentData = result.data.assessment;
            const submissionStatusData = result.data.submissionStatus;

            setSubmissionStatus(submissionStatusData);

            // Check if student has already submitted and cannot retake
            if (submissionStatusData?.hasSubmitted && !submissionStatusData?.canRetake) {
                // Redirect to results page
                router.push(`/student_page/student_class/${studentclassId}/assessment/${assessmentId}/results`);
                return;
            }

            // Show message if student has submitted but can retake
            if (submissionStatusData?.hasSubmitted && submissionStatusData?.canRetake) {
                showInfo(`You have already submitted this assessment (Attempt ${submissionStatusData.submissionCount}/${assessmentData.maxAttempts}). You can retake it or view your results.`);
            }

            setAssessment(assessmentData);

            // Initialize answers object
            const initialAnswers: Record<string, StudentAnswer> = {};
            assessmentData.questions.forEach((q: Question) => {
                if (q.type !== 'title' && q.type !== 'section' && q.type !== 'image') {
                    // Check if MCQ requires multiple answers
                    const hasMaxAnswers = q.maxAnswers && q.maxAnswers > 1;
                    const answerIsArray = Array.isArray(q.answer);
                    const questionText = (q.title + ' ' + (q.description || '')).toLowerCase();
                    const textIndicatesMultiple = q.type === 'mcq' && /\b(choose|select|pick)\s+(two|three|four|five|2|3|4|5|multiple|all that apply)\b/i.test(questionText);
                    const requiresMultiple = hasMaxAnswers || answerIsArray || textIndicatesMultiple;
                    
                    initialAnswers[q.id] = {
                        questionId: q.id,
                        answer: (q.type === 'checkboxes' || requiresMultiple) ? [] : q.type === 'match' ? {} : ''
                    };
                }
            });
            setAnswers(initialAnswers);

        } catch (error) {
            console.error('Error fetching assessment:', error);
            setError(error instanceof Error ? error.message : 'Failed to load assessment');
        } finally {
            setLoading(false);
        }
    }, [studentclassId, assessmentId, hasStarted, router, showInfo]);

    // Fetch assessment details
    useEffect(() => {
        if (!studentclassId || !assessmentId) return;
        fetchAssessment();
    }, [studentclassId, assessmentId, fetchAssessment]);

    // Actual submit function
    const performSubmit = useCallback(async (autoSubmit = false) => {
        setIsSubmitting(true);
        setShowSubmitConfirmModal(false);

        try {
            showInfo(autoSubmit ? 'Time is up! Auto-submitting your assessment...' : 'Submitting your assessment...');

            const submissionData = {
                answers: Object.values(answers),
                submittedAt: new Date().toISOString(),
                timeSpent: assessment?.timeLimitMins ? (assessment.timeLimitMins * 60) - (timeRemaining || 0) : undefined
            };

            const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${assessmentId}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify(submissionData)
            });

            if (!response.ok) {
                throw new Error(`Submission failed: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to submit assessment');
            }

            showSuccess('Assessment submitted successfully!');

            // Check if student can retake or should go to results
            const canRetake = assessment?.maxAttempts && submissionStatus 
                ? (submissionStatus.submissionCount + 1) < assessment.maxAttempts 
                : false;

            if (canRetake) {
                // If they can retake, refresh the page to show options
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                // If they can't retake, go to results page
                setTimeout(() => {
                    router.push(`/student_page/student_class/${studentclassId}/assessment/${assessmentId}/results`);
                }, 2000);
            }

        } catch (error) {
            console.error('Submission error:', error);
            showError(error instanceof Error ? error.message : 'Failed to submit assessment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, assessment, timeRemaining, studentclassId, assessmentId, submissionStatus, router, showSuccess, showError, showInfo]);

    // Handle submit function wrapped in useCallback
    const handleSubmit = useCallback(async (autoSubmit = false) => {
        if (isSubmitting) return;

        if (!autoSubmit) {
            // Show confirmation modal instead of window.confirm
            setShowSubmitConfirmModal(true);
            return;
        }

        // Auto-submit without confirmation
        await performSubmit(true);
    }, [isSubmitting, performSubmit]);

    // Timer effect
    useEffect(() => {
        if (!hasStarted || !timeRemaining || timeRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (!prev || prev <= 1) {
                    // Auto-submit when time runs out
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [handleSubmit, hasStarted, timeRemaining]);

    const startAssessment = async () => {
        setHasStarted(true);

        // Set timer if there's a time limit
        if (assessment?.timeLimitMins) {
            setTimeRemaining(assessment.timeLimitMins * 60);
        }

        showSuccess('Assessment started! Good luck!');
    };

    const updateAnswer = (questionId: string, answer: string | string[] | { [key: string]: string }) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: {
                questionId,
                answer
            }
        }));
    };

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const renderQuestion = (question: Question) => {
        const answer = answers[question.id]?.answer;

        switch (question.type) {
            case 'title':
                return (
                    <div className="text-center py-8">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{question.title}</h2>
                        {question.description && (
                            <p className="mt-2 text-slate-600 dark:text-slate-400">{question.description}</p>
                        )}
                    </div>
                );

            case 'section':
                return (
                    <div className="py-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{question.title}</h3>
                        {question.description && (
                            <p className="mt-1 text-slate-600 dark:text-slate-400">{question.description}</p>
                        )}
                    </div>
                );

            case 'image':
                return (
                    <div className="text-center py-4">
                        {question.src && (
                            <img
                                src={question.src}
                                alt={question.alt || question.title}
                                className="max-w-full h-auto mx-auto rounded-lg shadow-sm"
                            />
                        )}
                        {question.title && (
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{question.title}</p>
                        )}
                    </div>
                );

            case 'short':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <input
                            type="text"
                            value={answer as string || ''}
                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] dark:bg-slate-800 dark:text-slate-200"
                            placeholder="Enter your answer..."
                        />
                    </div>
                );

            case 'paragraph':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <textarea
                            value={answer as string || ''}
                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] dark:bg-slate-800 dark:text-slate-200"
                            placeholder="Enter your answer..."
                        />
                    </div>
                );

            case 'mcq': {
                // Detect if question requires multiple answers
                // Priority: 1. maxAnswers field, 2. answer is array, 3. text detection
                const hasMaxAnswers = question.maxAnswers && question.maxAnswers > 1;
                const answerIsArray = Array.isArray(question.answer);
                const questionText = (question.title + ' ' + (question.description || '')).toLowerCase();
                // More flexible regex that catches various patterns
                const textIndicatesMultiple = 
                    /\b(choose|select|pick|identify)\s+(two|three|four|five|six|2|3|4|5|6)\b/i.test(questionText) ||
                    /\b(two|three|four|five|six|2|3|4|5|6)\s+(features|items|options|answers|choices)\b/i.test(questionText) ||
                    /\b(multiple|all that apply)\b/i.test(questionText) ||
                    /\(choose\s+the\s+best\s+answer\)/i.test(questionText) === false && /\btwo\b/i.test(questionText);
                
                // Debug logging
                if (process.env.NODE_ENV === 'development') {
                    console.log('MCQ Question Debug:', {
                        id: question.id,
                        title: question.title,
                        hasMaxAnswers,
                        answerIsArray,
                        textIndicatesMultiple,
                        questionText: questionText.substring(0, 100),
                        answer: question.answer,
                        currentAnswer: answer
                    });
                }
                
                const requiresMultiple = hasMaxAnswers || answerIsArray || textIndicatesMultiple;
                const maxSelections = question.maxAnswers || (answerIsArray && Array.isArray(question.answer) ? question.answer.length : undefined);
                
                if (requiresMultiple) {
                    // Render as checkboxes for multiple selection
                    const currentAnswers = (answer as string[]) || [];
                    const selectionCount = currentAnswers.length;
                    
                    return (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                {question.title}
                                {question.required && <span className="text-red-500 ml-1">*</span>}
                                {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                            </label>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    {maxSelections 
                                        ? `Select exactly ${maxSelections} answer${maxSelections > 1 ? 's' : ''}`
                                        : 'Select multiple answers'
                                    }
                                </p>
                                {maxSelections && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        selectionCount === maxSelections 
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                            : selectionCount > maxSelections
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                        {selectionCount}/{maxSelections} selected
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2">
                                {question.options?.map((option, index) => {
                                    const isChecked = currentAnswers.includes(option);
                                    const isDisabled = !!(maxSelections && !isChecked && selectionCount >= maxSelections);
                                    
                                    return (
                                        <label 
                                            key={index} 
                                            className={`flex items-center space-x-3 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    value={option}
                                                    checked={isChecked}
                                                    disabled={isDisabled}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            updateAnswer(question.id, [...currentAnswers, option]);
                                                        } else {
                                                            updateAnswer(question.id, currentAnswers.filter(a => a !== option));
                                                        }
                                                    }}
                                                    className="sr-only peer"
                                                />
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                    isChecked 
                                                        ? 'border-[#2E7D32] bg-white dark:bg-slate-800' 
                                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                                } ${isDisabled ? 'opacity-50' : 'peer-focus:ring-2 peer-focus:ring-[#2E7D32] peer-focus:ring-offset-2'}`}>
                                                    {isChecked && (
                                                        <div className="w-2 h-2 rounded-full bg-[#2E7D32]"></div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }
                
                // Default single selection with radio buttons
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <div className="space-y-2">
                            {question.options?.map((option, index) => {
                                const isChecked = answer === option;
                                return (
                                    <label key={index} className="flex items-center space-x-3 cursor-pointer">
                                        <div className="relative flex items-center">
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={option}
                                                checked={isChecked}
                                                onChange={(e) => updateAnswer(question.id, e.target.value)}
                                                className="sr-only peer"
                                            />
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                isChecked 
                                                    ? 'border-[#2E7D32] bg-white dark:bg-slate-800' 
                                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                            } peer-focus:ring-2 peer-focus:ring-[#2E7D32] peer-focus:ring-offset-2`}>
                                                {isChecked && (
                                                    <div className="w-2 h-2 rounded-full bg-[#2E7D32]"></div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );
            }

            case 'checkboxes':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <div className="space-y-2">
                            {question.options?.map((option, index) => {
                                const isChecked = (answer as string[] || []).includes(option);
                                return (
                                    <label key={index} className="flex items-center space-x-3 cursor-pointer">
                                        <div className="relative flex items-center">
                                            <input
                                                type="checkbox"
                                                value={option}
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    const currentAnswers = answer as string[] || [];
                                                    if (e.target.checked) {
                                                        updateAnswer(question.id, [...currentAnswers, option]);
                                                    } else {
                                                        updateAnswer(question.id, currentAnswers.filter(a => a !== option));
                                                    }
                                                }}
                                                className="sr-only peer"
                                            />
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                isChecked 
                                                    ? 'border-[#2E7D32] bg-white dark:bg-slate-800' 
                                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                            } peer-focus:ring-2 peer-focus:ring-[#2E7D32] peer-focus:ring-offset-2`}>
                                                {isChecked && (
                                                    <div className="w-2 h-2 rounded-full bg-[#2E7D32]"></div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                );

            case 'identification':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <input
                            type="text"
                            value={answer as string || ''}
                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] dark:bg-slate-800 dark:text-slate-200"
                            placeholder="Identify the answer..."
                        />
                    </div>
                );

            case 'enumeration':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <textarea
                            value={answer as string || ''}
                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] dark:bg-slate-800 dark:text-slate-200"
                            placeholder="List your answers (one per line)..."
                        />
                    </div>
                );

            case 'match':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <div className="space-y-2">
                            {question.pairs?.map((pair, index) => (
                                <div key={index} className="flex items-center space-x-3">
                                    <span className="text-sm text-slate-700 dark:text-slate-300 min-w-0 flex-1">{pair.left}</span>
                                    <span className="text-slate-500">→</span>
                                    <input
                                        type="text"
                                        value={(answer as { [key: string]: string } || {})[pair.left] || ''}
                                        onChange={(e) => {
                                            const currentAnswers = answer as { [key: string]: string } || {};
                                            updateAnswer(question.id, {
                                                ...currentAnswers,
                                                [pair.left]: e.target.value
                                            });
                                        }}
                                        className="flex-1 px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] dark:bg-slate-800 dark:text-slate-200"
                                        placeholder="Match with..."
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return <LoadingTemplate2 title="Loading assessment..." />;
    }

    // Show locked screen if assessment is locked
    if (lockedInfo?.locked) {
        const formatDate = (dateStr: string | null) => {
            if (!dateStr) return null;
            return new Date(dateStr).toLocaleString();
        };

        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
                <div className="max-w-lg w-full">
                    {/* Main Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
                        {/* Lock Icon */}
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl mb-6 shadow-lg">
                            <svg className="w-10 h-10 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
                            Assessment Locked
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
                            This assessment is currently locked and cannot be accessed.
                        </p>

                        {/* Schedule Info */}
                        <div className="space-y-3 mb-8">
                            {lockedInfo.scheduledOpen && (
                                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="font-medium">Opens: {formatDate(lockedInfo.scheduledOpen)}</span>
                                    </div>
                                </div>
                            )}
                            {lockedInfo.scheduledClose && (
                                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                                    <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="font-medium">Closes: {formatDate(lockedInfo.scheduledClose)}</span>
                                    </div>
                                </div>
                            )}
                            {lockedInfo.dueDate && (
                                <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
                                    <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-300">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="font-medium">Due: {formatDate(lockedInfo.dueDate)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Go Back Button */}
                        <button
                            onClick={() => router.back()}
                            className="w-full bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Go Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 dark:text-red-400 mb-2">Error loading assessment</div>
                    <div className="text-slate-600 dark:text-slate-300 text-sm">{error}</div>
                    <button
                        onClick={fetchAssessment}
                        className="mt-4 px-4 py-2 bg-[#2E7D32] text-white rounded-md hover:bg-[#1B5E20]"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!assessment) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                <div className="text-slate-600 dark:text-slate-300">Assessment not found.</div>
            </div>
        );
    }

    // Show assessment info before starting
    if (!hasStarted) {
        return (
            <>
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2 break-words">
                                    {assessment.title}
                                </h1>
                                <div className="flex justify-center items-center">
                                    <span className="px-3 py-1 bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A] rounded-full text-sm font-semibold">
                                        {assessment.category}
                                    </span>
                                </div>
                            </div>

                            {assessment.instructions && (
                                <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Instructions</h3>
                                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                        {assessment.instructions}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-3">
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Assessment Details</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Questions:</span>
                                            <span className="text-slate-800 dark:text-slate-200">{assessment.questions.length}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Total Points:</span>
                                            <span className="text-slate-800 dark:text-slate-200">{assessment.totalPoints || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Time Limit:</span>
                                            <span className="text-slate-800 dark:text-slate-200">
                                                {assessment.timeLimitMins ? `${assessment.timeLimitMins} minutes` : 'No limit'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">Attempts:</span>
                                            <span className="text-slate-800 dark:text-slate-200">{assessment.maxAttempts || 1}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">Important Notes</h4>
                                    <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                        <li>• Make sure you have a stable internet connection</li>
                                        <li>• Your progress will be saved automatically</li>
                                        <li>• You cannot change answers after submission</li>
                                        {assessment.timeLimitMins && <li>• The assessment will auto-submit when time expires</li>}
                                        {assessment.settings?.lockdown && <li>• Do not switch tabs or leave this page</li>}
                                    </ul>
                                </div>
                            </div>

                            <div className="text-center space-y-4">
                                {submissionStatus?.hasSubmitted && (
                                    <div className="mb-4 p-4 bg-[#E8F5E9] dark:bg-[#1C2B1C] rounded-lg">
                                        <h4 className="font-semibold text-[#2E7D32] dark:text-[#04C40A] mb-2">Previous Submission</h4>
                                        <p className="text-sm text-[#2E7D32] dark:text-[#04C40A]">
                                            You submitted this assessment on {new Date(submissionStatus.latestSubmission?.submittedAt).toLocaleDateString()}
                                        </p>
                                        {submissionStatus.latestSubmission?.score !== undefined && (
                                            <p className="text-sm text-[#2E7D32] dark:text-[#04C40A]">
                                                Score: {submissionStatus.latestSubmission.score.toFixed(1)}%
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                <div className="flex justify-center gap-4">
                                    {submissionStatus?.hasSubmitted && (
                                        <button
                                            onClick={() => router.push(`/student_page/student_class/${studentclassId}/assessment/${assessmentId}/results`)}
                                            className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
                                        >
                                            View Results
                                        </button>
                                    )}
                                    
                                    {(!submissionStatus?.hasSubmitted || submissionStatus?.canRetake) && (
                                        <button
                                            onClick={startAssessment}
                                            className="px-8 py-3 bg-[#2E7D32] text-white rounded-lg hover:bg-[#1B5E20] font-semibold"
                                        >
                                            {submissionStatus?.hasSubmitted ? `Retake Assessment (${submissionStatus.submissionCount + 1}/${assessment.maxAttempts})` : 'Start Assessment'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Filter out non-answerable questions for navigation
    const answerableQuestions = assessment.questions.filter(q =>
        !['title', 'section', 'image'].includes(q.type)
    );

    const currentQuestion = assessment.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / assessment.questions.length) * 100;

    return (
        <>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
                {/* Header with timer and progress */}
                <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1 mr-4">
                                <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {assessment.title}
                                </h1>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Question {currentQuestionIndex + 1} of {assessment.questions.length}
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                {timeRemaining !== null && (
                                    <div className={`px-3 py-1 rounded-lg font-mono text-sm ${timeRemaining < 300 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                                        timeRemaining < 900 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                                            'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                        }`}>
                                        {formatTime(timeRemaining)}
                                    </div>
                                )}

                                <button
                                    onClick={() => handleSubmit()}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 bg-[#2E7D32] text-white rounded-lg hover:bg-[#1B5E20] disabled:bg-slate-300 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </div>
                        </div>

                        {/* Progress bar */}
                        {assessment.settings?.showProgress !== false && (
                            <div className="mt-3">
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                    <div
                                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Question content */}
                <div className="max-w-4xl mx-auto p-6">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8">
                        {renderQuestion(currentQuestion)}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-center mt-6">
                        <QuestionPagination
                            currentQuestion={currentQuestionIndex + 1}
                            totalQuestions={assessment.questions.length}
                            onNavigate={setCurrentQuestionIndex}
                            disablePrevious={assessment.settings?.allowBacktrack === false}
                        />
                    </div>
                </div>
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={() => !isSubmitting && setShowSubmitConfirmModal(false)}></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Submit Assessment</h3>
                            <button
                                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                                onClick={() => setShowSubmitConfirmModal(false)}
                                disabled={isSubmitting}
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                            Are you sure you want to submit your assessment? You cannot change your answers after submission.
                        </p>

                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowSubmitConfirmModal(false)}
                                className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => performSubmit(false)}
                                className="px-4 py-2 rounded-lg transition-colors text-sm font-medium bg-[#2E7D32] text-white hover:bg-[#1B5E20] disabled:bg-slate-300 disabled:cursor-not-allowed"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}