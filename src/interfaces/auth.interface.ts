export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'student' | 'teacher' | 'parent' | 'coordinator';
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface ConfirmResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
