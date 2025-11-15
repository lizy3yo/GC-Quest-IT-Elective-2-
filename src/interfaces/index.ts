export interface StudentInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface TeacherInfo {
  name: string;
  email: string;
  department?: string;
}

export interface StudentAssessment {
  id: string;
  title: string;
  type: "Quiz" | "Exam";
  format?: "online" | "file_submission";
  dueDate: string;
  points?: number;
  description?: string;
  instructions?: string;
  published: boolean;
  accessCode?: string;
  category: "Quiz" | "Exam" | "Activity";
}

export interface StudentActivity {
  id: string;
  title: string;
  dueDate: string;
  points: number;
  submittedAt?: string;
  status: "submitted" | "late" | "missing";
  description?: string;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface CommentMeta {
  id: string;
  author: string | null | undefined;
  timestamp: string | null | undefined;
  text: string | null | undefined;
}

export interface FeedPost {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  link?: string;
  attachments?: AttachmentMeta[];
  comments?: CommentMeta[];
}

export interface ResourceItem {
  id: string;
  title: string;
  type: string;
  description?: string;
  url: string;
  mimeType?: string;
  sizeKB?: number;
}

export interface StudentClassDetails {
  _id: string;
  name: string;
  classCode: string;
  schedule: string;
  subject: string;
  courseYear: string;
  description?: string;
  instructor: TeacherInfo;
  students: StudentInfo[];
  studentCount: number;
  createdAt: string;
  activities?: StudentActivity[];
  feed?: FeedPost[];
  resources?: ResourceItem[];
  assessments?: StudentAssessment[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface ClassListResponse {
  classes: StudentClassDetails[];
  pagination: {
    current: number;
    total: number;
    count: number;
    totalItems: number;
  };
}

export interface ClassDetailResponse {
  class: StudentClassDetails;
}

export interface IQuestion {
  id: string;
  type: 'short' | 'paragraph' | 'mcq' | 'checkboxes' | 'identification' | 'enumeration' | 'match' | 'title' | 'image' | 'section';
  title: string;
  required?: boolean;
  options?: string[];
  answer?: string;
  items?: string[];
  pairs?: { left: string; right?: string }[];
  description?: string;
  src?: string;
  alt?: string;
  points?: number;
}

export interface IAssessment {
  _id?: string;
  title: string;
  description?: string;
  type: 'MCQ' | 'TF' | 'Practical' | 'Written' | 'Mixed';
  category: 'Quiz' | 'Exam' | 'Activity';
  format?: 'online' | 'file_submission'; // Add format field
  questions: IQuestion[];
  classId: string;
  teacherId?: string;
  timeLimitMins?: number;
  maxAttempts?: number;
  published?: boolean;
  accessCode?: string;
  dueDate?: Date | string;
  availableFrom?: Date | string;
  availableUntil?: Date | string;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResults?: 'immediately' | 'after_due' | 'never';
  allowReview?: boolean;
  passingScore?: number;
  totalPoints?: number;
  instructions?: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size?: number;
  }[];
  settings?: {
    lockdown?: boolean;
    showProgress?: boolean;
    allowBacktrack?: boolean;
    autoSubmit?: boolean;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IClass {
  _id?: string;
  name: string;
  courseYear: string;
  subject: string;
  description?: string;
  teacherId?: string;
  teacher?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    fullName: string;
  };
  classCode?: string;
  isActive?: boolean;
  maxStudents?: number;
  studentCount?: number;
  
  // Schedule information
  day?: string[]; // Array of days like ["Monday", "Tuesday"]
  time?: string; // Time like "9:00 AM-10:00 AM"
  room?: string; // Room like "GC Main 525"
  
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    assessments?: T[];
    classes?: T[];
    pagination: {
      current: number;
      total: number;
      count: number;
      totalItems: number;
    };
  };
  error?: string;
}

export interface IClassInfo {
  _id: string;
  name: string;
  teacher: string;
  subject: string;
  studentCount: number;
  classCode: string;
  description?: string;
  createdAt: string;
  courseYear?: string;
  day?: string[];
  time?: string;
  room?: string;
}
