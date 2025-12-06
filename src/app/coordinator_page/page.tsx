"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import CoordinatorDashboard from "@/components/organisms/CoordinatorDashboard";
import { Users, GraduationCap, Book } from "lucide-react";

interface TeacherStats {
  id: string;
  name: string;
  email: string;
  totalClasses: number;
  totalQuizzes: number;
  totalExams: number;
  totalActivities: number;
  totalFlashcards: number;
  totalSummaries: number;
  archived?: boolean;
  archivedAt?: Date | null;
}

interface StudentStats {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  totalClasses: number;
  completedQuizzes: number;
  completedExams: number;
  completedActivities: number;
  studiedFlashcards: number;
  viewedSummaries: number;
  averageScore: number;
  archived?: boolean;
  archivedAt?: Date | null;
}

interface EmailGenerationData {
  userId: string;
  name: string;
  role: 'teacher' | 'student' | 'parent';
  studentNumber?: string;
  generatedEmail?: string;
}

interface ParentStats {
  id: string;
  name: string;
  email: string;
  linkedStudent?: {
    id: string;
    name: string;
    email: string;
    studentNumber?: string;
  } | null;
  archived?: boolean;
  archivedAt?: Date | null;
}


interface DashboardStats {
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  totalAssessments: number;
  totalResources: number;
  programDistribution: { name: string; count: number }[];
  subjectDistribution: { name: string; count: number }[];
  roleDistribution: { name: string; value: number }[];
  userGrowth: { date: string; teacher: number; student: number; parent: number }[];
  recentActivity: { type: 'user' | 'class'; role?: 'teacher' | 'student' | 'parent'; description: string; timestamp: Date }[];
}

// Helper function to get range label
const getRangeLabel = (range: string): string => {
  switch (range) {
    case '7d': return 'Last 7 Days';
    case '30d': return 'Last 30 Days';
    case '90d': return 'Last 90 Days';
    case '6m': return 'Last 6 Months';
    default: return range;
  }
};

// Helper function to convert SVG to PNG using canvas
const svgToPng = async (svgElement: SVGSVGElement, targetWidth: number, targetHeight: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;

      // Get the actual rendered dimensions from the element's bounding box
      const rect = svgElement.getBoundingClientRect();
      let svgWidth = rect.width;
      let svgHeight = rect.height;

      // Fallback to attributes if bounding box is not available
      if (svgWidth === 0 || svgHeight === 0) {
        svgWidth = parseFloat(svgElement.getAttribute('width') || '0');
        svgHeight = parseFloat(svgElement.getAttribute('height') || '0');
      }

      // Final fallback to target dimensions
      if (svgWidth === 0 || svgHeight === 0) {
        svgWidth = targetWidth;
        svgHeight = targetHeight;
      }

      // Preserve or set viewBox
      const existingViewBox = svgElement.getAttribute('viewBox');
      if (existingViewBox) {
        clonedSvg.setAttribute('viewBox', existingViewBox);
      } else {
        clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      }

      // Set explicit dimensions for rendering
      clonedSvg.setAttribute('width', svgWidth.toString());
      clonedSvg.setAttribute('height', svgHeight.toString());

      // Ensure all styles are inline for proper rendering
      const allElements = clonedSvg.querySelectorAll('*');
      allElements.forEach((el) => {
        if (el instanceof SVGElement) {
          const computedStyle = window.getComputedStyle(el);
          // Copy critical styles inline
          if (computedStyle.fill && computedStyle.fill !== 'none' && !el.getAttribute('fill')) {
            el.setAttribute('fill', computedStyle.fill);
          }
          if (computedStyle.stroke && computedStyle.stroke !== 'none' && !el.getAttribute('stroke')) {
            el.setAttribute('stroke', computedStyle.stroke);
          }
          if (computedStyle.strokeWidth && !el.getAttribute('stroke-width')) {
            el.setAttribute('stroke-width', computedStyle.strokeWidth);
          }
          if (computedStyle.opacity && computedStyle.opacity !== '1' && !el.getAttribute('opacity')) {
            el.setAttribute('opacity', computedStyle.opacity);
          }
        }
      });

      // Serialize SVG to string
      const svgString = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Create image from SVG
      const img = new Image();
      img.onload = () => {
        // Create canvas with target dimensions
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth * 2; // 2x for better quality
        canvas.height = targetHeight * 2;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the image to fill the entire canvas
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const pngDataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(pngDataUrl);
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };

      img.onerror = (err) => {
        console.error('Image load error:', err);
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };

      img.src = url;
    } catch (error) {
      console.error('SVG to PNG conversion error:', error);
      reject(error);
    }
  });
};

