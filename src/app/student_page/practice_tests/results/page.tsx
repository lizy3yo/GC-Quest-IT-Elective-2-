"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Answer = {
  questionIndex: number;
  questionType: 'multiple-choice' | 'written';
  selectedAnswer?: number;
  writtenAnswer?: string;
  isCorrect?: boolean;
  pointsEarned?: number;
  timeSpent?: number;
};

type Submission = {
  _id: string;
  score: number;
  pointsEarned: number;
  totalPoints: number;
  timeSpent: number;
  isPerfectScore: boolean;
  answers: Answer[];
  completedAt: string;
};

export default function ResultsPage() {
  const router = useRouter();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [practiceTest, setPracticeTest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem('userId');
    setUserId(uid);

    const submissionId = sessionStorage.getItem('last_submission_id');
    const testData = sessionStorage.getItem('current_practice_test');
    
    if (!submissionId) {
      router.push('/student_page/practice_tests');
      return;
    }

    // Try to get test data (might be cleared already)
    if (testData) {
      setPracticeTest(JSON.parse(testData));
    }

    // Fetch submission details
    fetch(`/api/student_page/practice-test/submit?submissionId=${submissionId}&userId=${uid}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSubmission(data.submission);
        }
      })
      .catch(err => console.error('Failed to load results:', err))
      .finally(() => setLoading(false));

  }, [router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 97) return 'A+';
    if (score >= 93) return 'A';
    if (score >= 90) return 'A-';
    if (score >= 87) return 'B+';
    if (score >= 83) return 'B';
    if (score >= 80) return 'B-';
    if (score >= 77) return 'C+';
    if (score >= 73) return 'C';
    if (score >= 70) return 'C-';
    if (score >= 67) return 'D+';
    if (score >= 63) return 'D';
    if (score >= 60) return 'D-';
    return 'F';
  };

  const getMCCorrectCount = () => {
    if (!submission) return 0;
    return submission.answers.filter(a => 
      a.questionType === 'multiple-choice' && a.isCorrect
    ).length;
  };

  const getMCTotalCount = () => {
    if (!submission) return 0;
    return submission.answers.filter(a => a.questionType === 'multiple-choice').length;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-green-500 border-t-transparent"></div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
            Results Not Found
          </h3>
          <p className="text-sm sm:text-base text-red-700 dark:text-red-300 mb-4">
            Could not load your test results.
          </p>
          <Link
            href="/student_page/practice_tests"
            className="inline-block w-full sm:w-auto text-center px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm sm:text-base font-medium hover:bg-red-700"
          >
            Back to Practice Tests
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
      {/* Results Header */}
      <div className={`rounded-2xl p-5 sm:p-8 mb-6 shadow-xl ${
        submission.isPerfectScore
          ? 'bg-gradient-to-r from-green-500 to-green-600'
          : submission.score >= 70
            ? 'bg-gradient-to-r from-blue-500 to-blue-600'
            : 'bg-gradient-to-r from-amber-500 to-amber-600'
      } text-white`}>
        {submission.isPerfectScore && (
          <div className="text-center mb-3 sm:mb-4">
            <span className="text-4xl sm:text-6xl">🎉</span>
          </div>
        )}
        <h1 className="text-2xl sm:text-4xl font-bold text-center mb-2">
          {submission.isPerfectScore ? 'Perfect Score!' : 'Test Complete!'}
        </h1>
        <div className="text-center mb-4 sm:mb-6">
          <div className={`text-5xl sm:text-7xl md:text-8xl font-bold mb-2 ${getScoreColor(submission.score)}`}>
            {submission.score}%
          </div>
          <div className="text-xl sm:text-2xl font-semibold">
            Grade: {getScoreGrade(submission.score)}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
          <div className="bg-white/10 rounded-xl p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold">{submission.pointsEarned}</div>
            <div className="text-xs sm:text-sm">out of {submission.totalPoints} points</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold">{getMCCorrectCount()}/{getMCTotalCount()}</div>
            <div className="text-xs sm:text-sm">Correct Answers</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold">{formatTime(submission.timeSpent)}</div>
            <div className="text-xs sm:text-sm">Time Spent</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <button
          onClick={() => setShowAnswers(!showAnswers)}
          className="px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 shadow-lg text-center"
        >
          {showAnswers ? 'Hide' : 'Show'} Answers
        </button>
        <Link
          href="/student_page/practice_tests"
          className="px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 shadow-lg text-center"
        >
          New Test
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm sm:text-base font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 shadow-lg text-center"
        >
          Export PDF
        </button>
        <Link
          href="/student_page/private_library"
          className="px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-sm sm:text-base font-semibold hover:from-green-600 hover:to-green-700 shadow-lg text-center"
        >
          My Library
        </Link>
      </div>

      {/* Answer Review */}
      {showAnswers && practiceTest && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 overflow-x-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 sm:mb-6">
            Answer Review
          </h2>
          
          <div className="space-y-6">
            {/* Multiple Choice Questions */}
            {practiceTest.multipleChoiceQuestions?.map((question: any, idx: number) => {
              const answer = submission.answers.find(a => 
                a.questionType === 'multiple-choice' && a.questionIndex === idx
              );
              
              return (
                <div key={idx} className={`
                  rounded-xl p-6 border-2
                  ${answer?.isCorrect 
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  }
                `}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className={`
                      flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white
                      ${answer?.isCorrect ? 'bg-green-500' : 'bg-red-500'}
                    `}>
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        {question.question}
                      </p>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Topic: {question.topic} • {question.points} points
                      </div>
                    </div>
                    <div className={`
                      px-3 py-1 rounded-full text-sm font-semibold
                      ${answer?.isCorrect 
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      }
                    `}>
                      {answer?.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {question.options.map((option: string, optIdx: number) => {
                      const isUserAnswer = answer?.selectedAnswer === optIdx;
                      const isCorrectAnswer = question.correctAnswer === optIdx;
                      
                      return (
                        <div
                          key={optIdx}
                          className={`
                            p-3 rounded-lg border-2
                            ${isCorrectAnswer 
                              ? 'border-green-500 bg-green-100 dark:bg-green-900/30'
                              : isUserAnswer
                                ? 'border-red-500 bg-red-100 dark:bg-red-900/30'
                                : 'border-slate-200 dark:border-slate-700'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2">
                            {isCorrectAnswer && <span className="text-green-600">✓</span>}
                            {isUserAnswer && !isCorrectAnswer && <span className="text-red-600">✗</span>}
                            <span className="text-slate-900 dark:text-slate-100">{option}</span>
                            {isUserAnswer && (
                              <span className="text-xs text-slate-500 ml-auto">(Your answer)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {question.explanation && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Explanation:
                      </div>
                      <div className="text-blue-800 dark:text-blue-200">
                        {question.explanation}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Written Questions */}
            {practiceTest.writtenQuestions?.map((question: any, idx: number) => {
              const answer = submission.answers.find(a => 
                a.questionType === 'written' && 
                a.questionIndex === practiceTest.multipleChoiceQuestions.length + idx
              );
              
              return (
                <div key={`written-${idx}`} className="rounded-xl p-6 border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center font-semibold text-white">
                      {practiceTest.multipleChoiceQuestions.length + idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        {question.question}
                      </p>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Topic: {question.topic} • {question.points} points
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-500 text-white">
                      Written Response
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Your Answer:
                      </div>
                      <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                        {answer?.writtenAnswer || <span className="text-slate-400 italic">No answer provided</span>}
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Expected Answer:
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        {question.expectedAnswer}
                      </div>
                    </div>

                    {question.rubric && question.rubric.length > 0 && (
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          Grading Rubric:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                          {question.rubric.map((item: string, rIdx: number) => (
                            <li key={rIdx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Performance Breakdown
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">Overall Score</span>
                <span className="font-semibold">{submission.score}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${submission.score}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600 dark:text-slate-400">Points Earned</span>
                <span className="font-semibold">{submission.pointsEarned}/{submission.totalPoints}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${(submission.pointsEarned / submission.totalPoints) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Next Steps
          </h3>
          <ul className="space-y-3">
            {submission.score < 70 && (
              <li className="flex items-start gap-3">
                <span className="text-amber-500">📚</span>
                <span className="text-slate-700 dark:text-slate-300">
                  Review the material and try again to improve your score
                </span>
              </li>
            )}
            <li className="flex items-start gap-3">
              <span className="text-blue-500">🎯</span>
              <span className="text-slate-700 dark:text-slate-300">
                Practice similar questions to master the concepts
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500">✨</span>
              <span className="text-slate-700 dark:text-slate-300">
                Create new flashcards from questions you missed
              </span>
            </li>
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}
