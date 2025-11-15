"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from '@/hooks/useAuth';
import Alert from '@/components/molecules/alert_template/Alert';
import LoadingTemplate2 from '@/components/atoms/loading_template_2/loading2';

type Props = {
  params: Promise<{
    class: string;
    classId: string;
    assessmentType: string;
    assessmentId: string;
    studentId: string;
  }>;
};

interface FileAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
  cloudinaryPublicId?: string;
}

interface Submission {
  id: string;
  studentId: string;
  files: FileAttachment[];
  comment: string;
  submittedAt: string;
  status: string;
  grade: number | null;
  feedback: string;
  attemptNumber: number;
  type: string;
  gradedAt: string | null;
  gradedBy: string | null;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  instructions: string;
  dueDate: string | null;
  totalPoints: number;
  attachments: FileAttachment[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

export default function StudentProgressPage({ params }: Props) {
  const { user } = useAuth();
  const [routeParams, setRouteParams] = useState<{
    class: string;
    classId: string;
    assessmentType: string;
    assessmentId: string;
    studentId: string;
  } | null>(null);
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Grading state
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [isGrading, setIsGrading] = useState(false);
  
  // Alert state
  const [alertState, setAlertState] = useState<{
    isVisible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    title?: string;
    autoClose?: boolean;
    autoCloseDelay?: number;
  }>({ isVisible: false, type: 'info', message: '', title: undefined, autoClose: true, autoCloseDelay: 5000 });

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

  // Extract params from Promise
  useEffect(() => {
    const extractParams = async () => {
      const p = await params;
      setRouteParams(p);
    };
    extractParams();
  }, [params]);

  // Fetch submission data
  useEffect(() => {
    if (!routeParams) return;
    fetchSubmissionData();
  }, [routeParams]);

  const fetchSubmissionData = async () => {
    if (!routeParams) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/teacher_page/class/${routeParams.classId}/activity/${routeParams.assessmentId}/student/${routeParams.studentId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch submission: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch submission');
      }

      setActivity(result.data.activity);
      setStudent(result.data.student);
      setSubmission(result.data.submission);
      
      // Set initial grading values
      if (result.data.submission) {
        setGrade(result.data.submission.grade?.toString() || '');
        setFeedback(result.data.submission.feedback || '');
      }

    } catch (error) {
      console.error('Error fetching submission:', error);
      setError(error instanceof Error ? error.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const handleGradeSubmission = async () => {
    if (!routeParams || !submission) return;
    
    setIsGrading(true);
    
    try {
      const gradeValue = grade.trim() === '' ? null : parseFloat(grade);
      
      if (gradeValue !== null && (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100)) {
        showAlert({ type: 'error', message: 'Grade must be a number between 0 and 100' });
        return;
      }

      const response = await fetch(
        `/api/teacher_page/class/${routeParams.classId}/activity/${routeParams.assessmentId}/student/${routeParams.studentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            grade: gradeValue,
            feedback: feedback.trim()
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to grade submission: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to grade submission');
      }

      // Update submission with new grade and feedback
      setSubmission(prev => prev ? {
        ...prev,
        grade: result.data.grade,
        feedback: result.data.feedback,
        status: result.data.status,
        gradedAt: result.data.gradedAt,
        gradedBy: result.data.gradedBy
      } : null);

      showAlert({ 
        type: 'success', 
        message: 'Submission graded successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });

    } catch (error) {
      console.error('Error grading submission:', error);
      showAlert({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to grade submission',
        autoClose: true,
        autoCloseDelay: 5000
      });
    } finally {
      setIsGrading(false);
    }
  };

  const downloadFile = async (file: FileAttachment) => {
    try {
      showAlert({ type: 'info', message: 'Downloading file...', autoClose: true, autoCloseDelay: 3000 });
      
      const response = await fetch(file.url);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showAlert({ type: 'success', message: 'File downloaded successfully', autoClose: true, autoCloseDelay: 3000 });
    } catch (error) {
      console.error('Download error:', error);
      showAlert({ type: 'error', message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '/icons/file-pdf.svg';
    if (type.includes('word') || type.includes('msword')) return '/icons/file-doc.svg';
    if (type.includes('spreadsheet') || type.includes('excel')) return '/icons/file-xls.svg';
    if (type.includes('presentation') || type.includes('powerpoint')) return '/icons/file-ppt.svg';
    if (type.startsWith('image/')) return '/icons/file-img.svg';
    return '/icons/file-generic.svg';
  };

  if (loading) return <LoadingTemplate2 title="Loading submission details..." />;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <Link 
            href={`/teacher_page/${routeParams?.class}/${routeParams?.classId}/assessments/${routeParams?.assessmentType}/${routeParams?.assessmentId}`}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to assessment
          </Link>
        </div>
      </div>
    );
  }

  if (!activity || !student) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-600 mb-4">No Data Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Activity or student information not found.</p>
          <Link 
            href={`/teacher_page/${routeParams?.class}/${routeParams?.classId}/assessments/${routeParams?.assessmentType}/${routeParams?.assessmentId}`}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to assessment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-200">
      {/* Global alert */}
      <Alert
        type={alertState.type}
        message={alertState.message}
        title={alertState.title}
        isVisible={alertState.isVisible}
        onClose={() => setAlertState((s) => ({ ...s, isVisible: false }))}
        autoClose={alertState.autoClose}
        autoCloseDelay={alertState.autoCloseDelay}
        position="top-right"
      />
      
      <div className="max-w-6xl mx-auto">
        {/* Navigation */}
        <nav className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          <Link 
            href={`/teacher_page/${routeParams?.class}/${routeParams?.classId}/assessments/${routeParams?.assessmentType}/${routeParams?.assessmentId}`} 
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            ← Back to {activity.title}
          </Link>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {student.fullName} — Submission
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              {activity.title} • Due: {formatDate(activity.dueDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Submission Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Information */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Activity Information</h2>
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Title:</span>
                  <span className="ml-2 text-slate-900 dark:text-white">{activity.title}</span>
                </div>
                {activity.description && (
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Description:</span>
                    <p className="mt-1 text-slate-900 dark:text-white">{activity.description}</p>
                  </div>
                )}
                {activity.instructions && (
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Instructions:</span>
                    <p className="mt-1 text-slate-900 dark:text-white">{activity.instructions}</p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Points:</span>
                  <span className="ml-2 text-slate-900 dark:text-white">{activity.totalPoints}</span>
                </div>
                <div>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Due Date:</span>
                  <span className="ml-2 text-slate-900 dark:text-white">{formatDate(activity.dueDate)}</span>
                </div>
              </div>
            </div>

            {/* Student Submission */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Student Submission</h2>
              
              {submission ? (
                <div className="space-y-4">
                  {/* Submission Status */}
                  <div className="flex items-center space-x-4">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      submission.status === 'graded' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : submission.status === 'submitted'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {submission.status === 'graded' ? 'Graded' : submission.status === 'submitted' ? 'Submitted' : 'Draft'}
                    </span>
                  </div>

                  {/* Submission Date */}
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Submitted:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{formatDate(submission.submittedAt)}</span>
                  </div>

                  {/* Current Grade */}
                  {submission.grade !== null && (
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Current Grade:</span>
                      <span className="ml-2 text-slate-900 dark:text-white font-semibold">
                        {submission.grade}/{activity.totalPoints} ({Math.round((submission.grade / activity.totalPoints) * 100)}%)
                      </span>
                    </div>
                  )}

                  {/* Student Comment */}
                  {submission.comment && (
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Student Comment:</span>
                      <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-slate-900 dark:text-white">
                        {submission.comment}
                      </p>
                    </div>
                  )}

                  {/* Submitted Files */}
                  {submission.files.length > 0 && (
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Submitted Files:</span>
                      <div className="mt-2 space-y-2">
                        {submission.files.map((file, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                          >
                            <div className="flex items-center space-x-3">
                              <img 
                                src={getFileIcon(file.type)} 
                                alt="File icon" 
                                className="w-8 h-8"
                              />
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  {formatFileSize(file.size)} • {file.type}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => downloadFile(file)}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                            >
                              Download
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Feedback */}
                  {submission.feedback && (
                    <div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">Current Feedback:</span>
                      <p className="mt-1 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-slate-900 dark:text-white">
                        {submission.feedback}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">No submission found for this student.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Grading Panel */}
          {submission && (
            <div className="space-y-6">
              {/* Grading Form */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Grade Submission</h3>
                
                <div className="space-y-4">
                  {/* Grade Input */}
                  <div>
                    <label htmlFor="grade" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Grade (0-{activity.totalPoints})
                    </label>
                    <input
                      type="number"
                      id="grade"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      min="0"
                      max={activity.totalPoints}
                      step="0.1"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                      placeholder={`Enter grade (0-${activity.totalPoints})`}
                    />
                  </div>

                  {/* Feedback Input */}
                  <div>
                    <label htmlFor="feedback" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Feedback
                    </label>
                    <textarea
                      id="feedback"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white resize-none"
                      placeholder="Enter feedback for the student..."
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleGradeSubmission}
                    disabled={isGrading}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
                  >
                    {isGrading ? 'Grading...' : 'Save Grade & Feedback'}
                  </button>
                </div>
              </div>

              {/* Student Information */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Student Information</h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Name:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{student.fullName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Email:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{student.email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
