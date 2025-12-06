// API Endpoints
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/v1/auth/login',
    REGISTER: '/v1/auth/register',
    LOGOUT: '/v1/auth/logout',
    REFRESH: '/v1/auth/refresh-token',
    RESET_PASSWORD: '/auth/reset-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    VERIFY_EMAIL: '/auth/verify-email',
    SEND_VERIFICATION: '/auth/send-verification',
    CHECK_ROLE: '/v1/auth/check-role',
    UPDATE_ROLE: '/v1/auth/update-role',
  },
  
  // User
  USER: {
    PROFILE: '/v1/users/current',
    UPDATE_PROFILE: '/v1/users/current',
    AVATAR: '/v1/users/avatar',
    CHANGE_PASSWORD: '/v1/users/change-password',
    GET_BY_ID: (id: string) => `/v1/users/${id}`,
  },
  
  // Student
  STUDENT: {
    CLASSES: '/student_page/class',
    CLASS_DETAIL: (id: string) => `/student_page/class/${id}`,
    FLASHCARDS: '/student_page/flashcard',
    FLASHCARD_DETAIL: (id: string) => `/student_page/flashcard/${id}`,
    GENERATE_FLASHCARD_TEXT: '/student_page/flashcard/generate-from-text',
    GENERATE_FLASHCARD_FILE: '/student_page/flashcard/generate-from-file',
    GENERATE_FLASHCARD_CLASS: '/student_page/flashcard/generate-from-class-file',
    ANALYZE_FLASHCARD: '/student_page/flashcard/analyze',
    PUBLIC_FLASHCARDS: '/student_page/flashcard/public',
    SHARED_FLASHCARD: (id: string) => `/student_page/shared-flashcard/${id}`,
    SUMMARIES: '/student_page/summary',
    GENERATE_SUMMARY_TEXT: '/student_page/summary/generate-from-text',
    GENERATE_SUMMARY_FILE: '/student_page/summary/generate-from-file',
    GENERATE_SUMMARY_CLASS: '/student_page/summary/generate-from-class-file',
    RESUMMARIZE: '/student_page/summary/resummarize',
    MARK_SUMMARY_READ: '/student_page/summary/mark-read',
    PUBLIC_SUMMARIES: '/student_page/summary/public',
    SHARED_SUMMARY: (id: string) => `/student_page/shared-summary/${id}`,
    PRACTICE_TESTS: '/student_page/practice-test',
    PRACTICE_TEST_DETAIL: (id: string) => `/student_page/practice-test/${id}`,
    GENERATE_PRACTICE_TEST: '/student_page/practice-test/generate',
    SUBMIT_PRACTICE_TEST: '/student_page/practice-test/submit',
    SHARE_PRACTICE_TEST: '/student_page/practice-test/share',
    UPLOAD_PRACTICE_TEST: '/student_page/practice-test/upload',
    ASSESSMENTS: (id: string) => `/student_page/assessment/${id}`,
    FOLDERS: '/student_page/folder',
    FOLDER_DETAIL: (id: string) => `/student_page/folder/${id}`,
    RESOURCES: '/student_page/resources',
    RESOURCE_DETAIL: (id: string) => `/student_page/resources/${id}`,
    DISCOVER_RESOURCES: '/student_page/resources/discover',
    AUTO_DISCOVER_RESOURCES: '/student_page/resources/auto-discover',
    ENROLLED_SUBJECTS: '/student_page/resources/enrolled-subjects',
    USER_CLASSES: '/student_page/resources/user-classes',
    UPLOAD_RESOURCE: '/student_page/resources/upload',
    STUDY_ROOMS: '/student_page/study-rooms',
    STUDY_ROOM_DETAIL: (id: string) => `/student_page/study-rooms/${id}`,
    STUDY_ROOM_INVITES: '/student_page/study-rooms/invites',
    SEARCH_STUDENTS: '/student_page/study-rooms/search-students',
    HISTORY: '/student_page/history',
    LOG_ACTIVITY: '/student_page/log-activity',
    DUE_ITEMS: '/v1/student/due',
  },
  
  // Teacher
  TEACHER: {
    CLASSES: '/teacher_page/class',
    CLASS_DETAIL: (id: string) => `/teacher_page/class/${id}`,
    ASSESSMENTS: '/teacher_page/assessment',
    ASSESSMENT_DETAIL: (id: string) => `/teacher_page/assessment/${id}`,
    GENERATE_ASSESSMENT_TEXT: '/teacher_page/assessment/generate-from-text',
    GENERATE_ASSESSMENT_FILE: '/teacher_page/assessment/generate-from-file',
    FLASHCARD_DETAIL: (id: string) => `/teacher_page/flashcard/${id}`,
    SUMMARY_DETAIL: (id: string) => `/teacher_page/summary/${id}`,
    STUDENT_DETAIL: (id: string) => `/teacher_page/student/${id}`,
    SUBMISSIONS_PENDING: '/teacher_page/submissions/pending',
    ANALYTICS_DASHBOARD: '/teacher_page/analytics/dashboard-metrics',
    ANALYTICS_CLASS: '/teacher_page/analytics/class-performance',
    RECENT_ACTIVITY: '/teacher_page/activity/recent',
    LEADERBOARDS: '/teacher_page/leaderboards',
    HISTORY: '/teacher_page/history',
  },
  
  // Coordinator
  COORDINATOR: {
    OVERVIEW: '/coordinator/overview',
    CLASSES: '/coordinator/classes',
    CLASS_DETAIL: (id: string) => `/coordinator/classes/${id}`,
    ARCHIVE_CLASS: '/coordinator/classes/archive',
    TEACHERS: '/coordinator/teachers',
    TEACHER_DETAIL: (id: string) => `/coordinator/teachers/${id}`,
    CREATE_TEACHER: '/coordinator/create-teacher',
    STUDENTS: '/coordinator/students',
    STUDENT_DETAIL: (id: string) => `/coordinator/students/${id}`,
    CREATE_STUDENT: '/coordinator/create-student',
    PARENTS: '/coordinator/parents',
    PARENT_DETAIL: (id: string) => `/coordinator/parents/${id}`,
    CREATE_PARENT: '/coordinator/create-parent',
    GENERATE_EMAILS: '/coordinator/generate-emails',
    CHANGE_PASSWORD: '/coordinator/change-password',
  },
  
  // Parent
  PARENT: {
    OVERVIEW: '/parent/overview',
  },
  
  // Notifications
  NOTIFICATIONS: {
    LIST: '/v1/notifications',
  },
  
  // Chatbot
  CHATBOT: {
    CHAT: '/chatbot',
    SESSIONS: '/chatbot/sessions',
    SESSION_DETAIL: (id: string) => `/chatbot/sessions/${id}`,
    EXTRACT_FILE: '/chatbot/extract-file',
    HEALTH: '/chatbot/health',
  },
  
  // Upload
  UPLOAD: {
    FILE: '/upload-file',
    IMAGE: '/upload-image',
  },
  
  // Verification
  VERIFICATION: {
    GET_CODE: '/get-verification-code',
  },
} as const;

