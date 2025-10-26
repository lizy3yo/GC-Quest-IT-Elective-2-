"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from '@/hooks/useAuth';
import { authManager } from '@/utils/auth';
import Alert from '@/components/ui/alert_template/Alert';
import LoadingTemplate2 from '@/components/ui/loading_template_2/loading2';

// File type icon component using public/icons (copied from student page)
function FileIcon({ name, type, size = 20 }: { name?: string; type?: string; size?: number }) {
  const rawName = name || '';
  const maybeExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : undefined;
  const mime = (type || '').toLowerCase();

  let key = 'file-generic';
  if (maybeExt) {
    if (maybeExt === 'pdf') key = 'file-pdf';
    else if (['doc', 'docx'].includes(maybeExt)) key = 'file-doc';
    else if (['xls', 'xlsx'].includes(maybeExt)) key = 'file-xls';
    else if (['ppt', 'pptx'].includes(maybeExt)) key = 'file-ppt';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(maybeExt)) key = 'file-img';
    else key = 'file-generic';
  } else if (mime.includes('pdf')) key = 'file-pdf';
  else if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) key = 'file-doc';
  else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml')) key = 'file-xls';
  else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('officedocument.presentationml')) key = 'file-ppt';
  else if (mime.startsWith('image/')) key = 'file-img';

  const src = `/icons/${key}.svg`;
  return (
    <img src={src} alt={`${maybeExt ? maybeExt.toUpperCase() : 'file'} icon`} width={size} height={size} />
  );
}

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
  // canonical fields
  score?: number | null;
  maxScore?: number | null;
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
  // Deterministic studentclassId reference (studentId_classId)
  const [studentclassId, setStudentclassId] = useState<string | null>(null);
  
  const [activity, setActivity] = useState<Activity | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Grading state
  const [grade, setGrade] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [isGrading, setIsGrading] = useState(false);
  
  // Preview state
  const [filePreview, setFilePreview] = useState<FileAttachment | null>(null);
  
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
      // Compute deterministic studentclassId once, to be used as reference for preview/download
      if (p?.studentId && p?.classId) {
        setStudentclassId(`${p.studentId}_${p.classId}`);
      }
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
      const response = await authManager.makeAuthenticatedRequest(
        `/api/teacher_page/class/${routeParams.classId}/activity/${routeParams.assessmentId}/student/${routeParams.studentId}`
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
        // Prefer canonical score when available
        const initialScore = result.data.submission.score ?? result.data.submission.grade;
        setGrade(initialScore != null ? String(initialScore) : '');
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
      
      // Validate against activity totalPoints (teacher-defined)
      const maxAllowed = activity?.totalPoints ?? 100;
      if (gradeValue !== null && (isNaN(gradeValue) || gradeValue < 0 || gradeValue > maxAllowed)) {
        showAlert({ type: 'error', message: `Grade must be a number between 0 and ${maxAllowed}` });
        return;
      }

      const response = await authManager.makeAuthenticatedRequest(
        `/api/teacher_page/class/${routeParams.classId}/activity/${routeParams.assessmentId}/student/${routeParams.studentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // keep legacy 'grade' for backwards compatibility, but send canonical fields
            grade: gradeValue,
            score: gradeValue,
            maxScore: maxAllowed,
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

      // Update submission with new canonical fields when available
      setSubmission(prev => prev ? {
        ...prev,
        grade: result.data.grade ?? prev.grade,
        score: result.data.score ?? result.data.grade ?? prev.score ?? prev.grade,
        maxScore: result.data.maxScore ?? prev.maxScore ?? maxAllowed,
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

  // Helper function to get studentclassId reference
  const getStudentClassId = async () => {
    // Use locally computed deterministic reference to avoid extra network calls
    if (studentclassId) return studentclassId;
    if (routeParams?.studentId && routeParams?.classId) {
      return `${routeParams.studentId}_${routeParams.classId}`;
    }
    return null;
  };

  // Function to preview a file (opens modal preview like student page resources)
  const previewFile = async (file: FileAttachment) => {
    if (!file.url) {
      showAlert({ type: 'error', message: 'File URL not available for preview' });
      return;
    }

    try {
      // Get studentclassId for context
      const scId = await getStudentClassId();
      
      console.log('Opening file preview:', {
        fileName: file.name,
        fileType: file.type,
        studentclassId: scId || 'not available',
        context: 'teacher_submission_preview'
      });

      // Set the file for modal preview (like the student page)
      setFilePreview(file);
      
      showAlert({ 
        type: 'info', 
        message: 'Opening file preview...', 
        autoClose: true, 
        autoCloseDelay: 2000 
      });
    } catch (error) {
      console.error('Preview error:', error);
      showAlert({ type: 'error', message: 'Failed to open file preview' });
    }
  };

  const downloadFile = async (file: FileAttachment) => {
    if (!routeParams) {
      showAlert({ type: 'error', message: 'Missing route parameters for download' });
      return;
    }

    try {
      showAlert({ type: 'info', message: 'Downloading file...', autoClose: true, autoCloseDelay: 3000 });
      
  // Get studentclassId for context (reference id used across the app)
  const scId = await getStudentClassId();
      
      console.log('Downloading file:', {
        fileName: file.name,
        fileType: file.type,
        fileUrl: file.url,
        studentclassId: scId || 'not available',
        context: 'teacher_submission_download'
      });

      // Use the secure teacher download API endpoint (following student page pattern)
      const downloadUrl = `/api/teacher_page/class/${routeParams.classId}/activity/${routeParams.assessmentId}/student/${routeParams.studentId}/download-file`;
      
      const response = await authManager.makeAuthenticatedRequest(downloadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: file.url,
          fileType: file.type,
          cloudinaryPublicId: file.cloudinaryPublicId,
          studentclassId: scId || undefined
        })
      });

      console.log('Download response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download error response:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          
          // If server-side download failed but we have a fallback URL, try direct download using that URL
          if (errorData.fallbackUrl) {
            console.log('Server download failed, trying direct Cloudinary download:', errorData.fallbackUrl);
            showAlert({ type: 'info', message: 'Attempting direct download from cloud storage...', autoClose: true, autoCloseDelay: 3000 });

            // Create a temporary link for direct download using fallbackUrl
            const a = document.createElement("a");
            a.href = errorData.fallbackUrl;
            a.download = file.name;
            a.target = "_blank"; // Open in new tab as fallback
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showAlert({ type: 'success', message: 'Download initiated', autoClose: true, autoCloseDelay: 3000 });
            return;
          }
        } catch (e) {
          // Not JSON, continue with generic error
        }

        throw new Error(`Download failed: ${response.statusText} - ${errorText}`);
      }

      // Create blob and download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Ensure proper filename with extension
      let filename = file.name;
      if (!filename.includes('.') && file.type) {
        // If no extension, try to add one based on MIME type
        const mimeToExt: Record<string, string> = {
          'application/pdf': '.pdf',
          'application/msword': '.doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
          'application/vnd.ms-excel': '.xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
          'application/vnd.ms-powerpoint': '.ppt',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
          'text/plain': '.txt',
          'text/csv': '.csv',
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
        };

        const extension = mimeToExt[file.type];
        if (extension) {
          filename += extension;
        }
      }

      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showAlert({ type: 'success', message: 'File downloaded successfully', autoClose: true, autoCloseDelay: 3000 });
    } catch (error) {
      console.error('Download error:', error);
      showAlert({ 
        type: 'error', 
        message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}. You can try right-clicking the download button and selecting "Save link as..."`,
        autoClose: true,
        autoCloseDelay: 8000
      });
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
                              <FileIcon name={file.name} type={file.type} size={32} />
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                  {formatFileSize(file.size)} • {file.type}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {/* Preview Button */}
                              <button
                                onClick={() => previewFile(file)}
                                title="Preview file"
                                className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors duration-200 text-sm font-medium"
                              >
                                Preview
                              </button>
                              {/* Download Button */}
                              <button
                                onClick={() => downloadFile(file)}
                                title="Download file"
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                              >
                                Download
                              </button>
                            </div>
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

      {/* File Preview Modal */}
      {filePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <FileIcon name={filePreview.name} type={filePreview.type} size={32} />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {filePreview.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {formatFileSize(filePreview.size)} • {filePreview.type}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => downloadFile(filePreview)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                >
                  Download
                </button>
                <button
                  onClick={() => setFilePreview(null)}
                  className="px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors duration-200 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden p-4">
              <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg">
                {(() => {
                  const fileName = filePreview.name.toLowerCase();
                  const mimeType = filePreview.type.toLowerCase();
                  const sizeKB = filePreview.size ? Math.round(filePreview.size / 1024) : null;

                  // For images, show the image directly
                  if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)) {
                    return (
                      <div className="h-full flex items-center justify-center p-4">
                        <img
                          src={filePreview.url}
                          alt={filePreview.name}
                          className="max-w-full max-h-[70vh] object-contain rounded-md shadow-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="text-center text-slate-500 dark:text-slate-400"><p>Unable to load image preview</p><p class="text-sm mt-2">This file may require download to view</p></div>';
                            }
                          }}
                        />
                      </div>
                    );
                  }

                  // For PDFs, try multiple approaches
                  if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
                    return (
                      <div className="h-full p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-[70vh] flex flex-col">
                          <div className="flex-1 relative">
                            {/* Try PDF.js viewer first */}
                            <iframe
                              title={filePreview.name}
                              src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(filePreview.url)}`}
                              className="w-full h-full border-none rounded-md"
                              onError={() => {
                                // Fallback to Google Docs viewer
                                const iframe = document.querySelector(`iframe[title="${filePreview.name}"]`) as HTMLIFrameElement;
                                if (iframe) {
                                  iframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(filePreview.url)}&embedded=true`;
                                }
                              }}
                            />
                          </div>
                          <div className="p-2 text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200 dark:border-slate-700">
                            If preview doesn't load, try downloading the file
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // For Office documents, use Google Docs viewer
                  if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml') || /\.(doc|docx)$/i.test(fileName) ||
                    mimeType.includes('presentation') || mimeType.includes('officedocument.presentationml') || /\.(ppt|pptx)$/i.test(fileName) ||
                    mimeType.includes('spreadsheet') || mimeType.includes('officedocument.spreadsheetml') || /\.(xls|xlsx)$/i.test(fileName)) {

                    return (
                      <div className="h-full p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-[70vh] flex flex-col">
                          <div className="flex-1 relative">
                            <iframe
                              title={filePreview.name}
                              src={`https://docs.google.com/gview?url=${encodeURIComponent(filePreview.url)}&embedded=true`}
                              className="w-full h-full border-none rounded-md"
                              onLoad={(e) => {
                                // Check if the iframe loaded successfully
                                const iframe = e.target as HTMLIFrameElement;
                                setTimeout(() => {
                                  try {
                                    // This will throw an error if CORS blocks access
                                    const doc = iframe.contentDocument;
                                    if (!doc || doc.body.innerHTML.includes('error') || doc.body.innerHTML.trim() === '') {
                                      throw new Error('Failed to load');
                                    }
                                  } catch (error) {
                                    // Show fallback message
                                    const parent = iframe.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `
                                        <div class="flex items-center justify-center h-full">
                                          <div class="text-center">
                                            <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                              <svg class="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                            </div>
                                            <p class="text-slate-600 dark:text-slate-400 mb-2">Preview not available</p>
                                            <p class="text-sm text-slate-500 dark:text-slate-500">This file needs to be downloaded to view</p>
                                          </div>
                                        </div>
                                      `;
                                    }
                                  }
                                }, 3000);
                              }}
                            />
                          </div>
                          <div className="p-2 text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200 dark:border-slate-700">
                            Loading document preview...
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // For text files, try to fetch and display content
                  if (mimeType.startsWith('text/') || /\.(txt|csv|json|xml|html|css|js|ts|md)$/i.test(fileName)) {
                    return (
                      <div className="h-full p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-[70vh] overflow-auto">
                          <div className="p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                              Loading text content...
                            </div>
                            <pre
                              className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed"
                              ref={(el) => {
                                if (el && !el.dataset.loaded) {
                                  el.dataset.loaded = 'true';
                                  fetch(filePreview.url)
                                    .then(response => {
                                      if (!response.ok) throw new Error('Failed to fetch');
                                      return response.text();
                                    })
                                    .then(text => {
                                      el.textContent = text;
                                      const parent = el.parentElement;
                                      if (parent) {
                                        const loadingDiv = parent.querySelector('div');
                                        if (loadingDiv) loadingDiv.remove();
                                      }
                                    })
                                    .catch(() => {
                                      el.textContent = 'Unable to load file content. Please download to view.';
                                      const parent = el.parentElement;
                                      if (parent) {
                                        const loadingDiv = parent.querySelector('div');
                                        if (loadingDiv) loadingDiv.remove();
                                      }
                                    });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // For video files
                  if (mimeType.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(fileName)) {
                    return (
                      <div className="h-full flex items-center justify-center p-4">
                        <video
                          controls
                          className="max-w-full max-h-[70vh] rounded-md border border-slate-200 dark:border-slate-700 bg-black"
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="text-center text-slate-500 dark:text-slate-400"><p>Unable to load video preview</p><p class="text-sm mt-2">Please download to view the file</p></div>';
                            }
                          }}
                        >
                          <source src={filePreview.url} />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    );
                  }

                  // For audio files
                  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|aac)$/i.test(fileName)) {
                    return (
                      <div className="h-full flex items-center justify-center p-4">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                            <FileIcon name={filePreview.name} type={filePreview.type} size={60} />
                          </div>
                          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
                            {filePreview.name}
                          </h3>
                          <audio
                            controls
                            className="mb-4"
                            onError={(e) => {
                              const target = e.target as HTMLAudioElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'text-slate-500 dark:text-slate-400 text-sm';
                                errorDiv.textContent = 'Unable to load audio preview. Please download to play the file.';
                                parent.appendChild(errorDiv);
                              }
                            }}
                          >
                            <source src={filePreview.url} />
                            Your browser does not support the audio tag.
                          </audio>
                        </div>
                      </div>
                    );
                  }

                  // Default fallback for unsupported file types
                  return (
                    <div className="text-center text-slate-500 dark:text-slate-400">
                      <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <FileIcon name={filePreview.name} type={filePreview.type} size={60} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                        {filePreview.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Preview not available for this file type
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {filePreview.type} {sizeKB ? `• ${sizeKB} KB` : ""}
                      </div>
                      <button
                        onClick={() => downloadFile(filePreview)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Download to View
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