// PDF Export function
const exportToPDF = async (stats: DashboardStats, userGrowthRange: string) => {
  try {
    const jsPDF = (await import('jspdf')).default;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPos = margin;

    // Colors
    const primaryGreen = [5, 150, 105]; // #059669
    const darkGray = [31, 41, 55];
    const lightGray = [107, 114, 128];

    // ===== HEADER =====
    pdf.setFillColor(primaryGreen[0], primaryGreen[1], primaryGreen[2]);
    pdf.rect(0, 0, pageWidth, 35, 'F');

    pdf.setFontSize(24);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Coordinator Dashboard Report', margin, 20);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const now = new Date();
    pdf.text(`Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, margin, 28);

    yPos = 45;

    // ===== KEY METRICS SECTION =====
    pdf.setFontSize(14);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Key Metrics', margin, yPos);

    yPos += 8;

    // Metrics boxes
    const boxWidth = (contentWidth - 9) / 4; // Adjusted for 4 items
    const boxHeight = 25;
    const totalUsers = stats.roleDistribution.reduce((acc, curr) => acc + curr.value, 0);

    const metrics = [
      { label: 'Total Users', value: totalUsers, color: [96, 165, 250] }, // Blue
      { label: 'Classes', value: stats.totalClasses, color: [5, 150, 105] },
      { label: 'Assessments', value: stats.totalAssessments, color: [251, 191, 36] },
      { label: 'Resources', value: stats.totalResources, color: [167, 139, 250] }
    ];

    metrics.forEach((metric, i) => {
      const boxX = margin + (i * (boxWidth + 3));

      // Box background
      pdf.setFillColor(245, 245, 245);
      pdf.setDrawColor(229, 231, 235);
      pdf.roundedRect(boxX, yPos, boxWidth, boxHeight, 2, 2, 'FD');

      // Value
      pdf.setFontSize(18);
      pdf.setTextColor(metric.color[0], metric.color[1], metric.color[2]);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(metric.value), boxX + boxWidth / 2, yPos + 12, { align: 'center' });

      // Label
      pdf.setFontSize(8);
      pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.setFont('helvetica', 'normal');
      pdf.text(metric.label, boxX + boxWidth / 2, yPos + 20, { align: 'center' });
    });

    yPos += boxHeight + 15;

    // ===== CLASSES BY PROGRAM SECTION =====
    pdf.setFontSize(14);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Classes by Program', margin, yPos);

    yPos += 8;

    if (stats.programDistribution.length > 0) {
      stats.programDistribution.forEach((prog, i) => {
        const barMaxWidth = contentWidth - 50;
        const maxCount = Math.max(...stats.programDistribution.map(p => p.count));
        const barWidth = maxCount > 0 ? (prog.count / maxCount) * barMaxWidth : 0;

        // Program name
        pdf.setFontSize(10);
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        pdf.setFont('helvetica', 'normal');
        pdf.text(prog.name, margin, yPos + 5);

        // Bar
        pdf.setFillColor(5, 150, 105);
        pdf.roundedRect(margin + 25, yPos, barWidth, 6, 1, 1, 'F');

        // Count
        pdf.setFontSize(10);
        pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        pdf.text(String(prog.count), margin + 30 + barWidth, yPos + 5);

        yPos += 10;
      });
    } else {
      pdf.setFontSize(10);
      pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.text('No program data available', margin, yPos + 5);
      yPos += 10;
    }

    yPos += 10;

    // Check if we need a new page before pie chart section
    const pieChartHeight = 110; // Title + chart height
    if (yPos + pieChartHeight > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
    }

    // ===== USER DISTRIBUTION CHART (PIE CHART) =====
    pdf.setFontSize(14);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text('User Distribution', margin, yPos);

    yPos += 5;

    // Capture Pie Chart using SVG extraction
    const pieChartElement = document.getElementById('coordinator-pie-chart');
    console.log('Pie chart element found:', !!pieChartElement);

    if (pieChartElement) {
      try {
        // Small delay to ensure chart is fully rendered
        await new Promise(resolve => setTimeout(resolve, 100));

        // Find ALL SVG elements and pick the largest one (the actual chart, not icons)
        const allPieSvgs = Array.from(pieChartElement.querySelectorAll('svg'));

        // Find the largest SVG (the chart itself, not legend icons)
        let svgElement: SVGSVGElement | null = null;
        let maxArea = 0;

        allPieSvgs.forEach((svg) => {
          const rect = svg.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area > maxArea) {
            maxArea = area;
            svgElement = svg;
          }
        });

        if (svgElement) {
          // Use full width for better visibility
          const pieImgWidth = contentWidth;
          const pieImgHeight = 100;

          // Convert mm to pixels (1mm ≈ 3.78 pixels at 96 DPI)
          const pieImgData = await svgToPng(svgElement, pieImgWidth * 3.78, pieImgHeight * 3.78);
          pdf.addImage(pieImgData, 'PNG', margin, yPos, pieImgWidth, pieImgHeight);
          yPos += pieImgHeight + 5;
        } else {
          throw new Error('SVG element not found in pie chart');
        }
      } catch (err) {
        console.error('Failed to capture pie chart:', err);
        // Fallback to text-based representation
        yPos += 5;
        const roleColors: Record<string, number[]> = {
          'Teachers': [200, 111, 38],
          'Students': [96, 165, 250],
          'Parents': [167, 139, 250]
        };
        stats.roleDistribution.forEach((role) => {
          const color = roleColors[role.name] || [100, 100, 100];
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.circle(margin + 3, yPos + 2, 3, 'F');
          pdf.setFontSize(10);
          pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${role.name}: ${role.value}`, margin + 10, yPos + 4);
          yPos += 8;
        });
      }
    } else {
      console.warn('Pie chart element not found');
      // Fallback if chart element not found
      yPos += 5;
      const roleColors: Record<string, number[]> = {
        'Teachers': [200, 111, 38],
        'Students': [96, 165, 250],
        'Parents': [167, 139, 250]
      };
      stats.roleDistribution.forEach((role) => {
        const color = roleColors[role.name] || [100, 100, 100];
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.circle(margin + 3, yPos + 2, 3, 'F');
        pdf.setFontSize(10);
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${role.name}: ${role.value}`, margin + 10, yPos + 4);
        yPos += 8;
      });
    }

    yPos += 10;

    // Check if we need a new page before area chart section
    const areaChartHeight = 100; // Title + chart height + summary
    if (yPos + areaChartHeight > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
    }

    // ===== USER GROWTH CHART (AREA CHART) =====
    pdf.setFontSize(14);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`User Growth (${getRangeLabel(userGrowthRange)})`, margin, yPos);

    yPos += 5;

    // Capture Area Chart using SVG extraction
    const areaChartElement = document.getElementById('coordinator-area-chart');
    console.log('Area chart element found:', !!areaChartElement);
    if (areaChartElement) {
      try {

        // Small delay to ensure chart is fully rendered
        await new Promise(resolve => setTimeout(resolve, 200));

        // Find ALL SVG elements and pick the largest one (the actual chart, not icons)
        const allSvgs = Array.from(areaChartElement.querySelectorAll('svg'));
        console.log('Found SVG elements:', allSvgs.length);

        // Find the largest SVG (the chart itself, not legend icons)
        let svgElement: SVGSVGElement | null = null;
        let maxArea = 0;

        allSvgs.forEach((svg) => {
          const rect = svg.getBoundingClientRect();
          const area = rect.width * rect.height;
          console.log('SVG dimensions:', {
            width: rect.width,
            height: rect.height,
            area: area,
            viewBox: svg.getAttribute('viewBox')
          });
          if (area > maxArea) {
            maxArea = area;
            svgElement = svg;
          }
        });

        if (svgElement) {
          console.log('Selected SVG with area:', maxArea);

          const areaImgWidth = contentWidth;
          const areaImgHeight = 90; // Height for area chart in mm

          // Convert mm to pixels (1mm ≈ 3.78 pixels at 96 DPI)
          const targetWidthPx = areaImgWidth * 3.78;
          const targetHeightPx = areaImgHeight * 3.78;

          const areaImgData = await svgToPng(svgElement, targetWidthPx, targetHeightPx);
          pdf.addImage(areaImgData, 'PNG', margin, yPos, areaImgWidth, areaImgHeight);
          yPos += areaImgHeight + 2; // Reduced gap from 5 to 2
        } else {
          throw new Error('SVG element not found in area chart');
        }
      } catch (err) {
        console.error('Failed to capture area chart:', err);
      }
    } else {
      console.warn('Area chart element not found');
    }

    // Add summary totals (close to the chart)
    const teacherTotal = stats.userGrowth.reduce((sum, d) => sum + d.teacher, 0);
    const studentTotal = stats.userGrowth.reduce((sum, d) => sum + d.student, 0);
    const parentTotal = stats.userGrowth.reduce((sum, d) => sum + d.parent, 0);

    pdf.setFontSize(10);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`New Teachers: ${teacherTotal}  |  New Students: ${studentTotal}  |  New Parents: ${parentTotal}`, margin, yPos);

    yPos += 10;

    // Check if we need a new page before Recent Activity section
    const recentActivityMinHeight = 30; // Title + at least a few activities
    if (yPos + recentActivityMinHeight > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
    }

    // ===== RECENT ACTIVITY SECTION =====
    pdf.setFontSize(14);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Recent Activity', margin, yPos);

    yPos += 8;

    if (stats.recentActivity.length > 0) {
      const maxActivities = 10;
      stats.recentActivity.slice(0, maxActivities).forEach((activity) => {
        // Check if we need a new page (need space for activity item ~10mm)
        if (yPos > pageHeight - margin - 15) {
          pdf.addPage();
          yPos = margin;
        }

        const activityType = activity.type === 'user'
          ? `New ${activity.role ? activity.role.charAt(0).toUpperCase() + activity.role.slice(1) : 'User'} Registered`
          : 'New Class Created';

        const timestamp = new Date(activity.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Activity icon indicator
        const iconColor = activity.type === 'class' ? [5, 150, 105] :
          activity.role === 'teacher' ? [200, 111, 38] :
            activity.role === 'parent' ? [167, 139, 250] : [96, 165, 250];

        pdf.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
        pdf.circle(margin + 2, yPos + 2, 2, 'F');

        // Activity text
        pdf.setFontSize(9);
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        pdf.setFont('helvetica', 'bold');
        pdf.text(activityType, margin + 8, yPos + 3);

        pdf.setFont('helvetica', 'normal');
        pdf.text(`- ${activity.description}`, margin + 8 + pdf.getTextWidth(activityType) + 2, yPos + 3);

        // Timestamp
        pdf.setFontSize(8);
        pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        pdf.text(timestamp, pageWidth - margin, yPos + 3, { align: 'right' });

        yPos += 7;
      });

      if (stats.recentActivity.length > maxActivities) {
        pdf.setFontSize(8);
        pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
        pdf.text(`... and ${stats.recentActivity.length - maxActivities} more activities`, margin, yPos + 3);
      }
    } else {
      pdf.setFontSize(10);
      pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.text('No recent activity', margin, yPos + 4);
    }

    // ===== FOOTER =====
    pdf.setFontSize(8);
    pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    pdf.text('GC-Quest Coordinator Dashboard', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save the PDF
    const fileName = `coordinator-report-${now.toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Failed to generate PDF:', error);
    alert('Failed to export report. Please try again.');
  }
};

export default function CoordinatorPage() {
  const router = useRouter();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "teachers" | "students" | "parents" | "classes" | "emails" | "archives">("overview");

  const [emailSubTab, setEmailSubTab] = useState<"teacher-email" | "instructor-email" | "student-email" | "parent-email">("teacher-email");
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Email form states
  const [teacherFirstName, setTeacherFirstName] = useState("");
  const [teacherLastName, setTeacherLastName] = useState("");
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentStats | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Stats data
  const [teacherStats, setTeacherStats] = useState<TeacherStats[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);
  const [parentStats, setParentStats] = useState<ParentStats[]>([]);
  const [overviewStats, setOverviewStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalClasses: 0,
    totalAssessments: 0,
    totalResources: 0,
    programDistribution: [] as { name: string; count: number }[],
    subjectDistribution: [] as { name: string; count: number }[],
    roleDistribution: [] as { name: string; value: number }[],
    userGrowth: [] as { date: string; teacher: number; student: number; parent: number }[],
    recentActivity: [] as { type: 'user' | 'class'; description: string; timestamp: Date }[],
  });

  // Email generation
  const [emailList, setEmailList] = useState<EmailGenerationData[]>([]);
  const [generatingEmails, setGeneratingEmails] = useState(false);

  // Search and filters
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [parentSearch, setParentSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");

  // Filter states
  const [teacherFilter, setTeacherFilter] = useState<"all" | "active" | "mostClasses" | "mostAssessments">("all");
  const [studentFilter, setStudentFilter] = useState<"all" | "topPerformers" | "needsAttention" | "mostActive">("all");
  const [parentFilter, setParentFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [classFilter, setClassFilter] = useState<"all" | "active" | "mostStudents" | "program">("all");
  const [programFilter, setProgramFilter] = useState<"all" | "BSIT" | "BSCS" | "BSEMC">("all");
  const [userGrowthRange, setUserGrowthRange] = useState("7d");

  // Logout and Change Password modals
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Loading states for account creation
  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [creatingParent, setCreatingParent] = useState(false);

  // Class management states
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [classSubject, setClassSubject] = useState('');
  const [classProgram, setClassProgram] = useState('BSIT');
  const [classYear, setClassYear] = useState('1');
  const [classBlock, setClassBlock] = useState('A');
  const [classDescription, setClassDescription] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherStats | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [classDay, setClassDay] = useState<string[]>([]);
  const [classStartTime, setClassStartTime] = useState('');
  const [classEndTime, setClassEndTime] = useState('');
  const [classRoom, setClassRoom] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  // Ellipsis menu states
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    show: boolean;
    type: 'student' | 'teacher' | 'parent' | 'class' | null;
    id: string | null;
    name: string | null;
  }>({ show: false, type: null, id: null, name: null });
  const [archiveConfirmModal, setArchiveConfirmModal] = useState<{
    show: boolean;
    type: 'student' | 'teacher' | 'parent' | 'class' | null;
    id: string | null;
    name: string | null;
  }>({ show: false, type: null, id: null, name: null });
  const [actionInProgress, setActionInProgress] = useState(false);

  // Enroll students modal
  const [showEnrollStudentsModal, setShowEnrollStudentsModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [selectedStudentsForEnrollment, setSelectedStudentsForEnrollment] = useState<string[]>([]);
  const [enrollingStudents, setEnrollingStudents] = useState(false);

  // Edit modals
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<{ type: 'teacher' | 'student' | 'parent', data: any } | null>(null);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [updatingClass, setUpdatingClass] = useState(false);

  useEffect(() => {
    // Check for saved dark mode preference
    const savedDarkMode = localStorage.getItem('coordinatorDarkMode') === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) {
        setOpenMenuId(null);
      }
      if (showProfileMenu) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId, showProfileMenu]);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('coordinatorDarkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    fetchCoordinatorData();
    fetchClasses();
  }, []);

  // Fetch classes when Classes tab is activated
  useEffect(() => {
    if (activeTab === 'classes') {
      fetchClasses();
    }
  }, [activeTab]);

  const fetchCoordinatorData = async (range = userGrowthRange) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');

      // Fetch overview stats
      const overviewRes = await fetch(`/api/coordinator/overview?range=${range}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const overviewData = await overviewRes.json();
      if (overviewData.success) {
        setOverviewStats(overviewData.data);
      }

      // Fetch teacher stats
      const teachersRes = await fetch('/api/coordinator/teachers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const teachersData = await teachersRes.json();
      if (teachersData.success) {
        setTeacherStats(teachersData.data.teachers);
      }

      // Fetch student stats
      const studentsRes = await fetch('/api/coordinator/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const studentsData = await studentsRes.json();
      if (studentsData.success) {
        setStudentStats(studentsData.data.students);
      }

      // Fetch parent stats
      try {
        const parentsRes = await fetch('/api/coordinator/parents', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!parentsRes.ok) {
          console.error('Parents API returned status:', parentsRes.status);
          throw new Error(`HTTP error! status: ${parentsRes.status}`);
        }

        const parentsData = await parentsRes.json();
        if (parentsData.success) {
          setParentStats(parentsData.data.parents);
        } else {
          console.error('Parents API error:', parentsData.error);
        }
      } catch (parentError) {
        console.error('Error fetching parents:', parentError);
        // Set empty array so the page still loads
        setParentStats([]);
      }

    } catch (error) {
      console.error('Error fetching coordinator data:', error);
      showError('Failed to load coordinator data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserGrowthData = async (range: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const overviewRes = await fetch(`/api/coordinator/overview?range=${range}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const overviewData = await overviewRes.json();
      if (overviewData.success) {
        setOverviewStats(prev => ({
          ...prev,
          userGrowth: overviewData.data.userGrowth
        }));
      }
    } catch (error) {
      console.error('Error fetching user growth data:', error);
      showError('Failed to load user growth data');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    window.location.href = '/auth/login?reason=logout';
  };

  const handleChangePassword = async () => {
    setPasswordError("");

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      showWarning("All fields are required");
      return;
    }

    // Check if new password is same as current password
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from current password");
      showWarning("New password must be different from current password");
      return;
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setPasswordError("Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one symbol (@$!%*?&)");
      showWarning("Password does not meet requirements");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirm password do not match");
      showWarning("Passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/coordinator/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('Password changed successfully! Please login again with your new password.');
        // Clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setTimeout(() => {
          router.push('/auth/login');
        }, 1500);
      } else {
        setPasswordError(result.error || 'Failed to change password');
        showError(result.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('Failed to change password');
      showError('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherFirstName || !teacherLastName) {
      showWarning('Please fill in all required fields');
      return;
    }

    setCreatingTeacher(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/coordinator/create-teacher', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: teacherFirstName,
          lastName: teacherLastName
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`Teacher account created successfully! Email: ${result.data.email}, Password: ${result.data.password}`);
        // Clear form
        setTeacherFirstName('');
        setTeacherLastName('');
        // Refresh teacher stats
        fetchCoordinatorData();
      } else {
        showError(result.error || 'Failed to create teacher account');
      }
    } catch (error) {
      console.error('Error creating teacher:', error);
      showError('Failed to create teacher account');
    } finally {
      setCreatingTeacher(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!studentFirstName || !studentLastName || !studentNumber) {
      showWarning('Please fill in all required fields');
      return;
    }

    if (studentNumber.length !== 5) {
      showWarning('Student number must be exactly 5 digits');
      return;
    }

    setCreatingStudent(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/coordinator/create-student', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: studentFirstName,
          lastName: studentLastName,
          studentNumber
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`Student account created successfully! Email: ${result.data.email}, Password: ${result.data.password}`);
        // Clear form
        setStudentFirstName('');
        setStudentLastName('');
        setStudentNumber('');
        // Refresh student stats
        fetchCoordinatorData();
      } else {
        showError(result.error || 'Failed to create student account');
      }
    } catch (error) {
      console.error('Error creating student:', error);
      showError('Failed to create student account');
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentFirstName || !parentLastName || !selectedStudent) {
      showWarning('Please fill in all required fields and select a student');
      return;
    }

    setCreatingParent(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/coordinator/create-parent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: parentFirstName,
          lastName: parentLastName,
          studentId: selectedStudent.id
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`Parent account created successfully! Email: ${result.data.email}, Password: ${result.data.password}`);
        // Clear form
        setParentFirstName('');
        setParentLastName('');
        setSelectedStudent(null);
        setStudentSearchQuery('');
        // Refresh parent stats
        fetchCoordinatorData();
      } else {
        showError(result.error || 'Failed to create parent account');
      }
    } catch (error) {
      console.error('Error creating parent:', error);
      showError('Failed to create parent account');
    } finally {
      setCreatingParent(false);
    }
  };

  const generateEmail = (role: 'teacher' | 'student' | 'parent', name: string, studentNumber?: string): string => {
    const currentYear = new Date().getFullYear();

    if (role === 'teacher') {
      const cleanName = name.toLowerCase().replace(/\s+/g, '.');
      return `${cleanName}@gordoncollege.edu.ph`;
    } else if (role === 'student') {
      if (studentNumber) {
        return `${studentNumber}@gordoncollege.edu.ph`;
      }
      const sequentialNumber = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
      return `${currentYear}${sequentialNumber}@gordoncollege.edu.ph`;
    } else if (role === 'parent') {
      const cleanName = name.toLowerCase().replace(/\s+/g, '');
      const last5 = studentNumber ? studentNumber.slice(-5) : '00000';
      return `${cleanName}${last5}@gordoncollege.edu.ph`;
    }

    return '';
  };

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Fetching classes...');
      const response = await fetch('/api/coordinator/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error('Classes API returned status:', response.status);
        const text = await response.text();
        console.error('Response text:', text.substring(0, 200));
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Classes API response:', result);
      if (result.success) {
        setClasses(result.data.classes);
        console.log('Classes loaded:', result.data.classes.length);
      } else {
        console.error('Failed to fetch classes:', result.error);
        showError(result.error || 'Failed to load classes');
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      showError('Failed to load classes');
      setClasses([]); // Set empty array so page still loads
    } finally {
      setLoadingClasses(false);
    }
  };

  // Helper function to convert 24-hour time to 12-hour format with AM/PM
  const formatTimeRange = (startTime: string, endTime: string): string => {
    const formatTime = (time: string): string => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${hour12}:${minutes} ${ampm}`;
    };

    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!className) {
      showWarning('Please fill in all required fields: Class Name');
      return;
    }

    // Validate teacher selection
    if (!selectedTeacher) {
      showWarning('Please select a valid teacher from the dropdown list');
      return;
    }

    // Validate class name length
    if (className.trim().length < 3) {
      showWarning('Class name must be at least 3 characters long');
      return;
    }





    // Validate schedule day is selected
    if (classDay.length === 0) {
      showWarning('Please select at least one schedule day');
      return;
    }

    // Validate start time is provided
    if (!classStartTime) {
      showWarning('Please select a start time');
      return;
    }

    // Validate end time is provided
    if (!classEndTime) {
      showWarning('Please select an end time');
      return;
    }

    // Validate end time is after start time
    const [startHour, startMinute] = classStartTime.split(':').map(Number);
    const [endHour, endMinute] = classEndTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) {
      showWarning('End time must be after start time');
      return;
    }

    // Validate reasonable class duration (at least 30 minutes, max 8 hours)
    const durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 30) {
      showWarning('Class duration must be at least 30 minutes');
      return;
    }
    if (durationMinutes > 480) {
      showWarning('Class duration cannot exceed 8 hours');
      return;
    }

    // Validate room is provided
    if (!classRoom || classRoom.trim().length === 0) {
      showWarning('Please enter a room number or location');
      return;
    }

    setCreatingClass(true);
    try {
      const token = localStorage.getItem('accessToken');
      const courseYear = `${classProgram} - ${classYear}${classBlock}`;

      const response = await fetch('/api/coordinator/classes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: className,
          classCode: classCode,
          courseYear,
          description: classDescription,
          teacherId: selectedTeacher.id,
          day: classDay,
          time: classStartTime && classEndTime ? formatTimeRange(classStartTime, classEndTime) : '',
          room: classRoom
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`Class created successfully! Class Code: ${result.data.classCode}`);
        // Clear form
        setClassName('');
        setClassCode('');
        setClassSubject('');
        setClassProgram('BSIT');
        setClassYear('1');
        setClassBlock('A');
        setClassDescription('');
        setSelectedTeacher(null);
        setTeacherSearchQuery('');
        setClassDay([]);
        setClassStartTime('');
        setClassEndTime('');
        setClassRoom('');
        setShowCreateClassModal(false);
        // Refresh classes and stats
        fetchClasses();
        fetchCoordinatorData();
      } else {
        showError(result.error || 'Failed to create class');
      }
    } catch (error) {
      console.error('Error creating class:', error);
      showError('Failed to create class');
    } finally {
      setCreatingClass(false);
    }
  };

  const handleEnrollStudents = async () => {
    if (!selectedClass || selectedStudentsForEnrollment.length === 0) {
      showWarning('Please select students to enroll');
      return;
    }

    setEnrollingStudents(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/coordinator/classes/${selectedClass.id}/students`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentIds: selectedStudentsForEnrollment
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`${result.data.addedCount} student(s) enrolled successfully!`);
        setSelectedStudentsForEnrollment([]);
        setShowEnrollStudentsModal(false);
        fetchClasses();
      } else {
        showError(result.error || 'Failed to enroll students');
      }
    } catch (error) {
      console.error('Error enrolling students:', error);
      showError('Failed to enroll students');
    } finally {
      setEnrollingStudents(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;

    if (!firstName || !lastName || !email) {
      showWarning('Please fill in all required fields');
      return;
    }

    setUpdatingUser(true);
    try {
      const token = localStorage.getItem('accessToken');
      const endpoint = editingUser.type === 'teacher'
        ? `/api/coordinator/teachers/${editingUser.data.id}`
        : editingUser.type === 'student'
          ? `/api/coordinator/students/${editingUser.data.id}`
          : `/api/coordinator/parents/${editingUser.data.id}`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ firstName, lastName, email })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`${editingUser.type.charAt(0).toUpperCase() + editingUser.type.slice(1)} updated successfully`);
        setShowEditUserModal(false);
        setEditingUser(null);
        fetchCoordinatorData();
      } else {
        showError(result.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showError('Failed to update user');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const classCode = formData.get('classCode') as string;
    const subject = formData.get('subject') as string;
    const program = formData.get('program') as string;
    const year = formData.get('year') as string;
    const block = formData.get('block') as string;
    const description = formData.get('description') as string;
    const teacherId = formData.get('teacherId') as string;
    const room = formData.get('room') as string;
    const startTime = formData.get('startTime') as string;
    const endTime = formData.get('endTime') as string;

    // Get selected days
    const days: string[] = [];
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach(day => {
      if (formData.get(day) === 'on') {
        days.push(day);
      }
    });

    if (!name || !classCode || !subject || days.length === 0 || !startTime || !endTime || !room) {
      showWarning('Please fill in all required fields');
      return;
    }

    // Validate time range
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) {
      showWarning('End time must be after start time');
      return;
    }

    setUpdatingClass(true);
    try {
      const token = localStorage.getItem('accessToken');
      const courseYear = `${program} - ${year}${block}`;

      const response = await fetch(`/api/coordinator/classes/${editingClass.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          classCode,
          subject,
          courseYear,
          description,
          teacherId,
          day: days,
          time: formatTimeRange(startTime, endTime),
          room
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('Class updated successfully');
        setShowEditClassModal(false);
        setEditingClass(null);
        fetchClasses();
        fetchCoordinatorData();
      } else {
        showError(result.error || 'Failed to update class');
      }
    } catch (error) {
      console.error('Error updating class:', error);
      showError('Failed to update class');
    } finally {
      setUpdatingClass(false);
    }
  };

  const handleGenerateEmails = async () => {
    setGeneratingEmails(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/coordinator/generate-emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        setEmailList(result.data.emails);
        showSuccess('Emails generated successfully!');
      } else {
        showError('Failed to generate emails');
      }
    } catch (error) {
      console.error('Error generating emails:', error);
      showError('Failed to generate emails');
    } finally {
      setGeneratingEmails(false);
    }
  };

  // Generate teacher email and password
  const generateTeacherEmail = () => {
    if (!teacherFirstName || !teacherLastName) return "";
    const first = teacherFirstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = teacherLastName.toLowerCase().replace(/[^a-z]/g, '');
    return `${first}.${last}@gordoncollege.edu.ph`;
  };

  const generateTeacherPassword = () => {
    if (!teacherLastName) return "";
    const cleanLast = teacherLastName.replace(/[^a-zA-Z]/g, '');
    const last = cleanLast.charAt(0).toUpperCase() + cleanLast.slice(1).toLowerCase();
    return `${last}@1234`;
  };

  // Generate student email and password
  const generateStudentEmail = () => {
    if (!studentNumber || studentNumber.length !== 5) return "";
    const last = studentLastName.toLowerCase().replace(/[^a-z]/g, '');
    return `${last}.${studentNumber}@gordoncollege.edu.ph`;
  };

  const generateStudentPassword = () => {
    if (!studentLastName || !studentNumber || studentNumber.length !== 5) return "";
    const cleanLast = studentLastName.replace(/[^a-zA-Z]/g, '');
    const last = cleanLast.charAt(0).toUpperCase() + cleanLast.slice(1).toLowerCase();
    return `${last}@${studentNumber}`;
  };

  // Generate parent email and password
  const generateParentEmail = () => {
    if (!selectedStudent) return "";
    const last5 = selectedStudent.studentNumber.slice(-5);
    if (!parentLastName || !parentFirstName) return "";
    const firstLetter = parentFirstName.charAt(0).toLowerCase().replace(/[^a-z]/g, '');
    const lastName = parentLastName.toLowerCase().replace(/[^a-z]/g, '');
    return `${firstLetter}${lastName}.${last5}@gordoncollege.edu.ph`;
  };

  const generateParentPassword = () => {
    if (!parentLastName) return "";
    const cleanLast = parentLastName.replace(/[^a-zA-Z]/g, '');
    const last = cleanLast.charAt(0).toUpperCase() + cleanLast.slice(1).toLowerCase();
    return `${last}@1234`;
  };

  // Filter students for dropdown
  const filteredStudentsForParent = studentStats.filter(student =>
    student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
    student.studentNumber.includes(studentSearchQuery)
  );

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      showWarning('No data to export');
      return;
    }

    try {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row =>
          headers.map(header => {
            const value = row[header];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess(`Exported ${filename} successfully`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export data');
    }
  };

  const handleExportTeachers = () => {
    exportToCSV(filteredTeachers, 'teachers_statistics.csv');
  };

  const handleExportStudents = () => {
    exportToCSV(filteredStudents, 'students_statistics.csv');
  };

  const handleExportEmails = () => {
    exportToCSV(emailList, 'generated_emails.csv');
  };

  const handleExportForGoogleWorkspace = () => {
    const googleWorkspaceFormat = emailList.map(item => ({
      'First Name': item.name.split(' ')[0] || 'User',
      'Last Name': item.name.split(' ').slice(1).join(' ') || 'Account',
      'Email Address': item.generatedEmail,
      'Password': 'TempPass@2025',
      'Org Unit Path': item.role === 'teacher' ? '/Teachers' : item.role === 'student' ? '/Students' : '/Parents',
      'New Primary Email': item.generatedEmail,
      'Recovery Email': '',
      'Home Secondary Email': '',
      'Work Secondary Email': '',
      'Recovery Phone': '',
      'Work Phone': '',
      'Home Phone': '',
      'Mobile Phone': '',
      'Work Address': '',
      'Home Address': '',
      'Employee ID': item.role === 'student' ? item.studentNumber : '',
      'Employee Type': item.role,
      'Employee Title': item.role === 'teacher' ? 'Teacher' : item.role === 'student' ? 'Student' : 'Parent',
      'Manager Email': '',
      'Department': '',
      'Cost Center': '',
      'Building ID': '',
      'Floor Name': '',
      'Floor Section': '',
      'Change Password at Next Sign-In': 'TRUE',
      'New Status': 'Active'
    }));

    exportToCSV(googleWorkspaceFormat, 'google_workspace_import.csv');
  };

  const handleArchiveUser = async () => {
    if (!archiveConfirmModal.id || !archiveConfirmModal.type) return;

    setActionInProgress(true);
    try {
      const token = localStorage.getItem('accessToken');
      let endpoint = '';
      let itemType = '';

      switch (archiveConfirmModal.type) {
        case 'student':
          endpoint = `/api/coordinator/students/${archiveConfirmModal.id}`;
          itemType = 'Student';
          break;
        case 'teacher':
          endpoint = `/api/coordinator/teachers/${archiveConfirmModal.id}`;
          itemType = 'Teacher';
          break;
        case 'parent':
          endpoint = `/api/coordinator/parents/${archiveConfirmModal.id}`;
          itemType = 'Parent';
          break;
        case 'class':
          endpoint = `/api/coordinator/classes/archive/${archiveConfirmModal.id}`;
          itemType = 'Class';
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'archive' })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`${itemType} archived successfully`);
        setArchiveConfirmModal({ show: false, type: null, id: null, name: null });

        // Immediately update the local state to reflect the archive
        if (archiveConfirmModal.type === 'teacher') {
          setTeacherStats(prev => prev.map(t =>
            t.id === archiveConfirmModal.id
              ? { ...t, archived: true, archivedAt: new Date() }
              : t
          ));
        } else if (archiveConfirmModal.type === 'student') {
          setStudentStats(prev => prev.map(s =>
            s.id === archiveConfirmModal.id
              ? { ...s, archived: true, archivedAt: new Date() }
              : s
          ));
        } else if (archiveConfirmModal.type === 'parent') {
          setParentStats(prev => prev.map(p =>
            p.id === archiveConfirmModal.id
              ? { ...p, archived: true, archivedAt: new Date() }
              : p
          ));
        } else if (archiveConfirmModal.type === 'class') {
          setClasses(prev => prev.map((c: any) =>
            c.id === archiveConfirmModal.id
              ? { ...c, archived: true, archivedAt: new Date() }
              : c
          ));
        }

        // Also fetch fresh data from server
        fetchCoordinatorData();
        if (archiveConfirmModal.type === 'class') {
          fetchClasses();
        }
      } else {
        showError(result.message || `Failed to archive ${itemType.toLowerCase()}`);
      }
    } catch (error) {
      console.error('Error archiving:', error);
      showError('Failed to archive');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmModal.id || !deleteConfirmModal.type) return;

    setActionInProgress(true);
    try {
      const token = localStorage.getItem('accessToken');
      let endpoint = '';
      let itemType = '';

      switch (deleteConfirmModal.type) {
        case 'student':
          endpoint = `/api/coordinator/students/${deleteConfirmModal.id}`;
          itemType = 'Student';
          break;
        case 'teacher':
          endpoint = `/api/coordinator/teachers/${deleteConfirmModal.id}`;
          itemType = 'Teacher';
          break;
        case 'parent':
          endpoint = `/api/coordinator/parents/${deleteConfirmModal.id}`;
          itemType = 'Parent';
          break;
        case 'class':
          endpoint = `/api/coordinator/classes/archive/${deleteConfirmModal.id}`;
          itemType = 'Class';
          break;
        default:
          return;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`${itemType} deleted successfully`);
        setDeleteConfirmModal({ show: false, type: null, id: null, name: null });

        // Immediately remove from local state
        if (deleteConfirmModal.type === 'teacher') {
          setTeacherStats(prev => prev.filter(t => t.id !== deleteConfirmModal.id));
        } else if (deleteConfirmModal.type === 'student') {
          setStudentStats(prev => prev.filter(s => s.id !== deleteConfirmModal.id));
        } else if (deleteConfirmModal.type === 'parent') {
          setParentStats(prev => prev.filter(p => p.id !== deleteConfirmModal.id));
        } else if (deleteConfirmModal.type === 'class') {
          setClasses(prev => prev.filter((c: any) => c.id !== deleteConfirmModal.id));
        }

        // Also fetch fresh data from server
        fetchCoordinatorData();
        if (deleteConfirmModal.type === 'class') {
          fetchClasses();
        }
      } else {
        showError(result.message || `Failed to delete ${itemType.toLowerCase()}`);
      }
    } catch (error) {
      console.error('Error deleting:', error);
      showError('Failed to delete');
    } finally {
      setActionInProgress(false);
    }
  };

  // Filter teachers with search and filter options
  const filteredTeachers = teacherStats
    .filter(teacher => !teacher.archived)
    .filter(teacher =>
      teacher.name.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      teacher.email.toLowerCase().includes(teacherSearch.toLowerCase())
    )
    .filter(teacher => {
      if (teacherFilter === "all") return true;
      if (teacherFilter === "active") return teacher.totalClasses > 0;
      if (teacherFilter === "mostClasses") return teacher.totalClasses >= 3;
      if (teacherFilter === "mostAssessments") {
        const totalAssessments = teacher.totalQuizzes + teacher.totalExams + teacher.totalActivities;
        return totalAssessments >= 5;
      }
      return true;
    })
    .sort((a, b) => {
      if (teacherFilter === "mostClasses") return b.totalClasses - a.totalClasses;
      if (teacherFilter === "mostAssessments") {
        const aTotal = a.totalQuizzes + a.totalExams + a.totalActivities;
        const bTotal = b.totalQuizzes + b.totalExams + b.totalActivities;
        return bTotal - aTotal;
      }
      return 0;
    });

  // Filter students with search and filter options
  const filteredStudents = studentStats
    .filter(student => !student.archived)
    .filter(student =>
      student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      student.studentNumber.includes(studentSearch)
    )
    .filter(student => {
      if (studentFilter === "all") return true;
      if (studentFilter === "topPerformers") return student.averageScore >= 85;
      if (studentFilter === "needsAttention") return student.averageScore < 70 && student.averageScore > 0;
      if (studentFilter === "mostActive") {
        const totalCompleted = student.completedQuizzes + student.completedExams + student.completedActivities;
        return totalCompleted > 0;
      }
      return true;
    })
    .sort((a, b) => {
      if (studentFilter === "topPerformers") return b.averageScore - a.averageScore;
      if (studentFilter === "needsAttention") return a.averageScore - b.averageScore;
      if (studentFilter === "mostActive") {
        const aTotal = a.completedQuizzes + a.completedExams + a.completedActivities;
        const bTotal = b.completedQuizzes + b.completedExams + b.completedActivities;
        return bTotal - aTotal;
      }
      return 0;
    });

  // Filter parents with search and filter options
  const filteredParents = (parentStats || [])
    .filter(parent => !parent.archived)
    .filter(parent =>
      parent.name.toLowerCase().includes(parentSearch.toLowerCase()) ||
      parent.email.toLowerCase().includes(parentSearch.toLowerCase())
    )
    .filter(parent => {
      if (parentFilter === "all") return true;
      if (parentFilter === "linked") return parent.linkedStudent !== null && parent.linkedStudent !== undefined;
      if (parentFilter === "unlinked") return !parent.linkedStudent;
      return true;
    });

  // Filter classes with search and filter options
  const filteredClasses = classes
    .filter(classItem => !(classItem as any).archived)
    .filter(classItem =>
      classItem.name.toLowerCase().includes(classSearch.toLowerCase()) ||
      classItem.classCode.toLowerCase().includes(classSearch.toLowerCase()) ||
      classItem.subject?.toLowerCase().includes(classSearch.toLowerCase()) ||
      classItem.courseYear?.toLowerCase().includes(classSearch.toLowerCase())
    )
    .filter(classItem => {
      if (programFilter === "all") return true;
      return classItem.courseYear?.startsWith(programFilter) || false;
    })
    .sort((a, b) => {
      if (classFilter === "mostStudents") return b.studentCount - a.studentCount;
      // Default A-Z sorting by name
      return a.name.localeCompare(b.name);
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading coordinator dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Coordinator Panel
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Monitor and manage teachers, students, and system activities
              </p>
            </div>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProfileMenu(!showProfileMenu);
                }}
                className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">Coordinator</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">coordinator@gordoncollege.edu.ph</div>
                </div>
                <svg className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                  <button
                    onClick={() => {
                      setActiveTab('archives');
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Archives</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">View archived users</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowChangePasswordModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Change Password</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Update your password</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      toggleDarkMode();
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                  >
                    {isDarkMode ? (
                      <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
                      </div>
                    </div>
                  </button>

                  <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>

                  <button
                    onClick={() => {
                      setShowLogoutModal(true);
                      setShowProfileMenu(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">Log Out</div>
                      <div className="text-xs text-red-500 dark:text-red-500">Sign out of your account</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-8 overflow-x-auto">
              {[
                { id: "overview", label: "Dashboard" },
                { id: "teachers", label: "Teachers" },
                { id: "students", label: "Students" },
                { id: "parents", label: "Parents" },
                { id: "classes", label: "Classes" },
                { id: "emails", label: "Email Management" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                    ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'overview' && (
              <button
                onClick={() => exportToPDF(overviewStats, userGrowthRange)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ml-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <CoordinatorDashboard
            stats={overviewStats}
            onCreateTeacher={() => setActiveTab('emails')}
            onCreateStudent={() => setActiveTab('emails')}
            onCreateClass={() => setShowCreateClassModal(true)}
            onManageEmails={() => setActiveTab('emails')}
            userGrowthRange={userGrowthRange}
            onUserGrowthRangeChange={(range) => {
              setUserGrowthRange(range);
              fetchUserGrowthData(range);
            }}
          />
        )}

        {/* Teachers Tab */}
        {activeTab === "teachers" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <input
                  type="text"
                  placeholder="Search teachers..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-full sm:flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <select
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full sm:w-auto"
                >
                  <option value="all">All Teachers</option>
                  <option value="active">Active (Has Classes)</option>
                  <option value="mostClasses">Most Classes (3+)</option>
                  <option value="mostAssessments">Most Assessments (5+)</option>
                </select>
              </div>
              <button
                onClick={handleExportTeachers}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export to CSV</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="max-h-[600px] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Teacher
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Classes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Quizzes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Exams
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Activities
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Flashcards
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Summaries
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">No teachers found</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Create teacher accounts from the Email Management tab</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((teacher) => (
                        <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{teacher.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {teacher.totalClasses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {teacher.totalQuizzes}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {teacher.totalExams}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {teacher.totalActivities}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {teacher.totalFlashcards}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {teacher.totalSummaries}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === teacher.id ? null : teacher.id);
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              {openMenuId === teacher.id && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-50">
                                  <button
                                    onClick={() => {
                                      setEditingUser({ type: 'teacher', data: teacher });
                                      setShowEditUserModal(true);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setArchiveConfirmModal({
                                        show: true,
                                        type: 'teacher',
                                        id: teacher.id,
                                        name: teacher.name
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Archive
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'teacher',
                                        id: teacher.id,
                                        name: teacher.name
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === "students" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-full sm:flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <select
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full sm:w-auto"
                >
                  <option value="all">All Students</option>
                  <option value="topPerformers">Top Performers (85%+)</option>
                  <option value="needsAttention">Needs Attention (&lt;70%)</option>
                  <option value="mostActive">Most Active</option>
                </select>
              </div>
              <button
                onClick={handleExportStudents}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export to CSV</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="max-h-[600px] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Student #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Classes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Quizzes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Exams
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Activities
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Avg Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">No students found</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Create student accounts from the Email Management tab</p>
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{student.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {student.studentNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {student.totalClasses}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {student.completedQuizzes}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {student.completedExams}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {student.completedActivities}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-semibold ${student.averageScore >= 75
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                              }`}>
                              {student.averageScore.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === student.id ? null : student.id);
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              {openMenuId === student.id && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-50">
                                  <button
                                    onClick={() => {
                                      setEditingUser({ type: 'student', data: student });
                                      setShowEditUserModal(true);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setArchiveConfirmModal({
                                        show: true,
                                        type: 'student',
                                        id: student.id,
                                        name: student.name
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Archive
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'student',
                                        id: student.id,
                                        name: student.name
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Parents Tab */}
        {activeTab === "parents" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <input
                  type="text"
                  placeholder="Search parents..."
                  value={parentSearch}
                  onChange={(e) => setParentSearch(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-full sm:flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <select
                  value={parentFilter}
                  onChange={(e) => setParentFilter(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full sm:w-auto"
                >
                  <option value="all">All Parents</option>
                  <option value="linked">Linked to Student</option>
                  <option value="unlinked">Not Linked</option>
                </select>
              </div>
              <button
                onClick={() => exportToCSV(filteredParents, 'parents_statistics.csv')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export to CSV</span>
                <span className="sm:hidden">Export</span>
              </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="max-h-[600px] overflow-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Parent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Linked Students
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredParents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center">
                          <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">No parents found</p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Create parent accounts from the Email Management tab</p>
                        </td>
                      </tr>
                    ) : (
                      filteredParents.map((parent) => (
                        <tr key={parent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{parent.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{parent.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {parent.linkedStudent ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{parent.linkedStudent.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{parent.linkedStudent.email}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">No linked student</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === parent.id ? null : parent.id);
                                }}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              {openMenuId === parent.id && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-50">
                                  <button
                                    onClick={() => {
                                      setEditingUser({ type: 'parent', data: parent });
                                      setShowEditUserModal(true);
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setArchiveConfirmModal({
                                        show: true,
                                        type: 'parent',
                                        id: parent.id,
                                        name: parent.name
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                    </svg>
                                    Archive
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'parent',
                                        id: parent.id,
                                        name: parent.name
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Class Management</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage and organize all classes</p>
              </div>
              <button
                onClick={() => setShowCreateClassModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Create Class</span>
                <span className="sm:hidden">Create</span>
              </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Search classes..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 w-full sm:flex-1 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full sm:w-auto"
              >
                <option value="all">A-Z</option>
                <option value="mostStudents">Most Students</option>
              </select>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-full sm:w-auto"
              >
                <option value="all">All Programs</option>
                <option value="BSIT">BSIT</option>
                <option value="BSCS">BSCS</option>
                <option value="BSEMC">BSEMC</option>
              </select>
            </div>

            {loadingClasses ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading classes...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredClasses.map((classItem) => (
                    <div key={classItem.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {classItem.subject}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{classItem.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${classItem.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                            {classItem.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === classItem.id ? null : classItem.id);
                              }}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            {openMenuId === classItem.id && (
                              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-50">
                                <button
                                  onClick={() => {
                                    setEditingClass(classItem);
                                    setShowEditClassModal(true);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setArchiveConfirmModal({
                                      show: true,
                                      type: 'class',
                                      id: classItem.id,
                                      name: classItem.subject
                                    });
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                  Archive
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirmModal({
                                      show: true,
                                      type: 'class',
                                      id: classItem.id,
                                      name: classItem.subject
                                    });
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4 flex-grow">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {classItem.teacher?.name || 'No teacher assigned'}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {classItem.studentCount} students
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {classItem.courseYear}
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          Code: <span className="font-mono font-semibold">{classItem.classCode}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedClass(classItem);
                          setShowEnrollStudentsModal(true);
                        }}
                        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-sm"
                      >
                        Enroll Students
                      </button>
                    </div>
                  ))}
                </div>

                {filteredClasses.length === 0 && (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">No classes created yet</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Click "Create Class" to get started</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Email Management Tab */}
        {activeTab === "emails" && (
          <div className="space-y-6">
            {/* Sub-tabs for email types */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6">
                <div className="flex space-x-8 overflow-x-auto">
                  {[
                    { id: "teacher-email", label: "Create Teacher Email" },
                    { id: "student-email", label: "Create Student Email" },
                    { id: "parent-email", label: "Create Parent Email" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setEmailSubTab(tab.id as any)}
                      className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${emailSubTab === tab.id
                        ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {/* Teacher Email Creation */}
                {emailSubTab === "teacher-email" && (
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Create Teacher Email Account
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Format: firstname.lastname@gordoncollege.edu.ph
                      <br />
                      <span className="text-xs">Example: John Doe → john.doe@gordoncollege.edu.ph</span>
                    </p>

                    <form className="space-y-4" onSubmit={handleCreateTeacher}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          placeholder="John"
                          value={teacherFirstName}
                          onChange={(e) => setTeacherFirstName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Doe"
                          value={teacherLastName}
                          onChange={(e) => setTeacherLastName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      {(teacherFirstName || teacherLastName) && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border-2 border-emerald-200 dark:border-emerald-800">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Generated Email:</strong> <span className="font-mono text-emerald-600 dark:text-emerald-400">{generateTeacherEmail() || "Enter names to generate"}</span>
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            <strong>Password:</strong> <span className="font-mono text-emerald-600 dark:text-emerald-400">{generateTeacherPassword() || "Enter last name"}</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            (Lastname with capital first letter + @1234)
                          </p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={!teacherFirstName || !teacherLastName || creatingTeacher}
                        className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {creatingTeacher ? 'Creating...' : 'Create Teacher Account'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Student Email Creation */}
                {emailSubTab === "student-email" && (
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Create Student Email Account
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Format: lastname.NNNNN@gordoncollege.edu.ph (5 digits)
                      <br />
                      <span className="text-xs">Example: Juan Dejesus, 11564 → dejesus.11564@gordoncollege.edu.ph</span>
                    </p>

                    <form className="space-y-4" onSubmit={handleCreateStudent}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          placeholder="Juan"
                          value={studentFirstName}
                          onChange={(e) => setStudentFirstName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Dejesus"
                          value={studentLastName}
                          onChange={(e) => setStudentLastName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Student Number (5 digits)
                        </label>
                        <input
                          type="text"
                          placeholder="11564"
                          maxLength={5}
                          value={studentNumber}
                          onChange={(e) => setStudentNumber(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      {(studentLastName || studentNumber) && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Generated Email:</strong>{' '}
                            {studentNumber.length === 5 ? (
                              <span className="font-mono text-blue-600 dark:text-blue-400">{generateStudentEmail()}</span>
                            ) : (
                              <span className="font-mono text-gray-400 dark:text-gray-500">
                                {studentNumber ? `${new Date().getFullYear()}${studentNumber}@gordoncollege.edu.ph (need ${5 - studentNumber.length} more digit${5 - studentNumber.length > 1 ? 's' : ''})` : "Enter 5-digit number"}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            <strong>Password:</strong>{' '}
                            {studentLastName && studentNumber.length === 5 ? (
                              <span className="font-mono text-blue-600 dark:text-blue-400">{generateStudentPassword()}</span>
                            ) : (
                              <span className="font-mono text-gray-400 dark:text-gray-500">
                                {studentLastName && studentNumber ? `${studentLastName.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase() + studentLastName.replace(/[^a-zA-Z]/g, '').slice(1).toLowerCase()}@${studentNumber} (need ${5 - studentNumber.length} more digit${5 - studentNumber.length > 1 ? 's' : ''})` : "Enter last name and 5-digit number"}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            (Lastname with capital first letter + @ + last 5 digits)
                          </p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={!studentFirstName || !studentLastName || studentNumber.length !== 5 || creatingStudent}
                        className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {creatingStudent ? 'Creating...' : 'Create Student Account'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Parent Email Creation */}
                {emailSubTab === "parent-email" && (
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Create Parent/Guardian Email Account
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                      Format: Flastname.NNNNN@gordoncollege.edu.ph (first letter of first name + lastname + last 5 digits)
                      <br />
                      <span className="text-xs">Example: Maria Cruz (parent of student 202411564) → mcruz.11564@gordoncollege.edu.ph</span>
                    </p>

                    <form className="space-y-4" onSubmit={handleCreateParent}>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Parent/Guardian First Name
                        </label>
                        <input
                          type="text"
                          placeholder="John"
                          value={parentFirstName}
                          onChange={(e) => setParentFirstName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Parent/Guardian Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Doe"
                          value={parentLastName}
                          onChange={(e) => setParentLastName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Select Student
                        </label>
                        <input
                          type="text"
                          placeholder="Search by student name or number..."
                          value={studentSearchQuery}
                          onChange={(e) => {
                            setStudentSearchQuery(e.target.value);
                            setShowStudentDropdown(true);
                          }}
                          onFocus={() => setShowStudentDropdown(true)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />

                        {showStudentDropdown && filteredStudentsForParent.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredStudentsForParent.slice(0, 10).map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setStudentSearchQuery(`${student.name} (${student.studentNumber})`);
                                  setShowStudentDropdown(false);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors"
                              >
                                <div className="font-medium text-gray-900 dark:text-white">{student.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  Student #: {student.studentNumber} • Email: {student.email}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {selectedStudent && (
                          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-900 dark:text-blue-300">
                              <strong>Selected Student:</strong> {selectedStudent.name}
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                              Student Number: {selectedStudent.studentNumber} • Last 5 digits: <strong>{selectedStudent.studentNumber.slice(-5)}</strong>
                            </p>
                          </div>
                        )}
                      </div>

                      {selectedStudent && parentLastName && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Generated Email:</strong> <span className="font-mono text-purple-600 dark:text-purple-400">{generateParentEmail()}</span>
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            <strong>Password:</strong> <span className="font-mono text-purple-600 dark:text-purple-400">{generateParentPassword()}</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            (Lastname with capital first letter + @1234)
                          </p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={!parentLastName || !selectedStudent || creatingParent}
                        className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {creatingParent ? 'Creating...' : 'Create Parent Account'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Archives Tab */}
        {activeTab === "archives" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                  <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Archived Users</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">View and restore archived teachers and students</p>
                </div>
              </div>

              {/* Archived Teachers Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Archived Teachers
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Teacher
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Archived Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {teacherStats.filter(t => (t as any).archived).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              No archived teachers
                            </td>
                          </tr>
                        ) : (
                          teacherStats.filter(t => (t as any).archived).map((teacher) => (
                            <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{teacher.email}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {(teacher as any).archivedAt ? new Date((teacher as any).archivedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('accessToken');
                                        const response = await fetch(`/api/coordinator/teachers/${teacher.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ action: 'unarchive' })
                                        });
                                        const result = await response.json();
                                        if (result.success) {
                                          showSuccess('Teacher restored successfully');
                                          // Immediately update local state
                                          setTeacherStats(prev => prev.map(t =>
                                            t.id === teacher.id
                                              ? { ...t, archived: false, archivedAt: null }
                                              : t
                                          ));
                                          // Also fetch fresh data
                                          fetchCoordinatorData();
                                        } else {
                                          showError('Failed to restore teacher');
                                        }
                                      } catch (error) {
                                        showError('Failed to restore teacher');
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'teacher',
                                        id: teacher.id,
                                        name: teacher.name
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Archived Students Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Archived Students
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Student
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Student #
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Archived Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {studentStats.filter(s => (s as any).archived).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              No archived students
                            </td>
                          </tr>
                        ) : (
                          studentStats.filter(s => (s as any).archived).map((student) => (
                            <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{student.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{student.email}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {student.studentNumber}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {(student as any).archivedAt ? new Date((student as any).archivedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('accessToken');
                                        const response = await fetch(`/api/coordinator/students/${student.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ action: 'unarchive' })
                                        });
                                        const result = await response.json();
                                        if (result.success) {
                                          showSuccess('Student restored successfully');
                                          // Immediately update local state
                                          setStudentStats(prev => prev.map(s =>
                                            s.id === student.id
                                              ? { ...s, archived: false, archivedAt: null }
                                              : s
                                          ));
                                          // Also fetch fresh data
                                          fetchCoordinatorData();
                                        } else {
                                          showError('Failed to restore student');
                                        }
                                      } catch (error) {
                                        showError('Failed to restore student');
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'student',
                                        id: student.id,
                                        name: student.name
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Archived Parents Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Archived Parents
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Parent
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Archived Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {(parentStats || []).filter(p => p.archived).length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              No archived parents
                            </td>
                          </tr>
                        ) : (
                          (parentStats || []).filter(p => p.archived).map((parent) => (
                            <tr key={parent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{parent.name}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{parent.email}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {parent.archivedAt ? new Date(parent.archivedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('accessToken');
                                        const response = await fetch(`/api/coordinator/parents/${parent.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ action: 'unarchive' })
                                        });
                                        const result = await response.json();
                                        if (result.success) {
                                          showSuccess('Parent restored successfully');
                                          // Immediately update local state
                                          setParentStats(prev => prev.map(p =>
                                            p.id === parent.id
                                              ? { ...p, archived: false, archivedAt: null }
                                              : p
                                          ));
                                          // Also fetch fresh data
                                          fetchCoordinatorData();
                                        } else {
                                          showError('Failed to restore parent');
                                        }
                                      } catch (error) {
                                        showError('Failed to restore parent');
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'parent',
                                        id: parent.id,
                                        name: parent.name
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Archived Classes Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Archived Classes
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Class
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Teacher
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Archived Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {classes.filter((c: any) => c.archived).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                              </svg>
                              No archived classes
                            </td>
                          </tr>
                        ) : (
                          classes.filter((c: any) => c.archived).map((classItem: any) => (
                            <tr key={classItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{classItem.subject}</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">{classItem.name} • {classItem.courseYear}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {classItem.teacher?.name || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {classItem.archivedAt ? new Date(classItem.archivedAt).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const token = localStorage.getItem('accessToken');
                                        const response = await fetch(`/api/coordinator/classes/archive/${classItem.id}`, {
                                          method: 'PATCH',
                                          headers: {
                                            'Authorization': `Bearer ${token}`,
                                            'Content-Type': 'application/json'
                                          },
                                          body: JSON.stringify({ action: 'unarchive' })
                                        });
                                        const result = await response.json();
                                        if (result.success) {
                                          showSuccess('Class restored successfully');
                                          // Immediately update local state
                                          setClasses(prev => prev.map((c: any) =>
                                            c.id === classItem.id
                                              ? { ...c, archived: false, archivedAt: null }
                                              : c
                                          ));
                                          // Also fetch fresh data
                                          fetchClasses();
                                        } else {
                                          showError('Failed to restore class');
                                        }
                                      } catch (error) {
                                        showError('Failed to restore class');
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Restore
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        show: true,
                                        type: 'class',
                                        id: classItem.id,
                                        name: classItem.subject
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-xs"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Confirm Logout
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to logout? You will need to login again to access the coordinator dashboard.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowChangePasswordModal(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordError("");
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Change Password
            </h3>

            <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showCurrentPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., Password@1234"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showNewPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Must be 8+ characters with uppercase, lowercase, number, and symbol (@$!%*?&)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordError("");
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Class Modal */}
      {showCreateClassModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowCreateClassModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full border border-gray-200 dark:border-gray-700 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Create New Class
            </h3>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., Integrative Programming and Technologies"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class Code *
                  </label>
                  <input
                    type="text"
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., IPT101"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Program *
                  </label>
                  <select
                    value={classProgram}
                    onChange={(e) => setClassProgram(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="BSIT">BSIT</option>
                    <option value="BSCS">BSCS</option>
                    <option value="BSEMC">BSEMC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Year *
                  </label>
                  <select
                    value={classYear}
                    onChange={(e) => setClassYear(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Block *
                  </label>
                  <select
                    value={classBlock}
                    onChange={(e) => setClassBlock(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="A">Block A</option>
                    <option value="B">Block B</option>
                    <option value="C">Block C</option>
                    <option value="D">Block D</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Teacher *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search teacher by name..."
                    value={teacherSearchQuery}
                    onChange={(e) => {
                      setTeacherSearchQuery(e.target.value);
                      setSelectedTeacher(null); // Clear selection when user types
                      setShowTeacherDropdown(true);
                    }}
                    onFocus={() => setShowTeacherDropdown(true)}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${selectedTeacher
                      ? 'border-emerald-500 dark:border-emerald-400'
                      : 'border-gray-300 dark:border-gray-600'
                      }`}
                  />

                  {showTeacherDropdown && teacherStats.filter(t =>
                    t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase())
                  ).length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {teacherStats
                          .filter(t => t.name.toLowerCase().includes(teacherSearchQuery.toLowerCase()))
                          .slice(0, 10)
                          .map((teacher) => (
                            <button
                              key={teacher.id}
                              type="button"
                              onClick={() => {
                                setSelectedTeacher(teacher);
                                setTeacherSearchQuery(teacher.name);
                                setShowTeacherDropdown(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900 dark:text-white">{teacher.name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{teacher.email}</div>
                            </button>
                          ))}
                      </div>
                    )}

                  {selectedTeacher && (
                    <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <p className="text-sm text-emerald-900 dark:text-emerald-300">
                        <strong>Selected:</strong> {selectedTeacher.name}
                      </p>
                    </div>
                  )}

                  {!selectedTeacher && teacherSearchQuery && (
                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-900 dark:text-yellow-300">
                        Please select a teacher from the dropdown list
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={classDescription}
                  onChange={(e) => setClassDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Optional class description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Schedule Day(s) *
                  </label>
                  <div className="space-y-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={classDay.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setClassDay([...classDay, day]);
                            } else {
                              setClassDay(classDay.filter(d => d !== day));
                            }
                          }}
                          className="mr-2 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={classStartTime}
                    onChange={(e) => setClassStartTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={classEndTime}
                    onChange={(e) => setClassEndTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Room *
                  </label>
                  <input
                    type="text"
                    value={classRoom}
                    onChange={(e) => setClassRoom(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="e.g., GC Main 525"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateClassModal(false);
                    setClassName('');
                    setClassCode('');
                    setClassSubject('');
                    setClassDescription('');
                    setSelectedTeacher(null);
                    setTeacherSearchQuery('');
                    setClassDay([]);
                    setClassStartTime('');
                    setClassEndTime('');
                    setClassRoom('');
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !className ||
                    !classCode ||
                    !selectedTeacher ||
                    classDay.length === 0 ||
                    !classStartTime ||
                    !classEndTime ||
                    !classRoom ||
                    creatingClass
                  }
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingClass ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Students Modal */}
      {showEnrollStudentsModal && selectedClass && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setShowEnrollStudentsModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full border border-gray-200 dark:border-gray-700 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Enroll Students
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {selectedClass.subject} - {selectedClass.courseYear}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Students
              </label>
              <div className="max-h-96 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                {studentStats.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentsForEnrollment.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentsForEnrollment([...selectedStudentsForEnrollment, student.id]);
                        } else {
                          setSelectedStudentsForEnrollment(selectedStudentsForEnrollment.filter(id => id !== student.id));
                        }
                      }}
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{student.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {student.studentNumber} • {student.email}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {selectedStudentsForEnrollment.length} student(s) selected
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEnrollStudentsModal(false);
                  setSelectedStudentsForEnrollment([]);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollStudents}
                disabled={selectedStudentsForEnrollment.length === 0 || enrollingStudents}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enrollingStudents ? 'Enrolling...' : `Enroll ${selectedStudentsForEnrollment.length} Student(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {archiveConfirmModal.show && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setArchiveConfirmModal({ show: false, type: null, id: null, name: null })}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Archive {archiveConfirmModal.type === 'student' ? 'Student' : archiveConfirmModal.type === 'teacher' ? 'Teacher' : archiveConfirmModal.type === 'parent' ? 'Parent' : 'Class'}
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Are you sure you want to archive <strong>{archiveConfirmModal.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Archived users will be hidden from the main list but can be restored later. Their data will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArchiveConfirmModal({ show: false, type: null, id: null, name: null })}
                disabled={actionInProgress}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveUser}
                disabled={actionInProgress}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionInProgress ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.show && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setDeleteConfirmModal({ show: false, type: null, id: null, name: null })}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Delete {deleteConfirmModal.type === 'student' ? 'Student' : deleteConfirmModal.type === 'teacher' ? 'Teacher' : deleteConfirmModal.type === 'parent' ? 'Parent' : 'Class'}
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Are you sure you want to permanently delete <strong>{deleteConfirmModal.name}</strong>?
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              ⚠️ This action cannot be undone. All data associated with this user will be permanently removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmModal({ show: false, type: null, id: null, name: null })}
                disabled={actionInProgress}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionInProgress}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionInProgress ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditUserModal(false);
            setEditingUser(null);
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Edit {editingUser.type.charAt(0).toUpperCase() + editingUser.type.slice(1)}
            </h3>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  name="firstName"
                  defaultValue={editingUser.data.name.split(' ')[0]}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  name="lastName"
                  defaultValue={editingUser.data.name.split(' ').slice(1).join(' ')}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingUser.data.email}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingUser}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingUser ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditClassModal && editingClass && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => {
            setShowEditClassModal(false);
            setEditingClass(null);
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full border border-gray-200 dark:border-gray-700 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Edit Class
            </h3>

            <form onSubmit={handleUpdateClass} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingClass.name}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Class Code *
                  </label>
                  <input
                    type="text"
                    name="classCode"
                    defaultValue={editingClass.classCode}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  name="subject"
                  defaultValue={editingClass.subject}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Program *
                  </label>
                  <select
                    name="program"
                    defaultValue={editingClass.courseYear?.split(' - ')[0] || 'BSIT'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="BSIT">BSIT</option>
                    <option value="BSCS">BSCS</option>
                    <option value="BSEMC">BSEMC</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Year *
                  </label>
                  <select
                    name="year"
                    defaultValue={editingClass.courseYear?.split(' - ')[1]?.charAt(0) || '1'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Block *
                  </label>
                  <select
                    name="block"
                    defaultValue={editingClass.courseYear?.split(' - ')[1]?.slice(1) || 'A'}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="A">Block A</option>
                    <option value="B">Block B</option>
                    <option value="C">Block C</option>
                    <option value="D">Block D</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={editingClass.description}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <input type="hidden" name="teacherId" value={editingClass.teacher?.id || editingClass.teacherId} />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Schedule Day(s) *
                  </label>
                  <div className="space-y-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          name={day}
                          defaultChecked={editingClass.day?.includes(day)}
                          className="mr-2 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={editingClass.time?.split(' - ')[0]?.trim().replace(/(\d+):(\d+) (AM|PM)/, (_match: string, h: string, m: string, ampm: string) => {
                      let hour = parseInt(h);
                      if (ampm === 'PM' && hour !== 12) hour += 12;
                      if (ampm === 'AM' && hour === 12) hour = 0;
                      return `${hour.toString().padStart(2, '0')}:${m}`;
                    })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    defaultValue={editingClass.time?.split(' - ')[1]?.trim().replace(/(\d+):(\d+) (AM|PM)/, (_match: string, h: string, m: string, ampm: string) => {
                      let hour = parseInt(h);
                      if (ampm === 'PM' && hour !== 12) hour += 12;
                      if (ampm === 'AM' && hour === 12) hour = 0;
                      return `${hour.toString().padStart(2, '0')}:${m}`;
                    })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Room *
                  </label>
                  <input
                    type="text"
                    name="room"
                    defaultValue={editingClass.room}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClassModal(false);
                    setEditingClass(null);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingClass}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingClass ? 'Updating...' : 'Update Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