// Query Keys for React Query
export const QUERY_KEYS = {
  AUTH: {
    USER: ['auth', 'user'],
    SESSION: ['auth', 'session'],
    ROLE: ['auth', 'role'],
  },
  USER: {
    PROFILE: ['user', 'profile'],
    BY_ID: (id: string) => ['user', id],
  },
  STUDENT: {
    CLASSES: {
      ALL: ['student', 'classes'],
      LIST: (filters?: any) => ['student', 'classes', 'list', filters],
      DETAIL: (id: string) => ['student', 'classes', 'detail', id],
    },
    FLASHCARDS: {
      ALL: ['student', 'flashcards'],
      LIST: (filters?: any) => ['student', 'flashcards', 'list', filters],
      DETAIL: (id: string) => ['student', 'flashcards', 'detail', id],
      PUBLIC: ['student', 'flashcards', 'public'],
      SHARED: (id: string) => ['student', 'flashcards', 'shared', id],
    },
    SUMMARIES: {
      ALL: ['student', 'summaries'],
      LIST: (filters?: any) => ['student', 'summaries', 'list', filters],
      PUBLIC: ['student', 'summaries', 'public'],
      SHARED: (id: string) => ['student', 'summaries', 'shared', id],
    },
    PRACTICE_TESTS: {
      ALL: ['student', 'practice-tests'],
      LIST: (filters?: any) => ['student', 'practice-tests', 'list', filters],
      DETAIL: (id: string) => ['student', 'practice-tests', 'detail', id],
    },
    ASSESSMENTS: {
      DETAIL: (id: string) => ['student', 'assessments', 'detail', id],
    },
    FOLDERS: {
      ALL: ['student', 'folders'],
      LIST: (filters?: any) => ['student', 'folders', 'list', filters],
      DETAIL: (id: string) => ['student', 'folders', 'detail', id],
    },
    RESOURCES: {
      ALL: ['student', 'resources'],
      LIST: (filters?: any) => ['student', 'resources', 'list', filters],
      DETAIL: (id: string) => ['student', 'resources', 'detail', id],
      ENROLLED_SUBJECTS: ['student', 'resources', 'enrolled-subjects'],
      USER_CLASSES: ['student', 'resources', 'user-classes'],
    },
    STUDY_ROOMS: {
      ALL: ['student', 'study-rooms'],
      LIST: (filters?: any) => ['student', 'study-rooms', 'list', filters],
      DETAIL: (id: string) => ['student', 'study-rooms', 'detail', id],
      INVITES: ['student', 'study-rooms', 'invites'],
    },
    HISTORY: ['student', 'history'],
    DUE_ITEMS: ['student', 'due-items'],
  },
  TEACHER: {
    CLASSES: {
      ALL: ['teacher', 'classes'],
      LIST: (filters?: any) => ['teacher', 'classes', 'list', filters],
      DETAIL: (id: string) => ['teacher', 'classes', 'detail', id],
    },
    ASSESSMENTS: {
      ALL: ['teacher', 'assessments'],
      LIST: (filters?: any) => ['teacher', 'assessments', 'list', filters],
      DETAIL: (id: string) => ['teacher', 'assessments', 'detail', id],
    },
    FLASHCARDS: {
      DETAIL: (id: string) => ['teacher', 'flashcards', 'detail', id],
    },
    SUMMARIES: {
      DETAIL: (id: string) => ['teacher', 'summaries', 'detail', id],
    },
    STUDENTS: {
      DETAIL: (id: string) => ['teacher', 'students', 'detail', id],
    },
    SUBMISSIONS: {
      PENDING: ['teacher', 'submissions', 'pending'],
    },
    ANALYTICS: {
      DASHBOARD: ['teacher', 'analytics', 'dashboard'],
      CLASS: (classId: string) => ['teacher', 'analytics', 'class', classId],
    },
    ACTIVITY: {
      RECENT: ['teacher', 'activity', 'recent'],
    },
    LEADERBOARDS: ['teacher', 'leaderboards'],
    HISTORY: ['teacher', 'history'],
  },
  COORDINATOR: {
    OVERVIEW: ['coordinator', 'overview'],
    CLASSES: {
      ALL: ['coordinator', 'classes'],
      LIST: (filters?: any) => ['coordinator', 'classes', 'list', filters],
      DETAIL: (id: string) => ['coordinator', 'classes', 'detail', id],
    },
    TEACHERS: {
      ALL: ['coordinator', 'teachers'],
      LIST: (filters?: any) => ['coordinator', 'teachers', 'list', filters],
      DETAIL: (id: string) => ['coordinator', 'teachers', 'detail', id],
    },
    STUDENTS: {
      ALL: ['coordinator', 'students'],
      LIST: (filters?: any) => ['coordinator', 'students', 'list', filters],
      DETAIL: (id: string) => ['coordinator', 'students', 'detail', id],
    },
    PARENTS: {
      ALL: ['coordinator', 'parents'],
      LIST: (filters?: any) => ['coordinator', 'parents', 'list', filters],
      DETAIL: (id: string) => ['coordinator', 'parents', 'detail', id],
    },
  },
  PARENT: {
    OVERVIEW: ['parent', 'overview'],
  },
  NOTIFICATIONS: {
    ALL: ['notifications'],
    LIST: (filters?: any) => ['notifications', 'list', filters],
  },
  CHATBOT: {
    SESSIONS: ['chatbot', 'sessions'],
    SESSION: (id: string) => ['chatbot', 'session', id],
    HEALTH: ['chatbot', 'health'],
  },
} as const;

// Cache times (in milliseconds)
export const CACHE_TIME = {
  SHORT: 1000 * 60 * 5, // 5 minutes
  MEDIUM: 1000 * 60 * 15, // 15 minutes
  LONG: 1000 * 60 * 60, // 1 hour
  VERY_LONG: 1000 * 60 * 60 * 24, // 24 hours
} as const;

// Stale times (in milliseconds)
export const STALE_TIME = {
  SHORT: 1000 * 30, // 30 seconds
  MEDIUM: 1000 * 60 * 2, // 2 minutes
  LONG: 1000 * 60 * 10, // 10 minutes
  VERY_LONG: 1000 * 60 * 30, // 30 minutes
} as const;
