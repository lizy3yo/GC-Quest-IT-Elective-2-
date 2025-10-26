"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/hooks/useAuth';
import Alert from "@/components/ui/alert_template/Alert";
import LoadingTemplate2 from '@/components/ui/loading_template_2/loading2';

interface Question {
    id: string;
    type: 'short' | 'paragraph' | 'mcq' | 'checkboxes' | 'identification' | 'enumeration' | 'match' | 'title' | 'image' | 'section';
    title: string;
    required?: boolean;
    options?: string[];
    answer?: string;
    items?: string[];
    pairs?: { left: string; right?: string }[];
    description?: string;
    src?: string;
    alt?: string;
    points?: number;
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
    accessCode?: string;
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
    const [accessCodeInput, setAccessCodeInput] = useState("");
    const [showAccessCodeModal, setShowAccessCodeModal] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState<any>(null);

    // Alert state
    const [alertState, setAlertState] = useState<{
        isVisible: boolean;
        type: 'success' | 'error' | 'warning' | 'info';
        message: string;
        title?: string;
        autoClose?: boolean;
        autoCloseDelay?: number;
    }>({ isVisible: false, type: 'info', message: '', autoClose: true, autoCloseDelay: 5000 });

    const showAlert = (opts: { type?: 'success' | 'error' | 'warning' | 'info'; message: string; title?: string; autoClose?: boolean; autoCloseDelay?: number; }) => {
        setAlertState({
            isVisible: true,
            type: opts.type ?? 'info',
            message: opts.message,
            title: opts.title,
            autoClose: opts.autoClose ?? true,
            autoCloseDelay: opts.autoCloseDelay ?? 5000,
        });
    };

    // Extract params
    useEffect(() => {
        const unwrap = async () => {
            const p = await params;
            setStudentclassId(p.studentclassId);
            setAssessmentId(p.assessmentId);
        };
        unwrap();
    }, [params]);

