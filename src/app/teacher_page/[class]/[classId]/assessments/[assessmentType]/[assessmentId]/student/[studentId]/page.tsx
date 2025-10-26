"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authManager } from "@/utils/auth";

interface Question {
    id: string;
    type: string;
    title: string;
    options?: string[];
    points?: number;
}

interface GradedAnswer {
    questionId: string;
    studentAnswer: string | string[] | { [key: string]: string } | null;
    correctAnswer?: string | string[] | { [key: string]: string };
    isCorrect: boolean;
    points: number;
    maxPoints: number;
    needsManualGrading?: boolean;
    isManuallyGraded?: boolean;
    feedback?: string;
}

interface Submission {
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    score: number;
    maxScore: number;
    status: string;
    submittedAt: string;
    timeSpent?: number;
    attemptNumber: number;
    needsManualGrading: boolean;
    gradedAt?: string;
    feedback?: string;
    gradedAnswers?: GradedAnswer[];
}

interface Assessment {
    id: string;
    title: string;
    totalPoints?: number;
    dueDate?: string;
    questions?: Question[];
}

export default function TeacherStudentSubmissionPage({
    params
}: {
    params: Promise<{ class: string; classId: string; assessmentType: string; assessmentId: string; studentId: string }>
}) {
    const router = useRouter();

    const [resolvedParams, setResolvedParams] = useState<any>(null);
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState("");
    const [score, setScore] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    
    // State for individual question grading (points only; feedback removed)
    const [questionGrades, setQuestionGrades] = useState<Record<string, {
        points: number;
        isGraded: boolean;
    }>>({});
    const [savingQuestions, setSavingQuestions] = useState<Record<string, boolean>>({});
    // Track which questions are currently being edited (override server isManuallyGraded)
    const [editingQuestions, setEditingQuestions] = useState<Record<string, boolean>>({});

    // Extract params
    useEffect(() => {
        const unwrap = async () => {
            const p = await params;
            setResolvedParams(p);
        };
        unwrap();
    }, [params]);

    // Fetch submission details
    useEffect(() => {
        if (!resolvedParams) return;
        fetchSubmissionDetails();
    }, [resolvedParams]);

    const fetchSubmissionDetails = async () => {
        if (!resolvedParams) return;

        try {
            setLoading(true);
            setError(null);

            // Fetch submission details
            const response = await authManager.makeAuthenticatedRequest(
                `/api/teacher_page/assessment/${resolvedParams.assessmentId}/student/${resolvedParams.studentId}/submission`
            );

            const result = await response.json();

            if (response.ok && result.success) {
                // Submission exists
                setAssessment(result.data.assessment);
                setSubmission(result.data.submission);
                setFeedback(result.data.submission?.feedback || "");
                setScore(result.data.submission?.score || null);
                
                // Initialize question grades for manual grading questions
                    if (result.data.submission?.gradedAnswers) {
                    const initialGrades: Record<string, { points: number; isGraded: boolean }> = {};
                    result.data.submission.gradedAnswers.forEach((gradedAnswer: GradedAnswer) => {
                        if (gradedAnswer.needsManualGrading) {
                            initialGrades[gradedAnswer.questionId] = {
                                points: gradedAnswer.points || 0,
                                isGraded: gradedAnswer.isManuallyGraded || false
                            };
                        }
                    });
                    setQuestionGrades(initialGrades);
                }
            } else if (response.status === 404) {
                // No submission found - fetch assessment details and student info separately
                try {
                    // Fetch assessment details
                    const assessmentResponse = await authManager.makeAuthenticatedRequest(
                        `/api/teacher_page/assessment/${resolvedParams.assessmentId}`
                    );
                    
                    if (!assessmentResponse.ok) {
                        throw new Error(`Failed to load assessment: ${assessmentResponse.statusText}`);
                    }
                    
                    const assessmentResult = await assessmentResponse.json();
                    
                    if (!assessmentResult.success) {
                        throw new Error(assessmentResult.error || 'Failed to load assessment');
                    }

                    // Fetch student details
                    const studentResponse = await authManager.makeAuthenticatedRequest(
                        `/api/teacher_page/class/${resolvedParams.classId}/students`
                    );
                    
                    if (!studentResponse.ok) {
                        throw new Error(`Failed to load student details: ${studentResponse.statusText}`);
                    }
                    
                    const studentResult = await studentResponse.json();
                    
                    if (!studentResult.success) {
                        throw new Error(studentResult.error || 'Failed to load student details');
                    }

                    // Find the specific student
                    const student = studentResult.data.students.find((s: any) => s.studentId === resolvedParams.studentId);
                    
                    if (!student) {
                        throw new Error('Student not found in class');
                    }

                    // Set assessment data
                    const fetchedAssessment = assessmentResult.data.assessment;
                    setAssessment({
                        id: fetchedAssessment._id || resolvedParams.assessmentId,
                        title: fetchedAssessment.title,
                        totalPoints: fetchedAssessment.totalPoints,
                        dueDate: fetchedAssessment.dueDate,
                        questions: fetchedAssessment.questions || []
                    });

                    // Create a placeholder submission object to show "not submitted" state
                    setSubmission({
                        id: '',
                        studentId: resolvedParams.studentId,
                        studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student',
                        studentEmail: student.email || '',
                        score: 0,
                        maxScore: fetchedAssessment.totalPoints || 100,
                        status: 'not_submitted',
                        submittedAt: '',
                        timeSpent: 0,
                        attemptNumber: 0,
                        needsManualGrading: false,
                        gradedAnswers: []
                    });

                    setFeedback("");
                    setScore(null);
                    setQuestionGrades({}); // No submission means no question grades to set
                } catch (innerError) {
                    console.error('Error fetching assessment/student details:', innerError);
                    setError(innerError instanceof Error ? innerError.message : 'Failed to load assessment details');
                }
            } else {
                throw new Error(result.error || 'Failed to load submission');
            }

        } catch (error) {
            console.error('Error fetching submission:', error);
            setError(error instanceof Error ? error.message : 'Failed to load submission');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGrade = async () => {
        if (!resolvedParams || !submission) return;

        setSaving(true);
        try {
            const response = await authManager.makeAuthenticatedRequest(
                `/api/teacher_page/assessment/${resolvedParams.assessmentId}/student-status`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        studentId: resolvedParams.studentId,
                        score: score,
                        feedback: feedback.trim()
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to save grade: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to save grade');
            }

            // Update local state
            setSubmission(prev => prev ? {
                ...prev,
                score: score || 0,
                feedback: feedback.trim(),
                status: 'graded'
            } : null);

            alert('Grade saved successfully!');

        } catch (error) {
            console.error('Error saving grade:', error);
            alert(error instanceof Error ? error.message : 'Failed to save grade');
        } finally {
            setSaving(false);
        }
    };

    const handleQuestionGrade = async (questionId: string) => {
        if (!resolvedParams || !submission) return;

        // allow grading even if local questionGrades entry wasn't created yet
        const pointsToSend = questionGrades[questionId]?.points ?? 0;

        setSavingQuestions(prev => ({ ...prev, [questionId]: true }));
        try {
            const response = await authManager.makeAuthenticatedRequest(
                `/api/teacher_page/assessment/${resolvedParams.assessmentId}/student/${resolvedParams.studentId}/question-grade`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                                questionId: questionId,
                                points: pointsToSend
                            })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to save question grade: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to save question grade');
            }

            // Update local state to mark graded, and clear any editing override
            setQuestionGrades(prev => ({
                ...prev,
                [questionId]: {
                    points: pointsToSend,
                    isGraded: true
                }
            }));
            setEditingQuestions(prev => ({ ...prev, [questionId]: false }));

            // Update submission gradedAnswers
            setSubmission(prev => {
                if (!prev || !prev.gradedAnswers) return prev;

                const updatedGradedAnswers = prev.gradedAnswers.map(ga => {
                    if (ga.questionId !== questionId) return ga;
                    const pts = pointsToSend;
                    return {
                        ...ga,
                        points: pts,
                        isCorrect: pts === ga.maxPoints,
                        isManuallyGraded: true
                    };
                });

                // Recalculate total score
                const totalPoints = updatedGradedAnswers.reduce((sum, ga) => sum + (ga.points || 0), 0);
                const maxPoints = updatedGradedAnswers.reduce((sum, ga) => sum + (ga.maxPoints || 0), 0);
                const newScore = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

                return {
                    ...prev,
                    gradedAnswers: updatedGradedAnswers,
                    score: Math.round(newScore * 100) / 100
                };
            });

            alert('Question grade saved successfully!');

        } catch (error) {
            console.error('Error saving question grade:', error);
            alert(error instanceof Error ? error.message : 'Failed to save question grade');
        } finally {
            setSavingQuestions(prev => ({ ...prev, [questionId]: false }));
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    const formatTime = (minutes?: number) => {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const renderAnswer = (answer: string | string[] | { [key: string]: string } | null) => {
        if (answer === null || answer === undefined) {
            return <span className="text-slate-400 italic">No answer provided</span>;
        }

        if (Array.isArray(answer)) {
            return (
                <div className="space-y-1">
                    {answer.map((item, index) => (
                        <div key={index} className="text-sm">• {item}</div>
                    ))}
                </div>
            );
        }

        if (typeof answer === 'object') {
            return (
                <div className="space-y-1">
                    {Object.entries(answer).map(([key, value]) => (
                        <div key={key} className="text-sm">{key} → {value}</div>
                    ))}
                </div>
            );
        }

        return <span>{answer}</span>;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div className="text-slate-600 dark:text-slate-300">Loading submission...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 dark:text-red-400 mb-2">Error loading submission</div>
                    <div className="text-slate-600 dark:text-slate-300 text-sm">{error}</div>
                    <button
                        onClick={fetchSubmissionDetails}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!assessment || !submission) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
                <div className="text-slate-600 dark:text-slate-300">Submission not found.</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link
                        href={`/teacher_page/${resolvedParams.class}/${resolvedParams.classId}/assessments/${resolvedParams.assessmentType}/${resolvedParams.assessmentId}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
                    >
                        ← Back to Assessment
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        Student Submission Review
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">{assessment.title}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Student Info and Grading */}
                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                                Student Information
                            </h2>

                            <div className="space-y-3">
                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Name:</span>
                                    <div className="text-slate-800 dark:text-slate-200">{submission.studentName}</div>
                                </div>

                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Email:</span>
                                    <div className="text-slate-800 dark:text-slate-200">{submission.studentEmail}</div>
                                </div>

                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Submitted:</span>
                                    <div className="text-slate-800 dark:text-slate-200">
                                        {submission.status === 'not_submitted' ? 'Not submitted yet' : formatDate(submission.submittedAt)}
                                    </div>
                                </div>

                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Time Spent:</span>
                                    <div className="text-slate-800 dark:text-slate-200">{formatTime(submission.timeSpent)}</div>
                                </div>

                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Attempt:</span>
                                    <div className="text-slate-800 dark:text-slate-200">{submission.attemptNumber}</div>
                                </div>

                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Status:</span>
                                    <div className={`inline-block px-2 py-1 text-xs rounded-full ${submission.status === 'graded'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        : submission.status === 'late'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            : submission.status === 'not_submitted'
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        }`}>
                                        {submission.status === 'not_submitted' ? 'Not Submitted' : submission.status}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Grading Panel */}
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                                Grading
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Score (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={score || ''}
                                        onChange={(e) => setScore(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
                                        placeholder="Enter score"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                                        Feedback
                                    </label>
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
                                        placeholder="Enter feedback for the student..."
                                    />
                                </div>

                                <button
                                    onClick={handleSaveGrade}
                                    disabled={saving || score === null}
                                    className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving && (
                                        <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                                    )}
                                    {saving ? 'Saving...' : submission?.status === 'not_submitted' ? 'Save Manual Grade' : 'Save Grade'}
                                </button>

                                {submission?.status === 'not_submitted' && (
                                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        You can assign a manual grade even if the student hasn't submitted yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Submission Details */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
                                Submission Review
                            </h2>

                            {/* Auto-graded Score Summary */}
                            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                        {submission.status === 'not_submitted' ? 'Current Score:' : 'Auto-graded Score:'}
                                    </span>
                                    <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                        {submission.status === 'not_submitted' ? 'Not submitted' : `${submission.score.toFixed(1)}%`}
                                    </span>
                                </div>
                                {submission.status !== 'not_submitted' && submission.needsManualGrading && (
                                    <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                                        ⚠️ Contains questions requiring manual grading
                                    </div>
                                )}
                                {submission.status === 'not_submitted' && (
                                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                        Student has not submitted this assessment yet. You can still assign a manual grade if needed.
                                    </div>
                                )}
                            </div>

                            {/* Answer Review */}
                            {submission.status === 'not_submitted' ? (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Assessment Preview</h3>
                                    <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600">
                                        <div className="text-center">
                                            <div className="text-slate-400 dark:text-slate-500 mb-2">
                                                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <h4 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No Submission Yet</h4>
                                            <p className="text-slate-500 dark:text-slate-400 mb-4">
                                                This student hasn't submitted their work for this assessment yet.
                                            </p>
                                            {assessment.questions && assessment.questions.length > 0 && (
                                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                                    <p>Assessment contains {assessment.questions.length} question{assessment.questions.length !== 1 ? 's' : ''}</p>
                                                    <p>Total points: {assessment.totalPoints || 'Not specified'}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : submission.gradedAnswers && submission.gradedAnswers.length > 0 ? (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Answer Review</h3>

                                    {submission.gradedAnswers.map((gradedAnswer, index) => (
                                        <div key={gradedAnswer.questionId} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">
                                                        Question {index + 1}
                                                    </h4>
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${gradedAnswer.isCorrect
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                        }`}>
                                                        {gradedAnswer.isCorrect ? 'Correct' : 'Incorrect'}
                                                    </span>

                                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                        {gradedAnswer.points}/{gradedAnswer.maxPoints} pts
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Student Answer:</span>
                                                    <div className="mt-1 text-slate-800 dark:text-slate-200">
                                                        {renderAnswer(gradedAnswer.studentAnswer)}
                                                    </div>
                                                </div>

                                                {gradedAnswer.correctAnswer && !gradedAnswer.needsManualGrading && (
                                                    <div>
                                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Correct Answer:</span>
                                                        <div className="mt-1 text-green-700 dark:text-green-300">
                                                            {renderAnswer(gradedAnswer.correctAnswer)}
                                                        </div>
                                                    </div>
                                                )}

                                                {gradedAnswer.needsManualGrading && (
                                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                                        <div className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-3">
                                                            Manual Grading Required
                                                        </div>

                                                        {/* Determine if graded: server indicates isManuallyGraded OR local state says isGraded */}
                                                        {((gradedAnswer.isManuallyGraded) || questionGrades[gradedAnswer.questionId]?.isGraded) && !editingQuestions[gradedAnswer.questionId] ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm text-green-800 dark:text-green-200 font-medium">
                                                                        ✓ Manually Graded
                                                                    </span>
                                                                    <span className="text-sm font-medium">
                                                                        { /* prefer server points, fallback to local */ }
                                                                        {(gradedAnswer.points ?? questionGrades[gradedAnswer.questionId]?.points ?? 0)}/{gradedAnswer.maxPoints} pts
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        // initialize local grade entry when editing so inputs show and set editing flag
                                                                        setQuestionGrades(prev => ({
                                                                            ...prev,
                                                                            [gradedAnswer.questionId]: {
                                                                                points: gradedAnswer.points ?? prev?.[gradedAnswer.questionId]?.points ?? 0,
                                                                                isGraded: false
                                                                            }
                                                                        }));
                                                                        setEditingQuestions(prev => ({ ...prev, [gradedAnswer.questionId]: true }));
                                                                    }}
                                                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                                                >
                                                                    Edit Grade
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                                            Points (max: {gradedAnswer.maxPoints})
                                                                        </label>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={gradedAnswer.maxPoints}
                                                                            step="0.5"
                                                                            value={questionGrades[gradedAnswer.questionId]?.points ?? gradedAnswer.points ?? 0}
                                                                            onChange={(e) => setQuestionGrades(prev => ({
                                                                                ...prev,
                                                                                [gradedAnswer.questionId]: {
                                                                                    ...(prev?.[gradedAnswer.questionId] || { points: gradedAnswer.points ?? 0, isGraded: false }),
                                                                                    points: Number(e.target.value)
                                                                                }
                                                                            }))}
                                                                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-200"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                                                                            Action
                                                                        </label>
                                                                        <button
                                                                            onClick={() => handleQuestionGrade(gradedAnswer.questionId)}
                                                                            disabled={savingQuestions[gradedAnswer.questionId]}
                                                                            className="w-full px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                                                                        >
                                                                            {savingQuestions[gradedAnswer.questionId] ? 'Saving...' : 'Grade'}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {/* feedback removed per-request */}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Answer Review</h3>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                        <p className="text-slate-600 dark:text-slate-400 text-center">
                                            No answers to review yet.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}