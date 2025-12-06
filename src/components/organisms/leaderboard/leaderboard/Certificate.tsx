"use client";

import React, { useRef } from 'react';

interface CertificateProps {
  studentName: string;
  rank: number;
  totalPoints: number;
  averageScore: number;
  assessmentsCompleted: number;
  period: string;
  date: string;
  onClose: () => void;
}

export default function Certificate({
  studentName,
  rank,
  totalPoints,
  averageScore,
  assessmentsCompleted,
  period,
  date,
  onClose
}: CertificateProps) {
  const certificateRef = useRef<HTMLDivElement>(null);

  const getRankText = (rank: number) => {
    if (rank === 1) return 'First Place';
    if (rank === 2) return 'Second Place';
    if (rank === 3) return 'Third Place';
    return `${rank}th Place`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FDB022'; // Gold/Yellow
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return '#64748b';
  };

  const handleDownload = () => {
    // Use print dialog which allows saving as PDF
    // This works because the browser's print engine handles oklch/lab() colors natively
    // User can select "Save as PDF" in the print dialog
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {/* Action Buttons */}
        <div className="flex justify-end gap-2 p-4 border-b print:hidden">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-[#2E7D32] text-white rounded-lg hover:bg-[#1B5E20] transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Save as PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
          >
            ✕ Close
          </button>
        </div>

        {/* Certificate Content */}
        <div
          ref={certificateRef}
          id="certificate-content"
          className="p-12"
          style={{
            background: '#FFFEF5',
            minHeight: '600px'
          }}
        >
          {/* Triple Border Frame */}
          <div 
            className="relative"
            style={{ 
              border: `6px solid ${getRankColor(rank)}`,
              padding: '8px',
              background: '#FFFEF5'
            }}
          >
            <div 
              style={{ 
                border: `2px solid ${getRankColor(rank)}`,
                padding: '8px'
              }}
            >
              <div 
                style={{ 
                  border: `2px solid ${getRankColor(rank)}`,
                  padding: '48px 64px',
                  background: '#FFFEF5'
                }}
              >
                {/* Medal Icon */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Blue ribbon */}
                      <path d="M20 8 L28 28 L20 28 L16 48 L24 32 L28 32 L32 8 Z" fill="#3B82F6"/>
                      <path d="M44 8 L36 28 L44 28 L48 48 L40 32 L36 32 L32 8 Z" fill="#3B82F6"/>
                      {/* Gold medal */}
                      <circle cx="32" cy="40" r="16" fill={getRankColor(rank)}/>
                      <circle cx="32" cy="40" r="13" fill={getRankColor(rank)} opacity="0.8"/>
                      {/* Number */}
                      <text x="32" y="47" fontSize="16" fontWeight="bold" fill="white" textAnchor="middle">{rank}</text>
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                  <h1 
                    className="text-5xl font-bold mb-2"
                    style={{ color: getRankColor(rank) }}
                  >
                    Certificate of Achievement
                  </h1>
                  <p 
                    className="text-xl font-semibold"
                    style={{ color: getRankColor(rank) }}
                  >
                    {period}
                  </p>
                  <div 
                    className="w-32 h-1 mx-auto mt-3"
                    style={{ backgroundColor: getRankColor(rank) }}
                  ></div>
                </div>

                {/* Certify Text */}
                <p className="text-center text-slate-400 italic text-lg mb-8">
                  This is to certify that
                </p>

                {/* Student Name */}
                <div className="text-center mb-8">
                  <h2 
                    className="text-5xl font-bold inline-block pb-2"
                    style={{ 
                      color: '#1e293b',
                      borderBottom: '3px solid #cbd5e1',
                      paddingLeft: '32px',
                      paddingRight: '32px'
                    }}
                  >
                    {studentName}
                  </h2>
                </div>

                {/* Achievement Text */}
                <div className="text-center mb-10">
                  <p className="text-lg text-slate-600 mb-2">
                    has achieved <span className="font-bold text-xl" style={{ color: getRankColor(rank) }}>{getRankText(rank)}</span>
                  </p>
                  <p className="text-base text-slate-500">
                    in the {period} Leaderboard
                  </p>
                </div>

                {/* Stats Boxes */}
                <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-12">
                  <div className="bg-slate-50 rounded-lg p-6 text-center border border-slate-200">
                    <div 
                      className="text-4xl font-bold mb-1"
                      style={{ color: getRankColor(rank) }}
                    >
                      {totalPoints}
                    </div>
                    <div className="text-sm text-slate-600">Total Points</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-6 text-center border border-slate-200">
                    <div 
                      className="text-4xl font-bold mb-1"
                      style={{ color: getRankColor(rank) }}
                    >
                      {averageScore}%
                    </div>
                    <div className="text-sm text-slate-600">Average Score</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-6 text-center border border-slate-200">
                    <div 
                      className="text-4xl font-bold mb-1"
                      style={{ color: getRankColor(rank) }}
                    >
                      {assessmentsCompleted}
                    </div>
                    <div className="text-sm text-slate-600">Completed</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t-2 border-slate-200 pt-8 mt-12">
                  <div className="flex justify-between items-end">
                    {/* Date */}
                    <div className="text-center">
                      <div className="border-t-2 border-slate-400 pt-2 w-48">
                        <p className="text-sm text-slate-600">Date</p>
                        <p className="font-semibold text-slate-900">{date}</p>
                      </div>
                    </div>

                    {/* Trophy */}
                    <div className="text-6xl">
                      🏆
                    </div>

                    {/* Signature */}
                    <div className="text-center">
                      <div className="border-t-2 border-slate-400 pt-2 w-48">
                        <p className="text-sm text-slate-600">Authorized Signature</p>
                        <p className="font-semibold italic text-slate-900">Teacher</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seal */}
                <div className="text-center mt-8">
                  <div 
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl"
                    style={{ 
                      border: `3px dashed ${getRankColor(rank)}`,
                      backgroundColor: `${getRankColor(rank)}20`
                    }}
                  >
                    ⭐
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          #certificate-content,
          #certificate-content * {
            visibility: visible;
          }
          #certificate-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
