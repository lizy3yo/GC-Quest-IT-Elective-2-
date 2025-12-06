export interface DashboardMetrics {
  totalStudents: number;
  totalClasses: number;
  totalAssessments: number;
  averageScore: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'assessment' | 'flashcard' | 'summary' | 'login';
  userId: string;
  userName: string;
  description: string;
  timestamp: string;
}

export interface ClassPerformance {
  classId: string;
  className: string;
  averageScore: number;
  totalStudents: number;
  completionRate: number;
  assessmentScores: AssessmentScore[];
}

export interface AssessmentScore {
  assessmentId: string;
  assessmentTitle: string;
  averageScore: number;
  submissionCount: number;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  averageScore: number;
  assessmentsCompleted: number;
  totalAssessments: number;
  recentScores: number[];
  strengths: string[];
  improvements: string[];
}

export interface OverviewData {
  metrics: DashboardMetrics;
  recentActivities: ActivityItem[];
  upcomingAssessments: any[];
}
