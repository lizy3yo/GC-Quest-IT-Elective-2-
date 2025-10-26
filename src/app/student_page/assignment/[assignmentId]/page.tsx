"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Assignment {
  id: string;
  title: string;
  instructor: string;
  datePosted: string;
  dueDate: string;
  description: string;
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
  folder?: string;
  filename?: string;
  status: 'not_submitted' | 'submitted' | 'late' | 'graded';
  grade?: number;
  maxPoints?: number;
  submittedAt?: string;
  submittedFiles?: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
  }[];
}

export default function StudentAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params?.assignmentId as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");

  // Mock assignment data based on the image
  useEffect(() => {
    // In a real app, this would fetch from an API
    const mockAssignment: Assignment = {
      id: assignmentId || "1",
      title: "Seatwork: Data Analytics Life Cycle",
      instructor: "Your Instructor",
      datePosted: "September 20, 2025 4:38 PM",
      dueDate: "October 3, 2025 11:59 PM",
      description: "As discussed during class",
      attachments: [
        {
          id: "1",
          name: "PM.png",
          url: "#",
          type: "image/png"
        }
      ],
      folder: "Laboratory",
      filename: "Lecture",
      status: "not_submitted",
      maxPoints: 100
    };

    // Simulate loading delay
    setTimeout(() => {
      setAssignment(mockAssignment);
      setLoading(false);
    }, 500);
  }, [assignmentId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file to submit.");
      return;
    }

    setUploading(true);
    
    try {
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update assignment status
      setAssignment(prev => prev ? {
        ...prev,
        status: 'submitted',
        submittedAt: new Date().toLocaleString(),
        submittedFiles: selectedFiles.map((file, index) => ({
          id: `file_${index}`,
          name: file.name,
          url: URL.createObjectURL(file),
          uploadedAt: new Date().toLocaleString()
        }))
      } : null);

      setSelectedFiles([]);
      setComment("");
      alert("Assignment submitted successfully!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to submit assignment. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-300">Loading assignment...</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-300">Assignment not found.</div>
      </div>
    );
  }

  const getStatusColor = (status: Assignment['status']) => {
    switch (status) {
      case 'submitted':
        return 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400';
      case 'late':
        return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400';
      case 'graded':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getStatusText = (status: Assignment['status']) => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'late':
        return 'Late Submission';
      case 'graded':
        return 'Graded';
      default:
        return 'Not Submitted';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {assignment.title}
              </h1>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-medium">Instructor:</span> {assignment.instructor}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assignment Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Assignment Info */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {assignment.title}
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                    <span><strong>Date Posted:</strong> {assignment.datePosted}</span>
                    <span><strong>Due date:</strong> {assignment.dueDate}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(assignment.status)}`}>
                  {getStatusText(assignment.status)}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Description</h3>
                  <p className="text-slate-600 dark:text-slate-300">{assignment.description}</p>
                </div>

                {assignment.folder && assignment.filename && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                    <div className="text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Folder:</span> {assignment.folder}
                    </div>
                    <div className="text-sm mt-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Filename:</span> {assignment.filename}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      https://DOST3NAS.quickconnect.to/d/s/154IIVRbaDYf8tcn7Fy2lnhhV7kFCJWs/ki29rEM0U0tRBykbpNkRCyaA6KYvUQ-ErOAyZPmQw
                    </div>
                  </div>
                )}

                {assignment.attachments && assignment.attachments.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Attachments</h3>
                    <div className="space-y-2">
                      {assignment.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                              <span className="text-white text-xs font-medium">PNG</span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {attachment.name}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button className="p-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submission Section */}
            {assignment.status !== 'submitted' && (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                  Your Work
                </h3>

                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Files Uploaded
                    </label>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                        accept="*/*"
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Attach file
                        </span>
                      </label>
                    </div>

                    {/* Selected Files */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Selected Files ({selectedFiles.length})
                        </div>
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                                <span className="text-white text-xs font-medium">
                                  {file.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {file.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Private comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment for your teacher..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSubmit}
                      disabled={uploading || selectedFiles.length === 0}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {uploading && (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {uploading ? 'Submitting...' : 'Turn in'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submitted Work */}
            {assignment.status === 'submitted' && assignment.submittedFiles && (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Submitted Work
                  </h3>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Submitted: {assignment.submittedAt}
                  </div>
                </div>

                <div className="space-y-2">
                  {assignment.submittedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-medium">
                          {file.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {file.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Uploaded: {file.uploadedAt}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assignment Status */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Status</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(assignment.status)}`}>
                    {getStatusText(assignment.status)}
                  </span>
                </div>
                {assignment.maxPoints && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Points:</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {assignment.grade ? `${assignment.grade}/${assignment.maxPoints}` : `Out of ${assignment.maxPoints}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Due:</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {assignment.dueDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Comments</h3>
              <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                No comments yet.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}