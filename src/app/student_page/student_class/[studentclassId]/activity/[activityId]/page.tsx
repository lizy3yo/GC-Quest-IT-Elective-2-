"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { studentApi, type StudentClassDetails } from '@/lib/api/student';
import { useAuth } from '@/hooks/useAuth';
import Alert from "@/components/ui/alert_template/Alert";
import LoadingTemplate2 from '@/components/ui/loading_template_2/loading2';

interface Activity {
  id: string;
  title: string;
  dueDate: string;
  // teacher-set total points (new canonical field)
  totalPoints?: number;
  // legacy field
  points?: number;
  submittedAt?: string;
  status: "submitted" | "late" | "missing";
  description?: string;
  postedAt?: string;
}

interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

type SubmissionStatus = "submitted" | "late" | "missing";

export default function ActivityDetailPage({ 
  params 
}: { 
  params: Promise<{ studentclassId: string; activityId: string }> 
}) {
  const router = useRouter();
  const [classDetails, setClassDetails] = useState<StudentClassDetails | null>(null);
  const [instructorDetail, setInstructorDetail] = useState<{ name?: string; email?: string; avatar?: string } | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentclassId, setStudentclassId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  
  // Alert state for user feedback
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
  
  // Submission state
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [submissionComment, setSubmissionComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [uploadedFileUrls, setUploadedFileUrls] = useState<any[]>([]);
  const [teacherAttachments, setTeacherAttachments] = useState<any[]>([]);
  const [resourcePreview, setResourcePreview] = useState<AttachmentMeta | null>(null);
  const [isEditingSubmission, setIsEditingSubmission] = useState(false);
  
  // Comment state
  const [commentText, setCommentText] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  const { user } = useAuth();

  // Helper: format date as 'MonthName Day, Year hh:mm AM/PM'
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
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

  useEffect(() => {
    const unwrap = async () => {
      const p = await params;
      setStudentclassId(p.studentclassId);
      setActivityId(p.activityId);
    };
    unwrap();
  }, [params]);

  useEffect(() => {
    if (!studentclassId || !activityId) return;
    fetchActivityDetails();
    fetchExistingSubmission();
  }, [studentclassId, activityId]);
  const fetchExistingSubmission = async () => {
    if (!studentclassId || !activityId) return;
    
    try {
      console.log('🔍 Fetching submission for:', { studentclassId, activityId });
      
      const response = await fetch(`/api/student_page/class/${studentclassId}/activity/${activityId}/submit`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      const result = await response.json();
      console.log('📋 Fetch submission result:', result);
      
      if (result.success) {
        // Update submission data
        if (result.data.submission) {
          console.log('✅ Found submission:', result.data.submission);
          setExistingSubmission(result.data.submission);
          setUploadedFileUrls(result.data.submission.files || []);
          setSubmissionComment(result.data.submission.comment || '');
          console.log('📁 Setting uploaded files:', result.data.submission.files || []);
        } else {
          console.log('❌ No submission found in response');
          setExistingSubmission(null);
          setUploadedFileUrls([]);
        }
        
        // Update teacher attachments
        if (result.data.teacherAttachments) {
          setTeacherAttachments(result.data.teacherAttachments);
        }
        
        // Update activity info from assessment if available
        // Merge activityInfo fields returned by the submission endpoint (e.g. instructions, totalPoints)
        if (result.data.activityInfo) {
          const info: any = result.data.activityInfo;
          setActivity(prev => {
            // If we already have activity details, merge; otherwise create a minimal activity object
            if (prev) {
              return {
                ...prev,
                description: info.instructions || prev.description,
                // if API provided canonical totalPoints, apply it
                totalPoints: (info.totalPoints !== undefined && info.totalPoints !== null) ? info.totalPoints : prev.totalPoints
              };
            }

            // Minimal activity fallback so UI can show totalPoints even if fetchActivityDetails hasn't completed
            return {
              id: activityId,
              title: info.title || 'Activity',
              dueDate: '', // typed as string in Activity
              totalPoints: (info.totalPoints !== undefined && info.totalPoints !== null) ? info.totalPoints : undefined,
              points: undefined,
              status: 'missing'
            } as Activity;
          });
        }
      } else {
        console.log('❌ API returned error:', result.error);
      }
    } catch (error) {
      console.error('Error fetching existing submission:', error);
    }
  };

  const fetchActivityDetails = async () => {
    if (!studentclassId || !activityId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First, get the class detail with activities
      const response = await studentApi.getClassDetails(studentclassId, true);
      
      if (response.success && response.data) {
        setClassDetails(response.data.class);
        
        // Find the specific activity
        const activities = response.data.class.activities || [];
        const foundActivity = activities.find(
          (act: Activity) => act.id === activityId
        );
        if (foundActivity) {
          setActivity(foundActivity);
        } else {
          setError('Activity not found');
        }
        
        // Get teacher info from the working class list API since the class detail API has instructor issues
        try {
          const classListResponse = await studentApi.getClasses();
          if (classListResponse.success && classListResponse.data?.classes) {
            const matchingClass = classListResponse.data.classes.find(
              (cls: any) => cls._id === studentclassId
            ) as any; // Cast to any since the API returns different structure than TypeScript interface
            if (matchingClass && matchingClass.teacher) {
              console.log('✅ Found teacher from class list API:', matchingClass.teacher);
              setInstructorDetail({
                name: matchingClass.teacher,
                email: '' // Class list API doesn't include email
              });
            } else {
              console.log('❌ No matching class or teacher found in class list');
              setInstructorDetail({ name: 'Unknown Instructor', email: '' });
            }
          } else {
            console.log('❌ Class list API failed');
            setInstructorDetail({ name: 'Unknown Instructor', email: '' });
          }
        } catch (classListError) {
          console.error('Error fetching class list for teacher info:', classListError);
          setInstructorDetail({ name: 'Unknown Instructor', email: '' });
        }
      } else {
        setError(response.error || 'Failed to load activity details');
      }
    } catch (err) {
      console.error('Error fetching activity details:', err);
      setError('Failed to load activity details');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await processFiles(files);
      
      // Reset the input
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSubmissionFiles(prev => prev.filter((_, i) => i !== index));
    showAlert({ 
      type: 'info', 
      message: 'File removed from submission.',
      autoClose: true,
      autoCloseDelay: 2000
    });
  };

  const removeUploadedFile = async (index: number) => {
    if (!window.confirm('Are you sure you want to remove this file?')) {
      return;
    }

    try {
      showAlert({ 
        type: 'info', 
        message: 'Removing file...',
        autoClose: false 
      });

      const response = await fetch(
        `/api/student_page/class/${studentclassId}/activity/${activityId}/submit?fileIndex=${index}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      const result = await response.json();

      if (result.success) {
        // Refresh the submission data
        await fetchExistingSubmission();
        showAlert({ 
          type: 'success', 
          message: 'File removed successfully.',
          autoClose: true,
          autoCloseDelay: 3000
        });
      } else {
        throw new Error(result.error || 'Failed to remove file');
      }
    } catch (error) {
      console.error('Error removing file:', error);
      showAlert({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Failed to remove file. Please try again.',
        autoClose: true,
        autoCloseDelay: 5000
      });
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Process the dropped files the same way as file input
    await processFiles(files);
  };

  // Extract file processing logic into a separate function
  const processFiles = async (files: File[]) => {
    // Validate files before upload
    const validFiles: File[] = [];
    for (const file of files) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        showAlert({ type: 'error', message: `File "${file.name}" is too large. Maximum size is 10MB.` });
        continue;
      }
      
      // Enhanced file type checking to match teacher side
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
        showAlert({ 
          type: 'error', 
          message: `File "${file.name}" is not a supported file type. Please use PDF, Word, Excel, PowerPoint, image, or text files.` 
        });
        continue;
      }

      // Check file name length
      if (file.name.length > 255) {
        showAlert({ type: 'error', message: `File name "${file.name}" is too long. Please use a shorter filename.` });
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      setSubmissionFiles(prev => [...prev, ...validFiles]);
      showAlert({ 
        type: 'success', 
        message: `${validFiles.length} file(s) added successfully.`,
        autoClose: true,
        autoCloseDelay: 3000
      });
    }
  };

  // Function to download teacher attachments using secure endpoint (consistent with student class page)
  const downloadAttachment = async (attachment: { name: string; url: string; type: string; size?: number }, index?: number) => {
    if (!attachment.url || !studentclassId || !activityId) {
      showAlert({ type: 'error', message: 'Unable to download this attachment - missing required information' });
      return;
    }

    try {
      showAlert({ type: 'info', message: 'Downloading attachment...', autoClose: true, autoCloseDelay: 3000 });
      
      // Use the attachment index as the primary identifier
      let attachmentId = '';
      if (typeof index === 'number') {
        attachmentId = index.toString();
      } else {
        // Fallback: Extract attachment ID from URL or use a hash of the URL
        if (attachment.url.includes('/')) {
          const urlParts = attachment.url.split('/');
          const filenamePart = urlParts[urlParts.length - 1];
          if (filenamePart) {
            // Remove extension and use as ID
            attachmentId = filenamePart.split('.')[0];
          }
        }
        
        // If we couldn't extract an ID, create a simple hash from the URL
        if (!attachmentId) {
          attachmentId = btoa(attachment.url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
        }
      }
      
      // Use the secure download endpoint
      const downloadUrl = `/api/student_page/class/${studentclassId}/activity/${activityId}/attachment/${attachmentId}/download`;
      console.log('Download URL:', downloadUrl);

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
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
          if (errorData.needsReupload) {
            showAlert({ 
              type: 'error', 
              message: `${errorData.error}\n\n${errorData.details}`,
              autoClose: true,
              autoCloseDelay: 8000
            });
            return;
          }

          // If server-side download failed but we have a cloudinaryUrl, try direct download with various fallback strategies
          if (errorData.cloudinaryUrl && attachment.url) {
            console.log('Server download failed, trying direct Cloudinary download');
            showAlert({ type: 'info', message: 'Attempting direct download from cloud storage...', autoClose: true, autoCloseDelay: 3000 });

            // Strategy 1: Try the original URL without any flags
            let directUrl = attachment.url;
            if (directUrl.includes('/upload/fl_attachment/')) {
              directUrl = directUrl.replace('/upload/fl_attachment/', '/upload/');
            }
            
            // Strategy 2: Try with signed URL approach (remove any existing transformations)
            if (directUrl.includes('/upload/')) {
              directUrl = directUrl.replace(/\/upload\/[^\/]*\//, '/upload/');
            }

            try {
              // Try fetching the file directly
              const directResponse = await fetch(directUrl, {
                method: 'GET',
                mode: 'no-cors', // This might help with CORS issues
              });
              
              // If that doesn't work, fall back to a simple link click
              const a = document.createElement("a");
              a.href = directUrl;
              a.download = normalizeAttachmentName(attachment.name) || attachment.name;
              a.target = "_blank"; // Open in new tab as fallback
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
              showAlert({ 
                type: 'success', 
                message: 'Download initiated. If it doesn\'t start, please check your downloads folder or try again.',
                autoClose: true,
                autoCloseDelay: 5000
              });
              return;
            } catch (directError) {
              console.log('Direct download also failed, trying new tab approach');
              
              // Final fallback: open in new tab
              window.open(directUrl, '_blank');
              showAlert({ 
                type: 'info', 
                message: 'Opened file in new tab. You may need to save it manually.',
                autoClose: true,
                autoCloseDelay: 5000
              });
              return;
            }
          }
        } catch (e) {
          // Not JSON, continue with generic error
          console.log('Error response is not JSON:', e);
        }

        throw new Error(`Download failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Create blob and download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

  // Ensure proper filename with extension and normalized
  let filename = normalizeAttachmentName(attachment.name) || attachment.name || 'attachment';
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
          'image/webp': '.webp',
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

      console.log('Download completed successfully');
      showAlert({ type: 'success', message: 'File downloaded successfully', autoClose: true, autoCloseDelay: 3000 });
    } catch (error) {
      console.error('Download error:', error);
      showAlert({ type: 'error', message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  // Function to preview teacher attachments in-app (modal) with authentication handling
  const previewAttachment = (attachment: { id?: string; name: string; url: string; type: string; size?: number }) => {
    if (attachment.url) {
      // Try to modify the URL for better compatibility with viewers
      let previewUrl = attachment.url;
      
      // For Cloudinary URLs, try to make them more accessible for preview
      if (previewUrl.includes('res.cloudinary.com')) {
        // Remove any existing fl_attachment flag for preview (we want inline display, not download)
        previewUrl = previewUrl.replace('/upload/fl_attachment/', '/upload/');
        
        // Add auto-optimization for better preview performance
        if (!previewUrl.includes('f_auto')) {
          previewUrl = previewUrl.replace('/upload/', '/upload/f_auto,q_auto/');
        }
      }
      
      // open in-app preview modal (use normalized name so numeric prefixes are hidden)
      setResourcePreview({
        id: attachment.id || attachment.url,
        name: normalizeAttachmentName(attachment.name) || attachment.name,
        size: attachment.size || 0,
        type: attachment.type,
        url: previewUrl
      });
    } else {
      showAlert({ type: 'error', message: 'Unable to preview this attachment' });
    }
  };

  const handleSubmit = async () => {
    if (submissionFiles.length === 0) {
      showAlert({ type: 'warning', message: "Please upload at least one file before submitting." });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Show progress for file uploads
      showAlert({ 
        type: 'info', 
        message: `Uploading ${submissionFiles.length} file(s)...`,
        autoClose: false 
      });
      
      // Upload files to Cloudinary first
      const uploadedFiles = [];
      
      for (let i = 0; i < submissionFiles.length; i++) {
        const file = submissionFiles[i];
        
        // Update progress for multiple files
        if (submissionFiles.length > 1) {
          showAlert({ 
            type: 'info', 
            message: `Uploading file ${i + 1} of ${submissionFiles.length}: ${file.name}`,
            autoClose: false 
          });
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch('/api/upload-file', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.success) {
          throw new Error(`Failed to upload ${file.name}: ${uploadResult.error || 'Unknown error'}`);
        }
        
        uploadedFiles.push({
          name: file.name,
          url: uploadResult.data.url,
          type: file.type,
          size: file.size,
          cloudinaryPublicId: uploadResult.data.public_id
        });
      }
      
      // Show submission progress
      showAlert({ 
        type: 'info', 
        message: 'Submitting assignment...',
        autoClose: false 
      });
      
      // Now submit the assignment with uploaded file URLs
      const submissionData = {
        files: uploadedFiles,
        comment: submissionComment
      };
      
      const submissionResponse = await fetch(`/api/student_page/class/${studentclassId}/activity/${activityId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(submissionData)
      });
      
      if (!submissionResponse.ok) {
        // Try to get error details from response
        let errorDetails = `HTTP ${submissionResponse.status}`;
        try {
          const errorData = await submissionResponse.json();
          errorDetails = errorData.details || errorData.error || errorDetails;
          console.error('API Error Details:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', e);
        }
        throw new Error(`Submission failed: ${errorDetails}`);
      }
      
      const submissionResult = await submissionResponse.json();
      
      if (!submissionResult.success) {
        throw new Error(submissionResult.error || submissionResult.details || 'Failed to submit assignment');
      }
      
      showAlert({ 
        type: 'success', 
        message: 'Assignment submitted successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      
      // Clear the file selection state since files are now submitted
      setSubmissionFiles([]);
      setSubmissionComment('');
      
      // Refresh the submission data to show the uploaded files
      await fetchExistingSubmission();
      
      // Also refresh activity details to get updated status
      await fetchActivityDetails();
      
      // If we were editing, exit edit mode
      if (isEditingSubmission) {
        setIsEditingSubmission(false);
        showAlert({ 
          type: 'success', 
          message: 'Files added to submission successfully!',
          autoClose: true,
          autoCloseDelay: 3000
        });
      } else {
        // Small delay before navigation to allow user to see success message and updated UI
        setTimeout(() => {
          router.back();
        }, 2500);
      }
      
    } catch (error) {
      console.error('Submission error:', error);
      
      // Provide detailed error messages based on error type
      let errorMessage = "Failed to submit assignment. Please try again.";
      let errorDetails = "";
      
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        if (error.message.includes('Network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('upload')) {
          errorMessage = `File upload failed: ${error.message}`;
        } else if (error.message.includes('size')) {
          errorMessage = "One or more files are too large. Please use files under 10MB.";
        } else if (error.message.includes('fetch')) {
          errorMessage = "Connection error. Please check your internet connection.";
        } else {
          errorMessage = error.message;
          errorDetails = `Error type: ${error.name}`;
        }
      }
      
      showAlert({ 
        type: 'error', 
        message: `${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`,
        autoClose: false // Don't auto-close error messages for debugging
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await processCommentFiles(files);
      
      // Reset the input
      e.target.value = '';
    }
  };

  // Process comment files (separate from submission files)
  const processCommentFiles = async (files: File[]) => {
    // Validate files before upload
    const validFiles: File[] = [];
    for (const file of files) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        showAlert({ type: 'error', message: `File "${file.name}" is too large. Maximum size is 10MB.` });
        continue;
      }
      
      // Enhanced file type checking to match teacher side
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
        showAlert({ 
          type: 'error', 
          message: `File "${file.name}" is not a supported file type. Please use PDF, Word, Excel, PowerPoint, image, or text files.` 
        });
        continue;
      }

      // Check file name length
      if (file.name.length > 255) {
        showAlert({ type: 'error', message: `File name "${file.name}" is too long. Please use a shorter filename.` });
        continue;
      }
      
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      setCommentFiles(prev => [...prev, ...validFiles]);
      showAlert({ 
        type: 'success', 
        message: `${validFiles.length} file(s) added successfully.`,
        autoClose: true,
        autoCloseDelay: 3000
      });
    }
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
    showAlert({ 
      type: 'info', 
      message: 'File removed successfully.',
      autoClose: true,
      autoCloseDelay: 2000
    });
  };

  const handlePostComment = async () => {
    if (!commentText.trim() && commentFiles.length === 0) {
      showAlert({ type: 'warning', message: "Please enter a comment or attach a file." });
      return;
    }

    setIsPostingComment(true);
    
    try {
      // Show progress for file uploads
      if (commentFiles.length > 0) {
        showAlert({ 
          type: 'info', 
          message: `Uploading ${commentFiles.length} file(s)...`,
          autoClose: false 
        });
      }
      
      // Upload files to Cloudinary first
      const uploadedFiles = [];
      
      for (let i = 0; i < commentFiles.length; i++) {
        const file = commentFiles[i];
        
        // Update progress for multiple files
        if (commentFiles.length > 1) {
          showAlert({ 
            type: 'info', 
            message: `Uploading file ${i + 1} of ${commentFiles.length}: ${file.name}`,
            autoClose: false 
          });
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch('/api/upload-file', {
          method: 'POST',
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed for ${file.name}: ${uploadResponse.statusText}`);
        }
        
        const uploadResult = await uploadResponse.json();
        
        if (!uploadResult.success) {
          throw new Error(`Failed to upload ${file.name}: ${uploadResult.error || 'Unknown error'}`);
        }
        
        uploadedFiles.push({
          name: file.name,
          url: uploadResult.data.url,
          type: file.type,
          size: file.size,
          cloudinaryPublicId: uploadResult.data.public_id
        });
      }
      
      // Show posting progress
      showAlert({ 
        type: 'info', 
        message: 'Posting comment...',
        autoClose: false 
      });
      
      // Post comment with attachments
      const commentData = {
        text: commentText.trim(),
        attachments: uploadedFiles
      };
      
      const commentResponse = await fetch(`/api/student_page/class/${studentclassId}/activity/${activityId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(commentData)
      });
      
      if (!commentResponse.ok) {
        throw new Error(`Comment posting failed: ${commentResponse.statusText}`);
      }
      
      const commentResult = await commentResponse.json();
      
      if (!commentResult.success) {
        throw new Error(commentResult.error || 'Failed to post comment');
      }
      
      // Clear comment form
      setCommentText("");
      setCommentFiles([]);
      
      showAlert({ 
        type: 'success', 
        message: 'Comment posted successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      
      // Optionally refresh comments or update state
      // You might want to fetch comments here to show the new comment
      
    } catch (error) {
      console.error('Comment posting error:', error);
      
      // Provide detailed error messages based on error type
      let errorMessage = "Failed to post comment. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('Network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('upload')) {
          errorMessage = `File upload failed: ${error.message}`;
        } else if (error.message.includes('size')) {
          errorMessage = "One or more files are too large. Please use files under 10MB.";
        } else {
          errorMessage = error.message;
        }
      }
      
      showAlert({ 
        type: 'error', 
        message: errorMessage,
        autoClose: true,
        autoCloseDelay: 5000
      });
    } finally {
      setIsPostingComment(false);
    }
  };

  const statusMeta = (status: SubmissionStatus) => {
    switch (status) {
      case "submitted":
        return { label: "Submitted", color: "bg-[#1C2B1C]/10 text-[#1C2B1C] dark:bg-[#1C2B1C]/30 dark:text-[#1C2B1C]", icon: "✅" };
      case "late":
        return { label: "Late", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: "⏰" };
      case "missing":
      default:
        return { label: "No Submission", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", icon: "❌" };
    }
  };

  // File type icon component using public/icons (consistent with student class page)
  const FileIcon = ({ name, type, size = 40 }: { name?: string; type?: string; size?: number }) => {
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
  };

  // Normalize attachment/file display names by removing numeric or timestamp prefixes
  // Examples:
  // "20231010-Assignment.pdf" -> "Assignment.pdf"
  // "1696444800000_assignment.pdf" -> "assignment.pdf"
  // "00123-MyFile.docx" -> "MyFile.docx"
  // "file (1).pdf" -> "file.pdf"
  const normalizeAttachmentName = (rawName?: string) => {
    if (!rawName) return '';

    // Trim whitespace
    let name = rawName.trim();

    // If the name contains path separators, keep only the basename
    name = name.split(/[\\/]+/).pop() || name;

    // 1) Strip leading numeric sequences followed by -, _, space or dot (common timestamps and indexes)
    name = name.replace(/^[0-9]{2,}[-_\s\.]+/, '');

    // 2) Strip long numeric prefixes (e.g., epoch ms timestamps) followed by non-alphanumeric
    name = name.replace(/^[0-9]{10,}[^a-zA-Z0-9]+/, '');

    // 3) Remove trailing copy/index patterns before the extension: "file (1).pdf", "file-1.pdf", "file 1.pdf"
    name = name.replace(/(\s*\(\d+\))(?=\.[^.]+$)/, '');
    name = name.replace(/([-_ ]\d+)(?=\.[^.]+$)/, '');

    // 4) Collapse multiple separators into single spaces and trim
    name = name.replace(/^[\-_.\s]+|[\-_.\s]+$/g, '');
    name = name.replace(/[\-_.\s]{2,}/g, ' ');

    // 5) If result is empty or still only digits, fall back to a safe generic name preserving extension
    if (!name || /^[0-9]+(\.[a-z0-9]+)?$/i.test(name)) {
      const extMatch = rawName.match(/(\.[a-z0-9]+)$/i);
      const ext = extMatch ? extMatch[1] : '';
      return `attachment${ext}`;
    }

    return name;
  };

  if (loading) return <LoadingTemplate2 title="Loading activity details…" />;

  if (error || !activity) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">Error loading activity</div>
          <div className="text-slate-600 dark:text-slate-300 text-sm">{error || "Activity not found"}</div>
          <button 
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const status = statusMeta(activity.status);

  // Derived score and max values (prefer canonical fields)
  const derivedScore: number | null = existingSubmission ? (existingSubmission.score ?? existingSubmission.grade ?? null) : null;
  // Prefer submission.maxScore when available (teacher may set max per submission), otherwise fall back to activity totalPoints -> legacy points -> 100
  const derivedMax: number = existingSubmission && (existingSubmission.maxScore !== undefined && existingSubmission.maxScore !== null)
    ? existingSubmission.maxScore
    : (activity ? (activity.totalPoints ?? activity.points ?? 100) : 100);

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
        {/* Top row removed as requested */}

        {/* Header */}
        {/* Class Banner (matches design) */}
        <div className="mb-6">
          <div className="bg-[#0F2415] text-white rounded-lg p-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="text-sm opacity-90 px-3 py-1 bg-[#15321f] rounded-full">{classDetails?.classCode}</div>
                <div className="text-sm opacity-90 px-3 py-1 bg-[#15321f] rounded-full">{classDetails?.schedule}</div>
              </div>
              <h1 className="text-2xl font-semibold mt-3">{classDetails?.name || activity.title}</h1>
              <div className="text-sm opacity-80 mt-1">Instructor: {classDetails?.instructor?.name || instructorDetail?.name || 'Unknown'}</div>
            </div>
            <div className="flex items-center gap-3">
              {/* Show settings for teacher or admin */}
              {user && (user.role === 'teacher' || user.role === 'admin' || user.email === classDetails?.instructor?.email) ? (
                <button className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm">Settings</button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-medium">Back</span>
          </button>
          
          {/* Debug buttons removed per request */}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Submission Area */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Your Work</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {(existingSubmission && uploadedFileUrls.length > 0) ? 
                        `${uploadedFileUrls.length} file(s) submitted` : 
                        submissionFiles.length > 0 ? 
                          `${submissionFiles.length} file(s) ready to submit` : 
                          "No files yet"
                      }
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex flex-col items-end gap-2">
                    {/* Submission Status */}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      !existingSubmission ? 
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                      existingSubmission && existingSubmission.submittedAt && activity.dueDate ?
                        new Date(existingSubmission.submittedAt) <= new Date(activity.dueDate) ?
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        existingSubmission ?
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {!existingSubmission ? 
                        'Pending' :
                      existingSubmission && existingSubmission.submittedAt && activity.dueDate ?
                        new Date(existingSubmission.submittedAt) <= new Date(activity.dueDate) ?
                          'On Time' : 'Late' :
                        existingSubmission ? 'On Time' : 'No Submission'
                      }
                    </div>
                    
                    {/* Score Display */}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      derivedScore != null ?
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {derivedScore != null ?
                          `Score: ${Number(derivedScore)}/${Number(derivedMax)}` :
                          'Score: Pending'
                        }
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                {/* Check if we have any submitted files */}
                {(() => {
                  console.log('🖥️ Render check:', { 
                    existingSubmission: !!existingSubmission, 
                    uploadedFileUrls: uploadedFileUrls.length, 
                    activityStatus: activity.status,
                    submissionFiles: submissionFiles.length 
                  });
                  return null;
                })()}
                
                {(existingSubmission || uploadedFileUrls.length > 0 || activity.status === "submitted") ? (
                  <div className="space-y-4">
                    {/* Submitted Files Display */}
                    <div className="space-y-3">
                      {(uploadedFileUrls && uploadedFileUrls.length > 0) ? uploadedFileUrls.map((file: any, index: number) => {
                        // Determine extension and mime-based icon
                        const rawName = file.name || '';
                        const maybeExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : undefined;
                        const mime = (file.type || '').toLowerCase();

                        // Pick a short badge label based on extension or MIME type (PDF, DOC, XLS, PPT, IMG, FILE)
                        const ext = maybeExt;
                        let badge = 'FILE';
                        if (ext) {
                          if (ext === 'pdf') badge = 'PDF';
                          else if (['doc', 'docx'].includes(ext)) badge = 'DOC';
                          else if (['xls', 'xlsx'].includes(ext)) badge = 'XLS';
                          else if (['ppt', 'pptx'].includes(ext)) badge = 'PPT';
                          else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) badge = 'IMG';
                          else badge = ext.toUpperCase().slice(0, 4);
                        } else if (mime.includes('pdf')) badge = 'PDF';
                        else if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) badge = 'DOC';
                        else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml')) badge = 'XLS';
                        else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('officedocument.presentationml')) badge = 'PPT';
                        else if (mime.startsWith('image/')) badge = 'IMG';

                        // Color map for primary fill per type
                        const colorMap: Record<string,string> = {
                          pdf: '#E11D48', // red
                          doc: '#0284C7', // blue
                          xls: '#16A34A', // green
                          ppt: '#F97316', // orange
                          img: '#7C3AED', // purple
                          file: '#64748B' // gray
                        };
                        const key = badge.toLowerCase();
                        const fill = colorMap[key] || colorMap['file'];
                        const fold = 'rgba(255,255,255,0.18)';

                        return (
                          <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                            <div className="w-12 h-12 rounded flex items-center justify-center">
                              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <rect x="0" y="0" width="48" height="48" rx="8" fill={fill} />
                                <path d="M34 0V14H48" transform="translate(-6,8)" fill={fold} opacity="0.9" />
                                <rect x="4" y="4" width="40" height="40" rx="6" fill="none" />
                                <text x="24" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif">{badge}</text>
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-medium text-slate-700 dark:text-slate-200 truncate">
                                {normalizeAttachmentName(file.name)}
                              </div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {file.size ? `${Math.round(file.size / 1024)} KB` : ''}
                              </div>
                              <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                ✓ Submitted
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditingSubmission && (
                                <button
                                  onClick={() => removeUploadedFile(index)}
                                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                  title="Remove file"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                          <div className="text-lg mb-2">📄</div>
                          <div className="text-sm">No files found in submission</div>
                        </div>
                      )}
                    </div>
                    
                    {/* File Upload Area - Show when editing */}
                    {isEditingSubmission && (
                      <div className="space-y-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Add more files:</div>
                        
                        {/* File Upload Area */}
                        <div 
                          className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                            id="edit-file-upload"
                          />
                          <label
                            htmlFor="edit-file-upload"
                            className="cursor-pointer block"
                          >
                            <div className="text-3xl mb-2">📁</div>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                              Add more files
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              or drag and drop
                            </div>
                          </label>
                        </div>

                        {/* Selected Files List - for new files being added */}
                        {submissionFiles.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">New files to add:</div>
                            {submissionFiles.map((file, index) => (
                              <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="w-10 h-10 rounded flex items-center justify-center">
                                  <FileIcon name={file.name} type={file.type} size={40} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {normalizeAttachmentName(file.name)}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {(file.size / 1024).toFixed(1)} KB
                                  </div>
                                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    ⏳ Ready to submit
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeFile(index)}
                                  className="text-slate-400 hover:text-red-500 text-lg font-bold w-8 h-8 flex items-center justify-center"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            
                            {/* Submit new files button */}
                            <div className="flex justify-end">
                              <button
                                onClick={handleSubmit}
                                disabled={submissionFiles.length === 0 || isSubmitting}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isSubmitting ? "Adding files..." : `Add ${submissionFiles.length} file(s)`}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-end items-center">
                      {!isEditingSubmission ? (
                        <button
                          onClick={() => setIsEditingSubmission(true)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                        >
                          ✏️ Edit submission
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setIsEditingSubmission(false)}
                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => setIsEditingSubmission(false)}
                            className="text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                          >
                            Done Editing
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* File Upload Area */}
                    <div 
                      className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer block"
                      >
                        <div className="text-4xl mb-3">�</div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                          Add files
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          or drag and drop
                        </div>
                      </label>
                    </div>

                    {/* Selected Files List */}
                    {submissionFiles.length > 0 && (
                      <div className="space-y-3">
                        {submissionFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                            <div className="w-10 h-10 rounded flex items-center justify-center">
                              <FileIcon name={file.name} type={file.type} size={40} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                {normalizeAttachmentName(file.name)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {(file.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="text-slate-400 hover:text-red-500 text-lg font-bold w-8 h-8 flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Private comment removed as requested */}

                    {/* Turn In Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmit}
                        disabled={submissionFiles.length === 0 || isSubmitting}
                        className="px-6 py-2 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSubmitting ? "Submitting..." : "Turn in"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Activity Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Header Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                      {activity.title}
                    </h1>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      <div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">Instructor:</div>
                        <div className="text-sm text-slate-800 dark:text-slate-100">{classDetails?.instructor?.name || instructorDetail?.name || 'Unknown'}</div>
                      </div>
                      <div className="mt-2 flex items-center gap-6">
                        <div className="text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-200">Date Posted:</span>
                          <span className="ml-1 text-slate-600 dark:text-slate-300">{formatDate(activity.postedAt) || "Aug 29, 2025 5:30 PM"}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-200">Due date:</span>
                          <span className="ml-1 text-slate-600 dark:text-slate-300">{formatDate(activity.dueDate) || "Sep 01, 2025 12:00 PM"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-slate-700 dark:text-slate-200 mb-6">
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">Instructions:</div>
                  <div className="text-sm">
                    {(() => {
                      const matchingAssessment = classDetails?.assessments?.find((assessment: any) => assessment.id === activity.id);
                      const instructions = matchingAssessment?.instructions || activity.description || "Upload your group slides (PDF) for feedback.";
                      return instructions;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Attachments</div>
              </div>
              <div className="p-6">
                {teacherAttachments.length === 0 ? (
                  <div className="space-y-3">
                    {/* Default attachment from photo */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                        <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                          PDF
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-medium text-slate-700 dark:text-slate-200">
                          Rubric.pdf
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          240 KB
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">
                          <span className="text-lg">⬇️</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teacherAttachments.map((attachment: any, index: number) => {
                      // Determine extension and mime-based icon
                      const rawName = attachment.name || '';
                      const maybeExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : undefined;
                      const mime = (attachment.type || '').toLowerCase();

                      const getFileTypeColor = (fileName: string) => {
                        const ext = (fileName && fileName.includes('.')) ? fileName.split('.').pop()?.toLowerCase() : maybeExt;
                        switch (ext) {
                          case 'pdf':
                            return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
                          case 'doc':
                          case 'docx':
                            return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
                          case 'ppt':
                          case 'pptx':
                            return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
                          case 'xls':
                          case 'xlsx':
                            return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
                          case 'jpg':
                          case 'jpeg':
                          case 'png':
                          case 'gif':
                            return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                          default:
                            return 'bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300';
                        }
                      };

                      // Pick a short badge label based on extension or MIME type (PDF, DOC, XLS, PPT, IMG, FILE)
                      const ext = maybeExt;
                      let badge = 'FILE';
                      if (ext) {
                        if (ext === 'pdf') badge = 'PDF';
                        else if (['doc', 'docx'].includes(ext)) badge = 'DOC';
                        else if (['xls', 'xlsx'].includes(ext)) badge = 'XLS';
                        else if (['ppt', 'pptx'].includes(ext)) badge = 'PPT';
                        else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) badge = 'IMG';
                        else badge = ext.toUpperCase().slice(0, 4);
                      } else if (mime.includes('pdf')) badge = 'PDF';
                      else if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) badge = 'DOC';
                      else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml')) badge = 'XLS';
                      else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('officedocument.presentationml')) badge = 'PPT';
                      else if (mime.startsWith('image/')) badge = 'IMG';

                      // Color map for primary fill per type
                      const colorMap: Record<string,string> = {
                        pdf: '#E11D48', // red
                        doc: '#0284C7', // blue
                        xls: '#16A34A', // green
                        ppt: '#F97316', // orange
                        img: '#7C3AED', // purple
                        file: '#64748B' // gray
                      };
                      const key = badge.toLowerCase();
                      const fill = colorMap[key] || colorMap['file'];
                      const fold = 'rgba(255,255,255,0.18)';

                      return (
                        <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                          <div className="w-12 h-12 rounded flex items-center justify-center">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                              <rect x="0" y="0" width="48" height="48" rx="8" fill={fill} />
                              <path d="M34 0V14H48" transform="translate(-6,8)" fill={fold} opacity="0.9" />
                              <rect x="4" y="4" width="40" height="40" rx="6" fill="none" />
                              <text x="24" y="30" textAnchor="middle" fontSize="12" fontWeight="700" fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif">{badge}</text>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-base font-medium text-slate-700 dark:text-slate-200 truncate">
                              {normalizeAttachmentName(attachment.name)}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => previewAttachment(attachment)}
                              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              title="Preview file"
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => downloadAttachment(attachment, index)}
                              className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                              title="Download file"
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Comments</div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  No comments yet. Be first to comment.
                </div>
              </div>
              
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      rows={3}
                      className="w-full text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/50 resize-y"
                    />
                    
                    {/* Comment Files List */}
                    {commentFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {commentFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border">
                            <div className="w-8 h-8 rounded flex items-center justify-center">
                              <FileIcon name={file.name} type={file.type} size={32} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {normalizeAttachmentName(file.name)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {(file.size / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <button
                              onClick={() => removeCommentFile(index)}
                              className="text-slate-400 hover:text-red-500 text-sm font-bold w-6 h-6 flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 cursor-pointer text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
                            className="hidden"
                            onChange={handleCommentFileUpload}
                          />
                          📎 Attach Files
                        </label>
                      </div>
                      <button 
                        onClick={handlePostComment}
                        disabled={(!commentText.trim() && commentFiles.length === 0) || isPostingComment}
                        className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isPostingComment ? "Posting..." : "Comment"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {resourcePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResourcePreview(null)} />
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate pr-4">{resourcePreview.name}</div>
              <button
                onClick={() => setResourcePreview(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
              {(() => {
                const mimeType = resourcePreview.type?.toLowerCase() || '';
                const fileName = resourcePreview.name?.toLowerCase() || '';
                const fileUrl = resourcePreview.url;

                // For images, try direct display first
                if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName)) {
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <img
                        src={fileUrl}
                        alt={resourcePreview.name}
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
                            title={resourcePreview.name}
                            src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(fileUrl)}`}
                            className="w-full h-full border-none rounded-md"
                            onError={() => {
                              // Fallback to Google Docs viewer
                              const iframe = document.querySelector(`iframe[title="${resourcePreview.name}"]`) as HTMLIFrameElement;
                              if (iframe) {
                                iframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
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
                            title={resourcePreview.name}
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
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
                                fetch(fileUrl)
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
                        <source src={fileUrl} />
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
                        <div className="w-24 h-24 mx-auto mb-4 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <audio
                          controls
                          className="w-full max-w-md"
                          onError={(e) => {
                            const target = e.target as HTMLAudioElement;
                            target.style.display = 'none';
                            const parent = target.parentElement?.parentElement;
                            if (parent) {
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'text-center text-slate-500 dark:text-slate-400';
                              errorDiv.innerHTML = '<p>Unable to load audio preview</p><p class="text-sm mt-2">Please download to play the file</p>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                        >
                          <source src={fileUrl} />
                          Your browser does not support the audio tag.
                        </audio>
                      </div>
                    </div>
                  );
                }

                // Fallback for all other file types
                return (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                      <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <FileIcon name={resourcePreview.name} type={resourcePreview.type} size={60} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                        {resourcePreview.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Preview not available for this file type
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {resourcePreview.type} {resourcePreview.size ? `• ${Math.round(resourcePreview.size / 1024)} KB` : ""}
                      </div>
                      <button
                        onClick={() => downloadAttachment({ name: resourcePreview.name, url: resourcePreview.url, type: resourcePreview.type, size: resourcePreview.size })}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Download to View
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Description section - optional field that may be available for some attachments */}
              {false && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-medium">Description:</span> {/* description would go here */}
                  </p>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="text-xxs text-slate-500 dark:text-slate-400">
                {resourcePreview.type} {resourcePreview.size ? `• ${Math.round(resourcePreview.size / 1024)} KB` : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadAttachment({ name: resourcePreview.name, url: resourcePreview.url, type: resourcePreview.type, size: resourcePreview.size })}
                  className="text-xxs px-3 py-1 rounded-md bg-teal-500 text-white hover:bg-teal-600"
                >
                  Download
                </button>
                <button
                  onClick={() => setResourcePreview(null)}
                  className="text-xxs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Resource preview modal JSX inserted after main component
// (keeps file-scoped helper state and uses setResourcePreview above)

// Attach the modal to the main component by rendering conditionally near the end of file
// We keep this render outside the main return to avoid refactoring large JSX; the main component
// will reference `resourcePreview` and `setResourcePreview` from closure via top-level state.
// To hook it up, we render the modal inside the component's returned JSX by placing the element
// where `resourcePreview` is in scope. However, TSX files allow function components anywhere.