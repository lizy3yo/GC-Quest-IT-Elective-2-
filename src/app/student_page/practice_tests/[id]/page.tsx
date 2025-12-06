"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';

type MultipleChoiceQuestion = {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
    difficulty: string;
    topic: string;
    points: number;
};

type WrittenQuestion = {
    question: string;
    expectedAnswer: string;
    rubric: string[];
    difficulty: string;
    topic: string;
    points: number;
};

type PracticeTest = {
    _id: string;
    title: string;
    description: string;
    subject: string;
    difficulty: string;
    timeLimit: number;
    totalPoints: number;
    topics: string[];
    multipleChoiceQuestions: MultipleChoiceQuestion[];
    writtenQuestions: WrittenQuestion[];
    learningObjectives?: string[];
    instructions?: string;
};

export default function PracticeTestViewPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;
    const { showSuccess, showError } = useToast();
    const [practiceTest, setPracticeTest] = useState<PracticeTest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'results'>('overview');
    const [isSaving, setIsSaving] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [loadingResults, setLoadingResults] = useState(false);

    // Editable state
    const [editedTest, setEditedTest] = useState<PracticeTest | null>(null);
    const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
    const [editingQuestionType, setEditingQuestionType] = useState<'mc' | 'written' | null>(null);

    useEffect(() => {
        if (id) {
            const fetchPracticeTest = async () => {
                try {
                    const response = await fetch(`/api/student_page/practice-test/${id}`);
                    if (!response.ok) {
                        throw new Error('Failed to fetch practice test');
                    }
                    const data = await response.json();
                    setPracticeTest(data.data);
                    setEditedTest(data.data);
                } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'An error occurred');
                } finally {
                    setIsLoading(false);
                }
            };
            fetchPracticeTest();
        }
    }, [id]);

    // Fetch results when results tab is selected
    useEffect(() => {
        if (activeTab === 'results' && id) {
            const fetchResults = async () => {
                setLoadingResults(true);
                try {
                    const userId = localStorage.getItem('userId');
                    const response = await fetch(`/api/student_page/practice-test/${id}/results?userId=${userId}`);
                    if (response.ok) {
                        const data = await response.json();
                        setResults(data.results || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch results:', err);
                } finally {
                    setLoadingResults(false);
                }
            };
            fetchResults();
        }
    }, [activeTab, id]);

    const handleStartTest = () => {
        if (!editedTest) return;
        sessionStorage.setItem('current_practice_test', JSON.stringify(editedTest));
        router.push(`/student_page/practice_tests/${editedTest._id}/take`);
    };

    const handleSaveChanges = async () => {
        if (!editedTest) return;
        setIsSaving(true);
        try {
            const userId = localStorage.getItem('userId');
            const response = await fetch(`/api/student_page/practice-test/${editedTest._id}?userId=${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ practiceTest: editedTest })
            });
            if (!response.ok) throw new Error('Failed to save');
            showSuccess('Changes saved successfully!');
            setPracticeTest(editedTest);
        } catch (err) {
            showError('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const updateMCQuestion = (index: number, field: keyof MultipleChoiceQuestion, value: any) => {
        if (!editedTest) return;
        const updated = { ...editedTest };
        updated.multipleChoiceQuestions = [...updated.multipleChoiceQuestions];
        updated.multipleChoiceQuestions[index] = { ...updated.multipleChoiceQuestions[index], [field]: value };
        setEditedTest(updated);
    };

    const updateWrittenQuestion = (index: number, field: keyof WrittenQuestion, value: any) => {
        if (!editedTest) return;
        const updated = { ...editedTest };
        updated.writtenQuestions = [...updated.writtenQuestions];
        updated.writtenQuestions[index] = { ...updated.writtenQuestions[index], [field]: value };
        setEditedTest(updated);
    };

    const deleteMCQuestion = (index: number) => {
        if (!editedTest) return;
        const updated = { ...editedTest };
        updated.multipleChoiceQuestions = updated.multipleChoiceQuestions.filter((_, i) => i !== index);
        updated.totalPoints = updated.multipleChoiceQuestions.reduce((s, q) => s + q.points, 0) + 
                              updated.writtenQuestions.reduce((s, q) => s + q.points, 0);
        setEditedTest(updated);
    };

    const deleteWrittenQuestion = (index: number) => {
        if (!editedTest) return;
        const updated = { ...editedTest };
        updated.writtenQuestions = updated.writtenQuestions.filter((_, i) => i !== index);
        updated.totalPoints = updated.multipleChoiceQuestions.reduce((s, q) => s + q.points, 0) + 
                              updated.writtenQuestions.reduce((s, q) => s + q.points, 0);
        setEditedTest(updated);
    };

    const convertMCToWritten = (index: number) => {
        if (!editedTest) return;
        const mcQuestion = editedTest.multipleChoiceQuestions[index];
        const newWrittenQuestion: WrittenQuestion = {
            question: mcQuestion.question,
            expectedAnswer: mcQuestion.options[mcQuestion.correctAnswer] || '',
            rubric: [],
            difficulty: mcQuestion.difficulty,
            topic: mcQuestion.topic,
            points: mcQuestion.points
        };
        const updated = { ...editedTest };
        updated.multipleChoiceQuestions = updated.multipleChoiceQuestions.filter((_, i) => i !== index);
        updated.writtenQuestions = [...updated.writtenQuestions, newWrittenQuestion];
        setEditedTest(updated);
    };

    const convertWrittenToMC = (index: number) => {
        if (!editedTest) return;
        const writtenQuestion = editedTest.writtenQuestions[index];
        const newMCQuestion: MultipleChoiceQuestion = {
            question: writtenQuestion.question,
            options: [writtenQuestion.expectedAnswer, '', '', ''],
            correctAnswer: 0,
            explanation: '',
            difficulty: writtenQuestion.difficulty,
            topic: writtenQuestion.topic,
            points: writtenQuestion.points
        };
        const updated = { ...editedTest };
        updated.writtenQuestions = updated.writtenQuestions.filter((_, i) => i !== index);
        updated.multipleChoiceQuestions = [...updated.multipleChoiceQuestions, newMCQuestion];
        setEditedTest(updated);
    };

    const hasChanges = JSON.stringify(practiceTest) !== JSON.stringify(editedTest);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading practice test...</p>
                </div>
            </div>
        );
    }

    if (error || !practiceTest || !editedTest) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
                    <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">Unable to load practice test</h2>
                    <p className="text-red-700 dark:text-red-300 mb-4">{error || 'Practice test not found'}</p>
                    <Link href="/student_page/practice_tests" className="inline-block px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700">
                        Back to Practice Tests
                    </Link>
                </div>
            </div>
        );
    }

    const totalQuestions = (editedTest.multipleChoiceQuestions?.length || 0) + (editedTest.writtenQuestions?.length || 0);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 -mx-8 px-4 sm:px-6 md:mx-0 md:px-0">
            <div className="w-full max-w-5xl mx-auto">
                {/* Header Card - StudentAssessmentPlayer style */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 md:p-8 mb-4 sm:mb-6">
                    <div className="text-center mb-4 sm:mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-[#2E7D32] rounded-full mb-3 sm:mb-4">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1 sm:mb-2 px-2">{editedTest.title}</h1>
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                            {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'} • {editedTest.timeLimit} min
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
                        <div className="text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{totalQuestions}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Questions</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-600 dark:text-purple-400">{editedTest.totalPoints}</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Points</p>
                        </div>
                        <div className="text-center p-2 sm:p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">{editedTest.timeLimit}m</p>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Time Limit</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 sm:space-y-3">
                        <button
                            onClick={handleStartTest}
                            className="w-full px-4 sm:px-8 md:px-12 py-3 sm:py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-semibold text-base sm:text-lg shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">Start Practice Test</span>
                            <span className="sm:hidden">Start Test</span>
                        </button>
                        {hasChanges && (
                            <button onClick={handleSaveChanges} disabled={isSaving} className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm sm:text-base transition-all disabled:opacity-50">
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                const context = sessionStorage.getItem('breadcrumb_context');
                                const tab = sessionStorage.getItem('breadcrumb_tab');
                                if (context === 'public_library') {
                                    router.push(`/student_page/public_library${tab ? `?tab=${tab}` : '?tab=practice_tests'}`);
                                } else {
                                    router.push(`/student_page/private_library${tab ? `?tab=${tab}` : '?tab=practice_tests'}`);
                                }
                            }}
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm sm:text-base border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>Back to Library</span>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                        <button onClick={() => setActiveTab('overview')} className={`flex-1 min-w-[80px] px-2 sm:px-4 py-2.5 sm:py-3 font-medium text-sm sm:text-base transition-all border-b-2 ${activeTab === 'overview' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                            Overview
                        </button>
                        <button onClick={() => setActiveTab('questions')} className={`flex-1 min-w-[100px] px-2 sm:px-4 py-2.5 sm:py-3 font-medium text-sm sm:text-base transition-all border-b-2 relative ${activeTab === 'questions' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                            Questions
                            <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs rounded-full">{totalQuestions}</span>
                        </button>
                        <button onClick={() => setActiveTab('results')} className={`flex-1 min-w-[80px] px-2 sm:px-4 py-2.5 sm:py-3 font-medium text-sm sm:text-base transition-all border-b-2 relative ${activeTab === 'results' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                            Results
                            {results.length > 0 && <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs rounded-full">{results.length}</span>}
                        </button>
                    </div>

                    <div className="p-3 sm:p-4 md:p-6">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="space-y-4 sm:space-y-6">
                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 text-slate-700 dark:text-slate-300">Title</label>
                                    <input type="text" value={editedTest.title} onChange={(e) => setEditedTest({ ...editedTest, title: e.target.value })} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg sm:rounded-xl text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 text-slate-700 dark:text-slate-300">Description</label>
                                    <textarea value={editedTest.description} onChange={(e) => setEditedTest({ ...editedTest, description: e.target.value })} rows={3} className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg sm:rounded-xl text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 text-slate-700 dark:text-slate-300">Time Limit (minutes)</label>
                                        <input type="number" value={editedTest.timeLimit} onChange={(e) => setEditedTest({ ...editedTest, timeLimit: parseInt(e.target.value) || 30 })} min="5" className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg sm:rounded-xl text-sm sm:text-base text-slate-900 dark:text-white" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Topics</label>
                                    <div className="flex flex-wrap gap-2">
                                        {editedTest.topics.map((topic, idx) => (
                                            <span key={idx} className="px-3 py-1 bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A] rounded-full text-sm font-semibold">{topic}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Questions Tab */}
                        {activeTab === 'questions' && (
                            <div className="space-y-4 sm:space-y-6">
                                {/* Header with Edit Button */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Questions ({totalQuestions})</h3>
                                    {editingQuestionIndex !== null ? (
                                        <div className="flex flex-wrap gap-2">
                                            {hasChanges && (
                                                <button onClick={handleSaveChanges} disabled={isSaving} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#2E7D32] text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-[#1B5E20] transition-all flex items-center gap-1 sm:gap-2">
                                                    {isSaving ? 'Saving...' : '✓ Save'}
                                                </button>
                                            )}
                                            <button onClick={() => { setEditingQuestionIndex(null); setEditingQuestionType(null); }} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm sm:text-base transition-all">
                                                Done
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => { setEditingQuestionIndex(0); setEditingQuestionType('mc'); }} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#2E7D32] text-white rounded-lg font-semibold text-sm sm:text-base hover:bg-[#1B5E20] transition-all flex items-center gap-1 sm:gap-2 self-start sm:self-auto">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            <span className="hidden sm:inline">Edit Questions</span>
                                            <span className="sm:hidden">Edit</span>
                                        </button>
                                    )}
                                </div>

                                {/* Multiple Choice Questions */}
                                {editedTest.multipleChoiceQuestions.length > 0 && (
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 sm:mb-3">Multiple Choice ({editedTest.multipleChoiceQuestions.length})</h4>
                                        <div className="space-y-3 sm:space-y-4">
                                            {editedTest.multipleChoiceQuestions.map((q, idx) => (
                                                <div key={idx} className={`p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2 transition-all ${editingQuestionIndex !== null ? 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700'}`}>
                                                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                            <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-[#2E7D32] text-white rounded-full text-[10px] sm:text-xs font-semibold">Q{idx + 1}</span>
                                                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] sm:text-xs font-medium">{q.points} pts</span>
                                                        </div>
                                                        {editingQuestionIndex !== null && (
                                                            <button onClick={() => deleteMCQuestion(idx)} className="p-1.5 sm:p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 transition-colors">
                                                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {editingQuestionIndex !== null ? (
                                                        <div className="space-y-3 sm:space-y-4">
                                                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                                                <div className="flex-1">
                                                                    <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Question</label>
                                                                    <input type="text" value={q.question} onChange={(e) => updateMCQuestion(idx, 'question', e.target.value)} className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder="Enter question..." />
                                                                </div>
                                                                <div className="w-full sm:w-40 md:w-48">
                                                                    <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Question Type</label>
                                                                    <select 
                                                                        value="multiple-choice"
                                                                        onChange={(e) => { if (e.target.value === 'written') convertMCToWritten(idx); }}
                                                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent text-sm sm:text-base text-slate-900 dark:text-white"
                                                                    >
                                                                        <option value="multiple-choice">Multiple Choice</option>
                                                                        <option value="written">Written</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 sm:mb-2">Answer Options (select correct answer)</label>
                                                                <div className="space-y-1.5 sm:space-y-2">
                                                                    {q.options.map((opt, optIdx) => (
                                                                        <div key={optIdx} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border-2 transition-all ${q.correctAnswer === optIdx ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'}`}>
                                                                            <input type="radio" checked={q.correctAnswer === optIdx} onChange={() => updateMCQuestion(idx, 'correctAnswer', optIdx)} className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 cursor-pointer flex-shrink-0" />
                                                                            <span className="font-bold text-slate-500 text-sm sm:text-base">{String.fromCharCode(65 + optIdx)}.</span>
                                                                            <input type="text" value={opt} onChange={(e) => { const newOpts = [...q.options]; newOpts[optIdx] = e.target.value; updateMCQuestion(idx, 'options', newOpts); }} className="flex-1 min-w-0 px-2 sm:px-3 py-1 sm:py-2 bg-transparent border-0 focus:ring-0 text-sm sm:text-base text-slate-900 dark:text-white" placeholder={`Option ${String.fromCharCode(65 + optIdx)}`} />
                                                                            {q.correctAnswer === optIdx && <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-600 text-white text-[10px] sm:text-xs rounded font-semibold flex-shrink-0">Correct</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-3 sm:gap-4">
                                                                <div>
                                                                    <label className="block text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Points</label>
                                                                    <input type="number" value={q.points} onChange={(e) => updateMCQuestion(idx, 'points', parseInt(e.target.value) || 1)} min="1" className="w-20 sm:w-24 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm sm:text-base text-slate-900 dark:text-white" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="font-medium text-slate-900 dark:text-white mb-3">{q.question}</p>
                                                            <div className="space-y-2">
                                                                {q.options.map((opt, optIdx) => (
                                                                    <div key={optIdx} className={`flex items-center justify-between p-3 rounded-lg border-2 ${q.correctAnswer === optIdx ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white'}`}>
                                                                        <span className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-500 dark:text-slate-400">{String.fromCharCode(65 + optIdx)}.</span>
                                                                            {opt}
                                                                        </span>
                                                                        {q.correctAnswer === optIdx && <span className="px-2 py-1 bg-green-600 text-white text-xs rounded font-semibold">✓ Correct</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Written Questions */}
                                {editedTest.writtenQuestions.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Written Questions ({editedTest.writtenQuestions.length})</h4>
                                        <div className="space-y-4">
                                            {editedTest.writtenQuestions.map((q, idx) => (
                                                <div key={idx} className={`p-5 rounded-xl border-2 transition-all ${editingQuestionIndex !== null ? 'bg-white dark:bg-slate-800 border-purple-300 dark:border-purple-700' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'}`}>
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold">W{idx + 1}</span>
                                                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">{q.points} pts</span>
                                                        </div>
                                                        {editingQuestionIndex !== null && (
                                                            <button onClick={() => deleteWrittenQuestion(idx)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-600 transition-colors">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    {editingQuestionIndex !== null ? (
                                                        <div className="space-y-4">
                                                            <div className="flex gap-4">
                                                                <div className="flex-1">
                                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Question</label>
                                                                    <input type="text" value={q.question} onChange={(e) => updateWrittenQuestion(idx, 'question', e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder="Enter question..." />
                                                                </div>
                                                                <div className="w-48">
                                                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Question Type</label>
                                                                    <select 
                                                                        value="written"
                                                                        onChange={(e) => { if (e.target.value === 'multiple-choice') convertWrittenToMC(idx); }}
                                                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 dark:text-white"
                                                                    >
                                                                        <option value="multiple-choice">Multiple Choice</option>
                                                                        <option value="written">Written</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Expected Answer</label>
                                                                <textarea value={q.expectedAnswer} onChange={(e) => updateWrittenQuestion(idx, 'expectedAnswer', e.target.value)} rows={3} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" placeholder="Enter expected answer..." />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Points</label>
                                                                <input type="number" value={q.points} onChange={(e) => updateWrittenQuestion(idx, 'points', parseInt(e.target.value) || 1)} min="1" className="w-24 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="font-medium text-slate-900 dark:text-white mb-3">{q.question}</p>
                                                            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                                                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Expected Answer:</p>
                                                                <p className="text-slate-700 dark:text-slate-300">{q.expectedAnswer}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {totalQuestions === 0 && (
                                    <div className="text-center py-12">
                                        <p className="text-slate-500 dark:text-slate-400">No questions in this practice test.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Results Tab */}
                        {activeTab === 'results' && (
                            <div className="space-y-4 sm:space-y-6">
                                {loadingResults ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4"></div>
                                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Loading results...</p>
                                    </div>
                                ) : results.length > 0 ? (
                                    <div className="space-y-3 sm:space-y-4">
                                        {/* Summary Stats */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white">
                                                <p className="text-[10px] sm:text-xs md:text-sm opacity-90">Total Attempts</p>
                                                <p className="text-xl sm:text-2xl md:text-3xl font-bold">{results.length}</p>
                                            </div>
                                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white">
                                                <p className="text-[10px] sm:text-xs md:text-sm opacity-90">Best Score</p>
                                                <p className="text-xl sm:text-2xl md:text-3xl font-bold">{Math.max(...results.map(r => r.score))}%</p>
                                            </div>
                                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white">
                                                <p className="text-[10px] sm:text-xs md:text-sm opacity-90">Average Score</p>
                                                <p className="text-xl sm:text-2xl md:text-3xl font-bold">{Math.round(results.reduce((a, r) => a + r.score, 0) / results.length)}%</p>
                                            </div>
                                            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white">
                                                <p className="text-[10px] sm:text-xs md:text-sm opacity-90">Latest Score</p>
                                                <p className="text-xl sm:text-2xl md:text-3xl font-bold">{results[0]?.score || 0}%</p>
                                            </div>
                                        </div>

                                        {/* Attempt History */}
                                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Attempt History</h3>
                                        <div className="overflow-x-auto rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700">
                                            <table className="w-full min-w-[500px]">
                                                <thead className="bg-slate-100 dark:bg-slate-700/50">
                                                    <tr>
                                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">#</th>
                                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date</th>
                                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Score</th>
                                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Correct</th>
                                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Incorrect</th>
                                                        <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                    {results.map((result, idx) => (
                                                        <tr key={idx} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white">
                                                                {results.length - idx}
                                                            </td>
                                                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                                                <span className="block sm:inline">{new Date(result.submittedAt || result.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                                <span className="text-slate-400 dark:text-slate-500 block sm:inline sm:ml-2 text-[10px] sm:text-xs">
                                                                    {new Date(result.submittedAt || result.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                                                <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold ${
                                                                    result.score >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                    result.score >= 70 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                    result.score >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                                                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                                }`}>
                                                                    {Math.round(result.score)}%
                                                                </span>
                                                            </td>
                                                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                                                <span className="text-green-600 dark:text-green-400 font-semibold text-xs sm:text-sm">{result.correctAnswers || 0}</span>
                                                            </td>
                                                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                                                <span className="text-red-600 dark:text-red-400 font-semibold text-xs sm:text-sm">{result.incorrectAnswers || 0}</span>
                                                            </td>
                                                            <td className="px-2 sm:px-4 py-3 sm:py-4 text-right text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                                                                {Math.floor((result.timeSpent || 0) / 60)}:{String((result.timeSpent || 0) % 60).padStart(2, '0')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 sm:py-16 px-4">
                                        <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                                            <svg className="w-7 h-7 sm:w-10 sm:h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">No Results Yet</h3>
                                        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-4 sm:mb-6 max-w-sm mx-auto">Complete this practice test to track your progress and see detailed results here.</p>
                                        <button onClick={handleStartTest} className="px-6 sm:px-8 py-2.5 sm:py-3 bg-[#2E7D32] text-white rounded-xl font-semibold text-sm sm:text-base hover:bg-[#1B5E20] transition-colors shadow-lg shadow-green-500/20">
                                            Start Practice Test
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