    // Fetch assessment details
    useEffect(() => {
        if (!studentclassId || !assessmentId) return;
        fetchAssessment();
    }, [studentclassId, assessmentId]);

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
    }, [hasStarted, timeRemaining]);

    const fetchAssessment = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${assessmentId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to load assessment: ${response.statusText}`);
            }

            const result = await response.json();

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
                showAlert({ 
                    type: 'info', 
                    message: `You have already submitted this assessment (Attempt ${submissionStatusData.submissionCount}/${assessmentData.maxAttempts}). You can retake it or view your results.`,
                    autoClose: false
                });
            }

            // Check if assessment requires access code (only for new attempts, not for viewing results)
            if (assessmentData.accessCode && !hasStarted && !submissionStatusData?.hasSubmitted) {
                setShowAccessCodeModal(true);
            }

            setAssessment(assessmentData);

            // Initialize answers object
            const initialAnswers: Record<string, StudentAnswer> = {};
            assessmentData.questions.forEach((q: Question) => {
                if (q.type !== 'title' && q.type !== 'section' && q.type !== 'image') {
                    initialAnswers[q.id] = {
                        questionId: q.id,
                        answer: q.type === 'checkboxes' ? [] : q.type === 'match' ? {} : ''
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
    };

    const startAssessment = async () => {
        if (assessment?.accessCode && accessCodeInput !== assessment.accessCode) {
            showAlert({ type: 'error', message: 'Invalid access code. Please try again.' });
            return;
        }

        setHasStarted(true);
        setShowAccessCodeModal(false);

        // Set timer if there's a time limit
        if (assessment?.timeLimitMins) {
            setTimeRemaining(assessment.timeLimitMins * 60);
        }

        showAlert({
            type: 'success',
            message: 'Assessment started! Good luck!',
            autoClose: true,
            autoCloseDelay: 3000
        });
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

    const handleSubmit = async (autoSubmit = false) => {
        if (isSubmitting) return;

        if (!autoSubmit) {
            const confirmMessage = "Are you sure you want to submit your assessment? You cannot change your answers after submission.";
            if (!window.confirm(confirmMessage)) return;
        }

        setIsSubmitting(true);

        try {
            showAlert({
                type: 'info',
                message: autoSubmit ? 'Time is up! Auto-submitting your assessment...' : 'Submitting your assessment...',
                autoClose: false
            });

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

            showAlert({
                type: 'success',
                message: 'Assessment submitted successfully!',
                autoClose: true,
                autoCloseDelay: 3000
            });

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
            showAlert({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to submit assessment. Please try again.',
                autoClose: false
            });
        } finally {
            setIsSubmitting(false);
        }
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
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
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
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
                            placeholder="Enter your answer..."
                        />
                    </div>
                );

            case 'mcq':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <div className="space-y-2">
                            {question.options?.map((option, index) => (
                                <label key={index} className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={question.id}
                                        value={option}
                                        checked={answer === option}
                                        onChange={(e) => updateAnswer(question.id, e.target.value)}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                );

            case 'checkboxes':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            {question.title}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                            {question.points && <span className="text-xs text-slate-500 ml-2">({question.points} pts)</span>}
                        </label>
                        <div className="space-y-2">
                            {question.options?.map((option, index) => (
                                <label key={index} className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        value={option}
                                        checked={(answer as string[] || []).includes(option)}
                                        onChange={(e) => {
                                            const currentAnswers = answer as string[] || [];
                                            if (e.target.checked) {
                                                updateAnswer(question.id, [...currentAnswers, option]);
                                            } else {
                                                updateAnswer(question.id, currentAnswers.filter(a => a !== option));
                                            }
                                        }}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                                </label>
                            ))}
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
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
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
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
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
                                        className="flex-1 px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
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

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 dark:text-red-400 mb-2">Error loading assessment</div>
                    <div className="text-slate-600 dark:text-slate-300 text-sm">{error}</div>
                    <button
                        onClick={fetchAssessment}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
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

    // Show access code modal
    if (showAccessCodeModal && !hasStarted) {
        return (
            <>
                <Alert
                    type={alertState.type}
                    message={alertState.message}
                    title={alertState.title}
                    isVisible={alertState.isVisible}
                    onClose={() => setAlertState(s => ({ ...s, isVisible: false }))}
                    autoClose={alertState.autoClose}
                    autoCloseDelay={alertState.autoCloseDelay}
                    position="top-right"
                />

                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full">
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                            Access Code Required
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            This assessment requires an access code to begin. Please enter the code provided by your instructor.
                        </p>
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={accessCodeInput}
                                onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                                placeholder="Enter access code"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
                                maxLength={10}
                            />
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => router.back()}
                                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={startAssessment}
                                    disabled={!accessCodeInput.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                >
                                    Start Assessment
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // Show assessment info before starting
    if (!hasStarted) {
        return (
            <>
                <Alert
                    type={alertState.type}
                    message={alertState.message}
                    title={alertState.title}
                    isVisible={alertState.isVisible}
                    onClose={() => setAlertState(s => ({ ...s, isVisible: false }))}
                    autoClose={alertState.autoClose}
                    autoCloseDelay={alertState.autoCloseDelay}
                    position="top-right"
                />

                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                                    {assessment.title}
                                </h1>
                                <div className="flex justify-center items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                                        {assessment.category}
                                    </span>
                                    <span>{assessment.questions.length} questions</span>
                                    {assessment.totalPoints && <span>{assessment.totalPoints} points</span>}
                                    {assessment.timeLimitMins && <span>{assessment.timeLimitMins} minutes</span>}
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
                                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Previous Submission</h4>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            You submitted this assessment on {new Date(submissionStatus.latestSubmission?.submittedAt).toLocaleDateString()}
                                        </p>
                                        {submissionStatus.latestSubmission?.score !== undefined && (
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
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
                                            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
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
            <Alert
                type={alertState.type}
                message={alertState.message}
                title={alertState.title}
                isVisible={alertState.isVisible}
                onClose={() => setAlertState(s => ({ ...s, isVisible: false }))}
                autoClose={alertState.autoClose}
                autoCloseDelay={alertState.autoCloseDelay}
                position="top-right"
            />

            <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
                {/* Header with timer and progress */}
                <div className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="max-w-4xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
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
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
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
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
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
                    <div className="flex justify-between items-center mt-6">
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestionIndex === 0 || (assessment.settings?.allowBacktrack === false)}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>

                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            {currentQuestionIndex + 1} / {assessment.questions.length}
                        </div>

                        <button
                            onClick={() => setCurrentQuestionIndex(prev => Math.min(assessment.questions.length - 1, prev + 1))}
                            disabled={currentQuestionIndex === assessment.questions.length - 1}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}