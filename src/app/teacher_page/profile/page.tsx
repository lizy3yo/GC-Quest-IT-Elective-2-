"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { validatePassword } from "@/lib/validation";
import { useToast } from "@/contexts/ToastContext";

interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function TeacherProfilePage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordChangeConfirm, setShowPasswordChangeConfirm] = useState(false);
  const [showDeleteImageConfirm, setShowDeleteImageConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showError, showSuccess, showWarning } = useToast();

  const [profile, setProfile] = useState<UserProfile>({
    email: '',
    firstName: '',
    lastName: '',
    profileImage: ''
  });

  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const response = await fetch('/api/v1/users/current', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const user = data.user;

          setProfile({
            email: user.email || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            profileImage: user.profileImage || ''
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [showError]);

  const handleImageUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Image size must be less than 5MB');
      return;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const imageUrl = data.url;

        setProfile(prev => ({ ...prev, profileImage: imageUrl }));

        const profileResponse = await fetch('/api/v1/users/current', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ profileImage: imageUrl })
        });

        if (profileResponse.ok) {
          showSuccess('Profile image uploaded successfully!');
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            localStorage.setItem('user', JSON.stringify({ ...user, profileImage: imageUrl }));
          }
          window.dispatchEvent(new CustomEvent('profileUpdated'));
        } else {
          showWarning('Image uploaded but failed to save to profile');
        }
      } else {
        showError('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      showError('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordError = validatePassword(passwordData.newPassword);
    if (passwordError) {
      showError(passwordError.message);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    setShowPasswordChangeConfirm(true);
  };

  const submitPasswordChange = async () => {
    setIsSaving(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/v1/users/change-password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        showSuccess('Password changed successfully! You will be logged out.');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordSection(false);

        setTimeout(async () => {
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userId');
          await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
          window.location.href = '/auth/login?message=Password changed successfully';
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setIsSaving(false);
      setShowPasswordChangeConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Profile
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Manage your profile information
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-6">
            {/* Profile Information Skeleton */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-6">
              <div className="space-y-6">
                {/* Profile Picture Section Skeleton */}
                <div className="flex items-center space-x-6 animate-pulse">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-56 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-64"></div>
                  </div>
                </div>

                {/* Basic Information Skeleton */}
                <div className="space-y-6 animate-pulse">
                  <div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-2"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-full"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40 mt-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-2"></div>
                      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-full"></div>
                    </div>
                    <div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-2"></div>
                      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Password Section Skeleton */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-6 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
              </div>
            </div>
          </div>
        ) : (
          <>

        <div className="space-y-6">
          {/* Profile Information Form */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-6">
            <div className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-gray-200 dark:border-gray-700 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                    {profile.profileImage ? (
                      <img
                        src={profile.profileImage}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const defaultAvatar = target.parentElement?.querySelector('.default-avatar') as HTMLElement;
                          if (defaultAvatar) {
                            defaultAvatar.classList.remove('hidden');
                          }
                        }}
                      />
                    ) : session?.user?.image ? (
                      <Image
                        src={session.user.image}
                        alt="Profile"
                        fill
                        className="object-cover"
                      />
                    ) : null}

                    <div className={`default-avatar w-full h-full flex items-center justify-center ${(profile.profileImage || session?.user?.image) ? 'hidden' : ''}`}>
                      <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg"
                    title="Upload profile picture"
                  >
                    {isUploadingImage ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {profile.firstName} {profile.lastName}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {profile.email}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Click the + button to upload a new profile picture
                  </p>
                </div>
                {profile.profileImage && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteImageConfirm(true)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remove profile picture"
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {/* Basic Information */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Email cannot be changed
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={profile.firstName}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={profile.lastName}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Password Change Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Password
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
                className="text-[#2E7D32] hover:text-[#1B5E20] text-sm font-medium"
              >
                {showPasswordSection ? 'Cancel' : 'Change Password'}
              </button>
            </div>

            {showPasswordSection && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Password must be at least 8 characters with uppercase, lowercase, number, and symbol
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#2E7D32] text-white px-4 py-2 rounded-lg hover:bg-[#1B5E20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        </>
        )}

        {/* Password Change Confirmation Modal */}
        {showPasswordChangeConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border-2 border-slate-200 dark:border-slate-700 shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Confirm Password Change
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                For security reasons, you will be logged out after changing your password. You&apos;ll need to log in again with your new password.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowPasswordChangeConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPasswordChangeConfirm(false);
                    submitPasswordChange();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Profile Picture Confirmation Modal */}
        {showDeleteImageConfirm && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 border-2 border-slate-200 dark:border-slate-700 shadow-2xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Remove Profile Picture
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to remove your profile picture? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteImageConfirm(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowDeleteImageConfirm(false);
                    try {
                      const token = localStorage.getItem('accessToken');
                      const response = await fetch('/api/v1/users/current', {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ profileImage: '' })
                      });
                      
                      if (response.ok) {
                        setProfile(prev => ({ ...prev, profileImage: '' }));
                        const userData = localStorage.getItem('user');
                        if (userData) {
                          const user = JSON.parse(userData);
                          user.profileImage = '';
                          localStorage.setItem('user', JSON.stringify(user));
                        }
                        window.dispatchEvent(new CustomEvent('profileUpdated'));
                        showSuccess('Profile picture removed successfully!');
                      } else {
                        showError('Failed to remove profile picture');
                      }
                    } catch (error) {
                      showError('Failed to remove profile picture');
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Remove Photo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
