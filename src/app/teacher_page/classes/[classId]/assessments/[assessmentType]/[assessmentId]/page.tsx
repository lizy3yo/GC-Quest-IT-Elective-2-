"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assessmentApi, classApi } from "@/lib/api/teacher";
import { authManager } from "@/utils/auth";

// --- StudentList inline implementation ---
type Student = {
  studentId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username?: string;
  enrolledAt?: string;
  status?: string;
  submittedAt?: string | null; // ISO date when student submitted
};

function formatDateShort(d?: Date | null) {
  if (!d) return "-";
  // show date and time without seconds for cleaner UI (e.g. "Oct 1, 2025, 12:17 PM")
  try {
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch (e) {
    // fallback
    return d.toLocaleString();
  }
}

function StudentList({ assessmentId, classId, dueDate, makeStudentHref, totalPoints }: { assessmentId: string; classId: string; dueDate: Date | null; makeStudentHref?: (studentId: string) => string; totalPoints?: number }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [savingScores, setSavingScores] = useState<Set<string>>(new Set());

  // Fetch students from API
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch students and submissions in parallel using authenticated requests
        const [studentsResponse, submissionsResponse] = await Promise.all([
          authManager.makeAuthenticatedRequest(`/api/teacher_page/class/${classId}/students`),
          authManager.makeAuthenticatedRequest(`/api/teacher_page/assessment/${assessmentId}/student-status`)
        ]);
        
        if (studentsResponse.ok) {
          const studentsData = await studentsResponse.json();
          if (studentsData.success && studentsData.data?.students) {
            setStudents(studentsData.data.students);
          }
        } else {
          console.error('Failed to fetch students:', studentsResponse.statusText);
        }

        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          if (submissionsData.success && submissionsData.data?.submissions) {
            // Convert submissions array to object for easier lookup
            const submissionsMap: Record<string, any> = {};
            const scoresMap: Record<string, number | null> = {};
            
            submissionsData.data.submissions.forEach((submission: any) => {
              submissionsMap[submission.studentId] = submission;
              scoresMap[submission.studentId] = submission.score;
            });
            
            setSubmissions(submissionsMap);
            setScores(scoresMap);
          } else {
            // No submissions yet - this is normal for new assessments
            setSubmissions({});
            setScores({});
          }
        } else {
          console.error('Failed to fetch submissions:', submissionsResponse.statusText);
          // Set empty data for graceful degradation
          setSubmissions({});
          setScores({});
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [classId, assessmentId]);

  async function setScoreFor(studentId: string, value: string) {
    const num = value === "" ? null : Math.max(0, Math.min(100, Number(value)));
    
    // Update local state immediately for responsive UI
    setScores(prev => ({ ...prev, [studentId]: num }));
    
    // Save to API if score is valid
    if (num !== null && !isNaN(num)) {
      setSavingScores(prev => new Set(prev).add(studentId));
      
      try {
        const response = await authManager.makeAuthenticatedRequest(`/api/teacher_page/assessment/${assessmentId}/student-status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            studentId,
            score: num
          })
        });

        if (!response.ok) {
          console.error('Failed to save score:', response.statusText);
          // Could revert the local state here if needed
        }
      } catch (error) {
        console.error('Error saving score:', error);
        // Could revert the local state here if needed
      } finally {
        setSavingScores(prev => {
          const next = new Set(prev);
          next.delete(studentId);
          return next;
        });
      }
    }
  }

  function getFullName(student: Student): string {
    const firstName = student.firstName || '';
    const lastName = student.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Student';
  }

  function getInitials(student: Student): string {
    const firstName = student.firstName || '';
    const lastName = student.lastName || '';
    const initials = (firstName[0] || '') + (lastName[0] || '');
    return initials.toUpperCase() || '??';
  }

  function getSubmissionStatus(student: Student): 'Missing' | 'Late' | 'Turned in' {
    const submission = submissions[student.studentId];
    if (!submission) return 'Missing';
    
    if (submission.status === 'late') return 'Late';
    return 'Turned in';
  }

  function getSubmissionDate(student: Student): Date | null {
    const submission = submissions[student.studentId];
    return submission ? new Date(submission.submittedAt) : null;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-1"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {students.map((s) => {
        const status = getSubmissionStatus(s);
        const submissionDate = getSubmissionDate(s);
        const score = scores[s.studentId] ?? null;
        const graded = score !== null && !Number.isNaN(score);
        const isSaving = savingScores.has(s.studentId);

        return (
          <div key={s.studentId} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold">
                {getInitials(s)}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{getFullName(s)}</div>
                <div className="text-xs text-slate-500 truncate">{s.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <div className="relative">
                  <input
                    aria-label={`Score for ${getFullName(s)}`}
                    value={score === null ? "" : String(score)}
                    onChange={(e) => setScoreFor(s.studentId, e.target.value)}
                    placeholder="--"
                    className="w-20 text-sm px-2 py-1 border rounded-md bg-slate-50 dark:bg-slate-700/50 text-right cursor-not-allowed"
                    disabled={isSaving}
                    readOnly
                  />
                  {isSaving && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 border border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-400">/{totalPoints ?? 100}</div>
              </div>

              <div className="hidden sm:flex flex-col text-right text-xs text-slate-500">
                <div>{submissionDate ? formatDateShort(submissionDate) : "-"}</div>
                <div className="text-slate-400">Due: {dueDate ? formatDateShort(dueDate) : "-"}</div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs rounded-full ${status === 'Missing' ? 'bg-rose-50 text-rose-700' : status === 'Late' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {status}
                </span>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">{graded ? <span className="text-emerald-700 font-medium">Graded</span> : <span>Not graded</span>}</div>
                  {makeStudentHref ? (
                    <Link 
                      href={makeStudentHref(s.studentId)} 
                      className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title="View submission"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </Link>
                  ) : (
                    <span className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500" title="View submission">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {students.length === 0 && !loading && (
        <div className="text-sm text-slate-500 text-center py-4">
          No students enrolled in this class yet.
        </div>
      )}
    </div>
  );
}

// --- end StudentList ---

type Params = {
  params: Promise<{
    class: string;
    classId: string;
    assessmentType: string;
    assessmentId: string;
  }>;
};

type Assessment = {
  _id?: string;
  id?: string;
  title: string;
  type?: string;
  category?: string;
  format?: "online" | "file_submission";
  questions?: number;
  createdAt?: string;
  published?: boolean;
  description?: string;
  timeLimitMins?: number;
  dueDate?: string;
  totalPoints?: number;
  instructions?: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
};

export default function AssessmentPage({ params }: Params) {
  // Next.js passes `params` as a Promise in Next.js 15. Use React.use() to unwrap it.
  const resolvedParams = (React as any).use(params);
  const { class: classRoute, classId, assessmentType, assessmentId } = resolvedParams;
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    dueDate: '',
    dueTime: '',
    instructions: '',
    attachments: [] as Array<{ name: string; url: string; type: string; size?: number }>,
    // totalPoints stored as string for controlled numeric input; empty string means unspecified
    totalPoints: '' as string
  });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchAssessment() {
      try {
        setLoading(true);
        setStatusMsg(null);

        // Fetch assessment data from API
        const response = await assessmentApi.getAssessment(assessmentId);
        
        if (!response.success || !response.data) {
          setStatusMsg(response.error || "Failed to load assessment");
          setAssessment(null);
          return;
        }

        const fetchedAssessment = response.data.assessment;
        
        // Validate assessment type matches URL parameter
        const param = (assessmentType || "").toString().toLowerCase();
        const fetchedCategory = (fetchedAssessment.category || "").toString().toLowerCase();
        const fetchedType = (fetchedAssessment.type || "").toString().toLowerCase();

        // Accept common aliases: mcq <-> quiz, activity <-> task
        const aliasMap: Record<string, string[]> = {
          mcq: ["mcq", "quiz"],
          quiz: ["quiz", "mcq"],
          exam: ["exam"],
          activity: ["activity", "task"],
          task: ["task", "activity"],
        };

        const allowed = aliasMap[param] ?? [param];
        const matches = allowed.some((t) => t === fetchedCategory || t === fetchedType);

        if (!matches) {
          setStatusMsg(`This item is type ${fetchedAssessment.category || fetchedAssessment.type || "Unknown"}. Expected '${assessmentType}'.`);
          setAssessment(null);
          return;
        }

        setAssessment({
          id: fetchedAssessment._id || assessmentId,
          title: fetchedAssessment.title,
          type: fetchedAssessment.type,
          category: fetchedAssessment.category,
          format: fetchedAssessment.format,
          questions: Array.isArray(fetchedAssessment.questions) ? fetchedAssessment.questions.length : 0,
          createdAt: fetchedAssessment.createdAt ? (typeof fetchedAssessment.createdAt === 'string' ? fetchedAssessment.createdAt : fetchedAssessment.createdAt.toISOString()) : undefined,
          published: fetchedAssessment.published,
          description: fetchedAssessment.description,
          timeLimitMins: fetchedAssessment.timeLimitMins,
          dueDate: fetchedAssessment.dueDate ? (typeof fetchedAssessment.dueDate === 'string' ? fetchedAssessment.dueDate : fetchedAssessment.dueDate.toISOString()) : undefined,
          totalPoints: fetchedAssessment.totalPoints,
          instructions: fetchedAssessment.instructions,
          attachments: fetchedAssessment.attachments,
        });

        // Initialize edit form with current data
        setEditForm({
          title: fetchedAssessment.title || '',
          dueDate: fetchedAssessment.dueDate ? (typeof fetchedAssessment.dueDate === 'string' ? fetchedAssessment.dueDate.split('T')[0] : fetchedAssessment.dueDate.toISOString().split('T')[0]) : '',
          dueTime: fetchedAssessment.dueDate ? (typeof fetchedAssessment.dueDate === 'string' ? fetchedAssessment.dueDate.split('T')[1]?.slice(0, 5) || '' : fetchedAssessment.dueDate.toISOString().split('T')[1]?.slice(0, 5) || '') : '',
          instructions: fetchedAssessment.instructions || fetchedAssessment.description || '',
          attachments: fetchedAssessment.attachments || [],
          // store as string for controlled input; empty string if not provided
          totalPoints: (fetchedAssessment.totalPoints !== undefined && fetchedAssessment.totalPoints !== null) ? String(fetchedAssessment.totalPoints) : ''
        });
        
      } catch (error) {
        console.error("Error fetching assessment:", error);
        setStatusMsg("Error loading assessment data");
        setAssessment(null);
      } finally {
        setLoading(false);
      }
    }

    fetchAssessment();
  }, [assessmentId, assessmentType]);

  // Function to handle editing the assessment
  const handleEditAssessment = () => {
    // Open the edit modal instead of navigating away
    setIsEditModalOpen(true);
  };

  // Function to handle saving edited assessment
  const handleSaveEditedAssessment = async () => {
    if (!assessment) return;
    
    // Basic validation
    if (!editForm.title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      setSaving(true);
      
      // Prepare the update payload
      const updateData = {
        title: editForm.title.trim(),
        instructions: editForm.instructions.trim(),
        dueDate: (editForm.dueDate && editForm.dueTime) ? new Date(`${editForm.dueDate}T${editForm.dueTime}`) : editForm.dueDate ? new Date(editForm.dueDate) : undefined,
        attachments: editForm.attachments,
        // Include totalPoints if the field is provided and is a valid non-negative number
        totalPoints: (editForm.totalPoints !== undefined && editForm.totalPoints !== '') ? Math.max(0, Number(editForm.totalPoints)) : undefined
      };

      // Call assessment API to update
      const response = await assessmentApi.updateAssessment(assessmentId, updateData);
      
      if (response.success) {
        // Update local state with new data
        setAssessment(prev => prev ? {
          ...prev,
          title: updateData.title,
          instructions: updateData.instructions,
          dueDate: updateData.dueDate ? updateData.dueDate.toISOString() : undefined,
          attachments: updateData.attachments,
          totalPoints: updateData.totalPoints !== undefined ? updateData.totalPoints : prev.totalPoints
        } : null);
        
        setIsEditModalOpen(false);
        setStatusMsg('Assessment updated successfully');
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        throw new Error(response.error || 'Failed to update assessment');
      }
    } catch (error) {
      console.error('Error updating assessment:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Validation function for attachments (consistent with resources tab and create modal)
  const validateAttachment = (file: File): string | null => {
    if (!file) return null;
    
    // Check file size (10MB limit to match Cloudinary free plan and be consistent with resources)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      return `File size is ${fileSizeMB}MB. Maximum allowed size is 10MB. Please compress your file or choose a smaller one.`;
    }
    
    // Check file name length (consistent with resources tab)
    if (file.name.length > 255) {
      return 'File name is too long. Please rename your file to be less than 255 characters.';
    }
    
    // Enhanced file type validation (consistent with resources validation)
    const allowedTypes = [
      'application/pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 
      'image/png', 
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv'
    ];
    
    // Also check file extensions as fallback
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return 'Only PDF, Word, Excel, PowerPoint, image, text, or CSV files are allowed.';
    }
    
    return null;
  };

  // Function to handle adding an attachment (consistent with resources tab pattern)
  const handleAddAttachment = async () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = false;
    fileInput.accept = '*/*'; // Accept all file types
    
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // Pre-validate file size to give immediate feedback (consistent with resources tab)
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
          setStatusMsg(`Upload failed: File size is ${fileSizeMB}MB. Maximum allowed size is 10MB. Please compress your file or choose a smaller one.`);
          setTimeout(() => setStatusMsg(null), 8000);
          return;
        }
        
        // Validate the file first
        const validationError = validateAttachment(file);
        if (validationError) {
          setStatusMsg(`Upload failed: ${validationError}`);
          setTimeout(() => setStatusMsg(null), 8000);
          return;
        }

        try {
          // Show loading state with consistent messaging
          setStatusMsg('Uploading attachment...');
          
          // Upload file to Cloudinary
          const formData = new FormData();
          formData.append('file', file);
          
          const uploadResponse = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData
          });
          
          const uploadResult = await uploadResponse.json();
          
          if (!uploadResult.success) {
            const errorMessage = uploadResult.error || 'Failed to upload attachment';
            const errorDetails = uploadResult.details ? ` ${uploadResult.details}` : '';
            throw new Error(errorMessage + errorDetails);
          }
          
          // sanitize the MIME type: remove any charset or params and cap length to 50 chars
          const rawType = (file.type || '').toString();
          const mimeOnly = rawType.split(';')[0].trim();
          const safeType = (mimeOnly && mimeOnly.length > 0) ? mimeOnly.slice(0, 50) : 'application/octet-stream';
          
          // Add the uploaded file to attachments
          setEditForm(prev => ({
            ...prev,
            attachments: [...prev.attachments, { 
              name: uploadResult.data.display_name || file.name,
              url: uploadResult.data.url,
              type: safeType,
              size: uploadResult.data.bytes || file.size
            }]
          }));
          
          setStatusMsg('Attachment uploaded successfully');
          setTimeout(() => setStatusMsg(null), 3000);
          
        } catch (error) {
          console.error('Error uploading attachment:', error);
          
          // Enhanced error handling consistent with resources tab
          let errorMessage = 'Failed to upload attachment';
          let errorDetails = '';
          
          if (error instanceof Error) {
            console.error('Upload error details:', {
              name: error.name,
              message: error.message
            });
            
            if (error.message.includes('File size') || error.message.includes('size too large')) {
              errorMessage = 'File size too large';
              errorDetails = 'Maximum allowed size is 10MB. Please compress your file or choose a smaller one.';
            } else if (error.message.includes('File name') || error.message.includes('name too long')) {
              errorMessage = 'File name too long';
              errorDetails = 'Please rename your file to be less than 255 characters.';
            } else if (error.message.includes('file type') || error.message.includes('Invalid file type')) {
              errorMessage = 'Invalid file type';
              errorDetails = 'Please use PDF, Word, Excel, PowerPoint, image, text, or CSV files.';
            } else {
              errorMessage = error.message;
            }
          }
          
          setStatusMsg(`Upload failed: ${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`);
          setTimeout(() => setStatusMsg(null), 8000);
        }
      }
    };
    
    fileInput.click();
  };

  // Function to handle removing an attachment
  const handleRemoveAttachment = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  // Function to preview an attachment
  const previewAttachment = (attachment: { name: string; url: string; type: string; size?: number }) => {
    if (attachment.url) {
      // Open attachment in new tab for preview
      window.open(attachment.url, "_blank");
    } else {
      setStatusMsg('Unable to preview this attachment');
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Helper to normalize attachment display names by stripping leading numeric prefixes
  const normalizeAttachmentName = (name?: string | null) => {
    if (!name) return '';
    // Remove leading digits, timestamps and common separators like - _ .
    // Examples: "1759570523465-De_Jesus_File.pdf" -> "De_Jesus_File.pdf"
    return name.replace(/^[0-9]+[\s\-_\.]*/,'');
  };

  // Small helper to render file-type icon from public/icons (keeps parity with Activity page)
  const FileIcon = ({ name, type, size = 20 }: { name?: string; type?: string; size?: number }) => {
    const rawName = name || '';
    const maybeExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : undefined;
    const mime = (type || '').toLowerCase();

    let key = 'file-generic';
    if (maybeExt) {
      if (maybeExt === 'pdf') key = 'file-pdf';
      else if (['doc', 'docx'].includes(maybeExt)) key = 'file-doc';
      else if (['xls', 'xlsx', 'csv'].includes(maybeExt)) key = 'file-xls';
      else if (['ppt', 'pptx'].includes(maybeExt)) key = 'file-ppt';
      else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(maybeExt)) key = 'file-img';
      else key = 'file-generic';
    } else if (mime.includes('pdf')) key = 'file-pdf';
    else if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) key = 'file-doc';
    else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml')) key = 'file-xls';
    else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('officedocument.presentationml')) key = 'file-ppt';
    else if (mime.startsWith('image/')) key = 'file-img';

    const src = `/icons/${key}.svg`;
    return <img src={src} alt={`${maybeExt ? maybeExt.toUpperCase() : 'file'} icon`} width={size} height={size} />;
  };

  // Function to download an attachment
  const downloadAttachment = async (attachment: { name: string; url: string; type: string; size?: number }) => {
    if (!attachment.url) {
      setStatusMsg('Unable to download this attachment');
      setTimeout(() => setStatusMsg(null), 3000);
      return;
    }

    try {
      setStatusMsg('Downloading attachment...');
      
      // Try to download using a more direct approach that preserves filename
      const response = await fetch(attachment.url, {
        method: 'GET',
        headers: {
          'Accept': '*/*',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get the blob
      const blob = await response.blob();
      
      // Create download link with proper filename
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Ensure the filename has the correct extension
      let filename = attachment.name;
      if (!filename.includes('.') && attachment.type) {
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
        
        const extension = mimeToExt[attachment.type];
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
      
      setStatusMsg('Download completed successfully');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (error) {
      console.error('Download error:', error);
      
      // Fallback: try direct link
      try {
        const a = document.createElement("a");
        a.href = attachment.url;
        a.download = attachment.name;
        a.target = "_blank";
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setStatusMsg('Download opened in new tab');
        setTimeout(() => setStatusMsg(null), 3000);
      } catch (fallbackError) {
        setStatusMsg(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setTimeout(() => setStatusMsg(null), 5000);
      }
    }
  };

  // Function to handle publishing the assessment
  const handlePublishAssessment = async () => {
    if (!assessment) return;
    
    try {
      // Here you would implement the publish functionality
      // For now, we'll just show a placeholder alert
      alert('Publish functionality will be implemented here');
    } catch (error) {
      console.error('Error publishing assessment:', error);
      alert('Failed to publish assessment');
    }
  };



  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <nav className="text-sm text-slate-600 mb-2">
            <Link href={`/teacher_page/classes/${classId}`} className="underline">Back to class</Link>
            <span className="px-2">/</span>
            <span className="font-semibold">{assessment?.title || assessmentType}</span>
          </nav>

          <h1 className="text-2xl font-semibold">{assessment?.title || `${assessmentType.toUpperCase()} Assessment`}</h1>
          <p className="text-sm text-slate-500 mt-1">Overview and actions for this assessment.</p>
          <p className="text-sm text-slate-500 mt-1">Total points: {assessment?.totalPoints ?? 'Not specified'}</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-4">
            {loading && (
              <div className="p-4 border rounded-md bg-white dark:bg-slate-800">
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                  <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                </div>
              </div>
            )}

            {!loading && statusMsg && (
              <div className="p-4 border rounded-md bg-yellow-50 text-sm text-amber-800">{statusMsg}</div>
            )}

            {!loading && assessment ? (
              <>
                <div className="p-4 border rounded-md bg-white dark:bg-slate-800 relative">
                  {/* Requested compact summary layout: Title, Date Posted / Due date, Instruction, Attachments, Comments */}
                  <div className="flex items-start justify-between">
                    <h2 className="font-medium text-lg">{assessment.title || "Untitled"}</h2>

                    {/* Keep empty spacer - the compact edit control is positioned absolute at the top-right */}
                    <div aria-hidden className="ml-4"></div>
                  </div>

                  {/* Small floating Edit button (top-right) matching screenshot */}
                  <button
                    onClick={handleEditAssessment}
                    disabled={loading || !assessment}
                    aria-label="Edit assessment"
                    className="absolute top-3 right-3 inline-flex items-center gap-2 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path d="M17.414 2.586a2 2 0 010 2.828l-9.9 9.9a1 1 0 01-.464.263l-4 1a1 1 0 01-1.213-1.213l1-4a1 1 0 01.263-.464l9.9-9.9a2 2 0 012.828 0zM15.121 4.05L14 5.172 12.828 4 13.95 2.879a.5.5 0 01.707 0l.464.464a.5.5 0 010 .707z" />
                    </svg>
                    <span>Edit</span>
                  </button>

                  <div className="mt-3 text-sm text-slate-600 space-y-1">
                    <div>
                      <strong className="mr-2">Date Posted:</strong>
                      <span className="text-slate-500">{assessment.createdAt ? formatDateShort(new Date(assessment.createdAt)) : "-"}</span>
                    </div>
                    <div>
                      <strong className="mr-2">Due date:</strong>
                      <span className="text-slate-500">{assessment.dueDate ? formatDateShort(new Date(assessment.dueDate)) : assessment.timeLimitMins ? formatDateShort(new Date(new Date(assessment.createdAt || Date.now()).getTime() + assessment.timeLimitMins * 60000)) : "-"}</span>
                    </div>

                    <div>
                      <strong className="mr-2">Status:</strong>
                      <span className={`text-sm px-2 py-1 rounded ${assessment.published ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                        {assessment.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-medium">Instruction</h3>
                    <p className="text-sm text-slate-600 mt-2">{assessment.instructions || assessment.description || "No instructions provided"}</p>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-medium">Attachments</h3>
                    <div className="text-sm text-slate-600 mt-2">
                      {assessment.attachments && assessment.attachments.length > 0 ? (
                        <div className="space-y-2">
                          {assessment.attachments.map((attachment, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm">
                                  <FileIcon name={attachment.name} type={attachment.type} size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{normalizeAttachmentName(attachment.name)}</p>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded">{attachment.type || 'file'}</span>
                                    {attachment.size && <span>({(attachment.size / 1024).toFixed(1)} KB)</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Preview and Download buttons removed per request */}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-slate-500">No Attachments</div>
                      )}
                    </div>
                  </div>

                </div>

                <div className="p-4 border rounded-md bg-white dark:bg-slate-800">
  
                  <div className="mt-3">
                    <StudentList
                      assessmentId={assessmentId}
                      classId={classId}
                      dueDate={assessment.dueDate ? new Date(assessment.dueDate) : null}
                      totalPoints={assessment?.totalPoints}
                      makeStudentHref={(studentId) => {
                        // For quiz/exam: use old route /teacher_page/quiz/[quizId]/student/[studentId]
                        // For activity: use new route with /activity/
                        if (assessmentType === 'quiz' || assessmentType === 'exam') {
                          return `/teacher_page/${assessmentType}/${assessmentId}/student/${studentId}`;
                        }
                        // For activities, use the activity-specific route
                        // Always use 'classes' as the base path regardless of classRoute param value
                        return `/teacher_page/classes/${classId}/assessments/${assessmentType}/${assessmentId}/activity/${studentId}`;
                      }}
                    />
                  </div>
                </div>
              </>
            ) : !loading ? (
              <div className="p-4 border rounded-md bg-white dark:bg-slate-800">
                <h2 className="font-medium">No assessment data</h2>
                <p className="text-sm text-slate-600 mt-2">This assessment could not be found or you may not have permission to view it.</p>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4 md:col-span-1">
            {/* Quick actions card */}
            <div className="p-4 border rounded-md bg-white dark:bg-slate-800">
              <h3 className="font-medium">Quick Actions</h3>
              <div className="mt-3 grid gap-3">
                <button 
                  onClick={handlePublishAssessment}
                  disabled={loading || !assessment}
                  className="w-full px-4 py-2 rounded-md bg-teal-500 text-white hover:bg-teal-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                >
                  {assessment?.published ? 'Unpublish assessment' : 'Publish assessment'}
                </button>
                {/* Only show Edit assessment button for non-file submissions.
                    If the assessment is an online format, navigate to the full
                    form editor page (passes classId & assessmentId). Otherwise
                    open the inline edit modal (used for file-submission or other types). */}
                {assessment?.format !== 'file_submission' && (
                  assessment?.format === 'online' ? (
                    <button
                      onClick={() => router.push(`/teacher_page/assessment/create/form?classId=${classId}&assessmentId=${encodeURIComponent((assessment.id ?? assessmentId) as string)}`)}
                      disabled={loading || !assessment}
                      className="w-full px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    >
                      Edit assessment
                    </button>
                  ) : (
                    <button 
                      onClick={handleEditAssessment}
                      disabled={loading || !assessment}
                      className="w-full px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
                    >
                      Edit assessment
                    </button>
                  )
                )}
              </div>
            </div>
          </aside>
        </section>

        {/* Edit Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-xl w-full max-h-[88vh] overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit Assessment</h2>
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded"
                    aria-label="Close modal"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Title Field */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Title *</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                      placeholder="Enter assessment title"
                      required
                    />
                  </div>

                  {/* Due Date and Time Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Due Date</label>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(e) => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Due Time</label>
                      <input
                        type="time"
                        value={editForm.dueTime}
                        onChange={(e) => setEditForm(prev => ({ ...prev, dueTime: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        placeholder="HH:MM"
                      />
                    </div>
                  </div>

                  {/* Instructions Field */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Instructions</label>
                    <textarea
                      value={editForm.instructions}
                      onChange={(e) => setEditForm(prev => ({ ...prev, instructions: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
                      placeholder="Enter assessment instructions"
                    />
                  </div>

                  {/* Attachments Field */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Attachments</label>
                      <button
                        type="button"
                        onClick={handleAddAttachment}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add File
                      </button>
                    </div>
                    {editForm.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {editForm.attachments.map((attachment, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">
                                <FileIcon name={attachment.name} type={attachment.type} size={18} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{normalizeAttachmentName(attachment.name)}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded">{attachment.type || 'file'}</span>
                                  {attachment.size && <span>({(attachment.size / 1024).toFixed(1)} KB)</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Preview and Download buttons removed per request; keep Remove */}
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(index)}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium transition-colors px-2 py-1"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center border border-dashed border-slate-300 dark:border-slate-600 rounded-md">
                        No attachments added
                      </div>
                    )}
                  </div>

                  {/* Total Points Field */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Total points</label>
                      <input
                      type="number"
                      min={0}
                      value={(editForm as any).totalPoints}
                      onChange={(e) => setEditForm(prev => ({ ...prev, totalPoints: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      placeholder="Enter total points (leave blank to auto-calc)"
                    />
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={saving}
                    className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEditedAssessment}
                    disabled={saving || !editForm.title.trim()}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {saving && (
                      <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
