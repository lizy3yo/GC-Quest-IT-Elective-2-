"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Alert from "@/components/molecules/alert_template/Alert";
import { useAlert } from "@/hooks/useAlert";
import "./login-mobile.css";
import { signIn, useSession } from "next-auth/react";

interface LoginData {
  email: string;
  password: string;
  role: "student" | "instructor";
}

interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface LoginResponse {
  user: User;
  accessToken: string;
}

interface ApiError {
  code: string;
  message: string;
}

export default function Login() {
  const [formData, setFormData] = useState<LoginData>({
    email: "",
    password: "",
    role: "student",
  });
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { alert, showError, showSuccess, hideAlert } = useAlert();
  const router = useRouter();
  
  // Load remembered instructor credentials (if any) when role switches to instructor
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem("rememberedInstructor");
      if (stored) {
        const creds = JSON.parse(stored) as { email?: string; password?: string };
        if (creds?.email || creds?.password) {
          // only auto-fill when user selects instructor role to avoid affecting student flow
          if (formData.role === "instructor") {
            setFormData((prev) => ({
              ...prev,
              email: creds.email || prev.email,
              password: creds.password || prev.password,
            }));
            setRememberMe(true);
          }
        }
      }
    } catch {
      // noop
    }
  }, [formData.role]);
  
  // Show an error when redirected after a rejected Google sign-in (non-Gordon domain)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get("reason");
      if (reason === "domain") {
        showError(
          "Only email addresses from Gordon College are allowed to sign in.",
          "Unauthorized domain"
        );
        // Clear the query string to avoid repeated alerts
        router.replace(window.location.pathname);
      }
    } catch (err) {
      // noop
    }
  }, [router, showError]);

  // close forgot-password modal on Escape
  useEffect(() => {
    if (!showForgotModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowForgotModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForgotModal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (alert.isVisible) hideAlert();
  };

  const handleRoleChange = (role: "student" | "instructor") => {
    setFormData((prev) => ({
      ...prev,
      role,
    }));
    if (alert.isVisible) hideAlert();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    hideAlert();

    try {
      // clear any locally cached profile that conflicts with the selected role
      prepareOAuthSignIn();

      // server-side check for same-email-different-role
      const emailToCheck = formData.email || "";
      if (emailToCheck) {
        const conflict = await checkRoleConflict(emailToCheck, formData.role);
        if (conflict) {
          showError(
            "That email is already associated with a different role. Use a different email or sign out first.",
            "Role conflict"
          );
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        showError(errorData.message || "Login failed", "Login Failed");
        return;
      }

      const loginData = data as LoginResponse;

      // Store user data
      if (loginData.user) {
        localStorage.setItem("user", JSON.stringify(loginData.user));
        localStorage.setItem("userId", loginData.user._id); // Add this line
        localStorage.setItem("accessToken", loginData.accessToken);
      } else {
        showError("Login failed: user data not found in response.", "Login Failed");
        return;
      }
      // Persist instructor credentials if user opted in
      try {
        if (formData.role === "instructor") {
          if (rememberMe) {
            localStorage.setItem(
              "rememberedInstructor",
              JSON.stringify({ email: formData.email, password: formData.password })
            );
          } else {
            localStorage.removeItem("rememberedInstructor");
          }
        }
      } catch {
        // noop
      }

      showSuccess("Login successful! Redirecting...", "Welcome back");

      // Navigate based on user role
      setTimeout(() => {
        switch (loginData.user.role) {
          case "admin":
            router.push("/admin");
            break;
          case "teacher":
          case "instructor":
            router.push("/teacher_page/dashboard");
            break;
          case "student":
            router.push("/student_page/dashboard");
            break;
          default:
            router.push("/dashboard");
        }
      }, 1500);
    } catch (error) {
      console.error("Login error:", error);
      showError(
        "Network error. Please check your connection and try again.",
        "Connection Error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // call server-side check to prevent same-email different-role sign-ins
  const checkRoleConflict = async (email: string, role: "student" | "instructor") => {
    try {
      const res = await fetch("/api/v1/auth/check-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      return json.conflict === true;
    } catch {
      // if endpoint unavailable, allow flow (server will still enforce on callback/login)
      return false;
    }
  };

  // If a different-role profile is cached locally, remove it before starting OAuth
  const prepareOAuthSignIn = () => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { role?: string };
      if (parsed?.role && parsed.role !== formData.role) {
        // remove cached profile + tokens so UI won't show previous account after OAuth round-trip
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("userId");
      }
    } catch {
      // noop
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden font-[Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      data-login-page
    >
      <Alert
        type={alert.type}
        message={alert.message}
        title={alert.title}
        isVisible={alert.isVisible}
        onClose={hideAlert}
        autoClose={alert.type === "success"}
        autoCloseDelay={3000}
        position="bottom-right"
      />

      {/* GCQuest Title - Outside Container */}
      <div className="relative z-10 mb-8 max-md:mb-6">
        <h1 className="m-0 text-center text-5xl font-extrabold bg-gradient-to-br from-green-600 via-green-500 to-green-700 dark:from-green-400 dark:via-green-500 dark:to-green-600 bg-clip-text text-transparent tracking-tight relative after:content-[''] after:absolute after:bottom-[-12px] after:left-1/2 after:transform after:translate-x-[-50%] after:w-[80px] after:h-[4px] after:bg-gradient-to-r after:from-green-600 after:to-green-500 dark:after:from-green-400 dark:after:to-green-500 after:rounded-[2px] after:opacity-60 max-md:text-[3rem] max-md:font-black max-md:bg-gradient-to-br max-md:from-green-500 max-md:to-green-600 max-md:bg-clip-text max-md:text-transparent max-md:tracking-[-0.02em] max-md:after:w-[60px] max-md:after:h-[3px] max-md:after:bottom-[-8px]">
          GCQuest
        </h1>
      </div>

      <div className="relative z-10 max-w-[500px] w-full p-12 bg-gradient-to-br from-white/98 to-white/95 dark:from-gray-800/95 dark:to-gray-900/98 backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(34,197,94,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4),0_0_0_1px_rgba(34,197,94,0.12),inset_0_1px_0_rgba(255,255,255,0.1)] border border-green-500/12 dark:border-green-400/20 transform transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:translate-y-[-4px] hover:shadow-[0_48px_100px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(34,197,94,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] dark:hover:shadow-[0_48px_100px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(34,197,94,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] before:content-[''] before:absolute before:top-[-60%] before:right-[-60%] before:w-[120px] before:h-[120px] before:bg-[radial-gradient(circle,rgba(16,185,129,0.15)_0%,rgba(34,197,94,0.08)_50%,transparent_70%)] dark:before:bg-[radial-gradient(circle,rgba(16,185,129,0.3)_0%,rgba(34,197,94,0.15)_50%,transparent_70%)] before:rounded-full before:blur-[40px] before:z-[-1] before:animate-pulse before:opacity-80 after:content-[''] after:absolute after:bottom-[-40%] after:left-[-40%] after:w-[100px] after:h-[100px] after:bg-[radial-gradient(circle,rgba(34,197,94,0.12)_0%,rgba(16,185,129,0.06)_50%,transparent_70%)] dark:after:bg-[radial-gradient(circle,rgba(34,197,94,0.25)_0%,rgba(16,185,129,0.12)_50%,transparent_70%)] after:rounded-full after:blur-[30px] after:z-[-1] after:animate-pulse after:opacity-80 md:hover:translate-y-[-4px] md:hover:shadow-[0_48px_100px_-12px_rgba(0,0,0,0.12),0_0_0_1px_rgba(34,197,94,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] max-md:m-0 max-md:p-6 max-md:max-w-full max-md:w-full max-md:flex-1 max-md:rounded-none max-md:bg-white dark:max-md:bg-gray-900 max-md:backdrop-blur-none max-md:shadow-none max-md:border-none max-md:flex max-md:flex-col max-md:justify-center max-md:overflow-y-auto max-md:transform-none max-md:hover:transform-none max-md:hover:shadow-none max-md:before:hidden max-md:after:hidden">
        <button
          type="button"
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-3 bg-white/90 dark:bg-gray-800/90 border border-green-500/15 dark:border-green-400/25 rounded-xl text-gray-700 dark:text-gray-200 text-sm font-semibold cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] backdrop-blur-[8px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)] z-10 hover:bg-green-50/95 dark:hover:bg-green-900/30 hover:border-green-500/25 dark:hover:border-green-400/40 hover:text-green-600 dark:hover:text-green-400 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(34,197,94,0.15)] dark:hover:shadow-[0_8px_20px_rgba(34,197,94,0.25)] active:translate-y-[-1px] active:shadow-[0_4px_12px_rgba(34,197,94,0.1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none hover:[&>svg]:translate-x-[-2px] max-lg:hidden"
          onClick={() => router.push("/")}
          disabled={isLoading}
          aria-label="Go back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300 ease"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Back
        </button>
        <div className="mb-8 max-md:mb-6">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-gray-100 m-0 mb-2 tracking-[-0.02em] max-md:text-xl max-md:font-bold max-md:text-gray-800 dark:max-md:text-gray-200 max-md:mb-3">
            Welcome back!
          </h2>
          <p className="text-center text-[0.95rem] text-slate-500 dark:text-gray-400 m-0 font-normal leading-6 max-md:text-sm max-md:text-gray-500 dark:max-md:text-gray-400 max-md:leading-tight">
            Sign in to access your dashboard
          </p>
        </div>

        <form
          className="flex flex-col gap-8 max-md:gap-5 max-md:w-full max-md:max-w-[320px] max-md:mx-auto max-md:flex-shrink-0"
          onSubmit={handleSubmit}
        >
          <div className="mb-2 max-md:mb-0">
            <label className="block text-[0.95rem] font-semibold text-gray-700 dark:text-gray-300 mb-4 tracking-[-0.01em] max-md:text-sm max-md:font-semibold max-md:text-gray-500 dark:max-md:text-gray-400 max-md:mb-3 max-md:uppercase max-md:tracking-[0.025em]">
              Select your role
            </label>
            <div className="flex rounded-2xl overflow-hidden border border-green-500/15 dark:border-green-400/25 bg-green-50/50 dark:bg-gray-700/50 backdrop-blur-[8px] relative before:content-[''] before:absolute before:top-[2px] before:left-[2px] before:right-[2px] before:bottom-[2px] before:rounded-[14px] before:bg-gradient-to-br before:from-white/80 before:to-white/40 dark:before:from-gray-600/40 dark:before:to-gray-700/60 before:z-0 max-md:rounded-xl max-md:border max-md:border-gray-200 dark:max-md:border-gray-600 max-md:bg-gray-50 dark:max-md:bg-gray-700 max-md:backdrop-blur-none max-md:h-12 max-md:before:hidden">
              <button
                type="button"
                className={`flex-1 px-6 py-4 bg-transparent border-none text-sm font-semibold cursor-pointer transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] relative z-10 tracking-[-0.01em] max-md:px-4 max-md:py-3 max-md:text-sm max-md:font-semibold max-md:rounded-[10px] max-md:m-[2px] max-md:h-11 max-md:flex max-md:items-center max-md:justify-center max-md:transition-all max-md:duration-200 max-md:ease disabled:opacity-50 disabled:cursor-not-allowed ${
                  formData.role === "student"
                    ? "bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white shadow-[0_8px_20px_rgba(34,197,94,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] transform scale-[1.02] max-md:bg-green-400 max-md:text-white max-md:shadow-[0_2px_8px_rgba(34,197,94,0.25)] max-md:transform-none"
                    : "text-gray-500 dark:text-gray-400 hover:bg-green-100/80 dark:hover:bg-green-800/30 hover:text-green-600 dark:hover:text-green-400 hover:translate-y-[-1px] max-md:hover:bg-gray-100 dark:max-md:hover:bg-gray-600 max-md:hover:text-gray-700 dark:max-md:hover:text-gray-300 max-md:hover:transform-none"
                }`}
                onClick={() => handleRoleChange("student")}
                disabled={isLoading}
              >
                Student
              </button>
              <button
                type="button"
                className={`flex-1 px-6 py-4 bg-transparent border-none text-sm font-semibold cursor-pointer transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] relative z-10 tracking-[-0.01em] max-md:px-4 max-md:py-3 max-md:text-sm max-md:font-semibold max-md:rounded-[10px] max-md:m-[2px] max-md:h-11 max-md:flex max-md:items-center max-md:justify-center max-md:transition-all max-md:duration-200 max-md:ease disabled:opacity-50 disabled:cursor-not-allowed ${
                  formData.role === "instructor"
                    ? "bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white shadow-[0_8px_20px_rgba(34,197,94,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] transform scale-[1.02] max-md:bg-green-400 max-md:text-white max-md:shadow-[0_2px_8px_rgba(34,197,94,0.25)] max-md:transform-none"
                    : "text-gray-500 dark:text-gray-400 hover:bg-green-100/80 dark:hover:bg-green-800/30 hover:text-green-600 dark:hover:text-green-400 hover:translate-y-[-1px] max-md:hover:bg-gray-100 dark:max-md:hover:bg-gray-600 max-md:hover:text-gray-700 dark:max-md:hover:text-gray-300 max-md:hover:transform-none"
                }`}
                onClick={() => handleRoleChange("instructor")}
                disabled={isLoading}
              >
                Instructor
              </button>
            </div>
          </div>

          <div className="[&>div]:mb-6 [&>div:last-child]:mb-0 [&>div]:relative max-md:[&>div]:mb-4">
            {/* Google sign-in (student gets a large, prominent CTA; instructor keeps manual fields) */}
            {formData.role === "student" ? (
              <div className="mb-6 flex justify-center">
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      // clear conflicting cached profile first so UI won't show old picture after OAuth
                      prepareOAuthSignIn();
                      const emailToCheck = formData.email || "";
                      const conflict = emailToCheck ? await checkRoleConflict(emailToCheck, formData.role) : false;
                      if (conflict) {
                        showError("That email is already associated with a different role. Use a different email or sign out first.", "Role conflict");
                        return;
                      }
                      await signIn("google", { callbackUrl: `/auth/oauth-callback?role=${formData.role}` });
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="w-full max-w-[560px] flex flex-col items-start gap-1 px-8 py-6 border border-green-200 rounded-3xl bg-white shadow-[0_20px_40px_rgba(2,6,23,0.08)] hover:shadow-[0_24px_48px_rgba(2,6,23,0.12)] text-left disabled:opacity-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex items-center justify-center w-10 h-10 rounded-full bg-white">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M21.35 11.1H12v2.8h5.35c-.23 1.35-.9 2.5-1.92 3.3v2.74h3.1c1.82-1.67 2.87-4.15 2.87-7.04 0-.66-.06-1.3-.18-1.9z" fill="#4285F4" />
                        <path d="M12 22c2.7 0 4.96-.9 6.62-2.45l-3.1-2.74c-.86.58-1.97.92-3.52.92-2.7 0-4.99-1.82-5.8-4.28H3.03v2.7C4.67 19.9 8.02 22 12 22z" fill="#34A853" />
                        <path d="M6.2 13.45a6.01 6.01 0 010-3.9V6.85H3.03A10 10 0 002 12c0 1.6.36 3.12 1.03 4.5l3.14-3.05z" fill="#FBBC05" />
                        <path d="M12 6.1c1.47 0 2.57.5 3.35.92l2.5-2.43C16.95 3.3 14.7 2 12 2 8.02 2 4.67 4.1 3.03 6.85l3.17 2.7C7.01 7.9 9.3 6.1 12 6.1z" fill="#EA4335" />
                      </svg>
                    </span>
                    <div>
                      <div className="text-lg font-semibold text-slate-900">Continue with Google</div>
                      <div className="text-sm text-slate-500">Use your @gordoncollege.edu.ph account</div>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        // clear conflicting cached profile first
                        prepareOAuthSignIn();
                        const emailToCheck = formData.email || "";
                        const conflict = emailToCheck ? await checkRoleConflict(emailToCheck, formData.role) : false;
                        if (conflict) {
                          showError("That email is already associated with a different role. Use a different email or sign out first.", "Role conflict");
                          return;
                        }
                        await signIn("google", { callbackUrl: `/auth/oauth-callback?role=${formData.role}` });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-green-300 rounded-2xl bg-white hover:bg-gray-50 text-sm font-semibold disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M21.35 11.1H12v2.8h5.35c-.23 1.35-.9 2.5-1.92 3.3v2.74h3.1c1.82-1.67 2.87-4.15 2.87-7.04 0-.66-.06-1.3-.18-1.9z" fill="#4285F4" />
                      <path d="M12 22c2.7 0 4.96-.9 6.62-2.45l-3.1-2.74c-.86.58-1.97.92-3.52.92-2.7 0-4.99-1.82-5.8-4.28H3.03v2.7C4.67 19.9 8.02 22 12 22z" fill="#34A853" />
                      <path d="M6.2 13.45a6.01 6.01 0 010-3.9V6.85H3.03A10 10 0 002 12c0 1.6.36 3.12 1.03 4.5l3.14-3.05z" fill="#FBBC05" />
                      <path d="M12 6.1c1.47 0 2.57.5 3.35.92l2.5-2.43C16.95 3.3 14.7 2 12 2 8.02 2 4.67 4.1 3.03 6.85l3.17 2.7C7.01 7.9 9.3 6.1 12 6.1z" fill="#EA4335" />
                    </svg>
                    Sign in with Google
                  </button>
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[0.9rem] font-semibold text-gray-700 dark:text-gray-300 mb-3 tracking-[-0.01em] max-md:text-xs max-md:font-semibold max-md:text-gray-500 dark:max-md:text-gray-400 max-md:mb-2 max-md:uppercase max-md:tracking-[0.025em]"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="login-input-focus w-full px-5 py-4 border border-green-500/15 dark:border-green-400/25 rounded-2xl text-[0.95rem] text-gray-900 dark:text-gray-100 bg-white/80 dark:bg-gray-800/80 backdrop-blur-[8px] outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] box-border font-medium focus:border-green-600 dark:focus:border-green-400 focus:shadow-[0_0_0_4px_rgba(34,197,94,0.08),0_8px_16px_rgba(34,197,94,0.1)] dark:focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15),0_8px_16px_rgba(34,197,94,0.2)] focus:bg-green-50/80 dark:focus:bg-green-900/20 focus:translate-y-[-2px] placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal max-md:px-[0.875rem] max-md:py-4 max-md:border max-md:border-gray-300 dark:max-md:border-gray-600 max-md:rounded-lg max-md:text-base max-md:text-gray-900 dark:max-md:text-gray-100 max-md:bg-white dark:max-md:bg-gray-800 max-md:backdrop-blur-none max-md:box-border max-md:font-normal max-md:min-h-[48px] max-md:focus:border-green-400 max-md:focus:shadow-[0_0_0_2px_rgba(34,197,94,0.1)] max-md:focus:bg-white dark:max-md:focus:bg-gray-800 max-md:focus:transform-none max-md:focus:outline-none max-md:placeholder:text-gray-400 dark:max-md:placeholder:text-gray-500 max-md:placeholder:font-normal max-md:placeholder:text-[0.95rem]"
                    placeholder="Enter your current account"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-[0.9rem] font-semibold text-gray-700 dark:text-gray-300 mb-3 tracking-[-0.01em] max-md:text-xs max-md:font-semibold max-md:text-gray-500 dark:max-md:text-gray-400 max-md:mb-2 max-md:uppercase max-md:tracking-[0.025em]"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="login-input-focus w-full px-5 py-4 pr-14 border border-green-500/15 dark:border-green-400/25 rounded-2xl text-[0.95rem] text-gray-900 dark:text-gray-100 bg-white/80 dark:bg-gray-800/80 backdrop-blur-[8px] outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] box-border font-medium focus:border-green-600 dark:focus:border-green-400 focus:shadow-[0_0_0_4px_rgba(34,197,94,0.08),0_8px_16px_rgba(34,197,94,0.1)] dark:focus:shadow-[0_0_0_4px_rgba(34,197,94,0.15),0_8px_16px_rgba(34,197,94,0.2)] focus:bg-green-50/80 dark:focus:bg-green-900/20 focus:translate-y-[-2px] placeholder:text-gray-400 dark:placeholder:text-gray-500 placeholder:font-normal max-md:px-[0.875rem] max-md:py-4 max-md:pr-12 max-md:border max-md:border-gray-300 dark:max-md:border-gray-600 max-md:rounded-lg max-md:text-base max-md:text-gray-900 dark:max-md:text-gray-100 max-md:bg-white dark:max-md:bg-gray-800 max-md:backdrop-blur-none max-md:box-border max-md:font-normal max-md:min-h-[48px] max-md:focus:border-green-400 max-md:focus:shadow-[0_0_0_2px_rgba(34,197,94,0.1)] max-md:focus:bg-white dark:max-md:focus:bg-gray-800 max-md:focus:transform-none max-md:focus:outline-none max-md:placeholder:text-gray-400 dark:max-md:placeholder:text-gray-500 max-md:placeholder:font-normal max-md:placeholder:text-[0.95rem]"
                      placeholder="Enter your password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:text-green-600 dark:focus:text-green-400 max-md:right-3 max-md:p-1"
                      disabled={isLoading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="max-md:w-5 max-md:h-5"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="max-md:w-5 max-md:h-5"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* only show manual submit for instructor */}
          {formData.role === "instructor" && (
           <div>
             <div className="flex items-center gap-3 mb-4">
               <label className="inline-flex items-center cursor-pointer text-sm select-none">
                 <input
                   type="checkbox"
                   checked={rememberMe}
                   onChange={(e) => setRememberMe(e.target.checked)}
                   className="mr-2 form-checkbox w-4 h-4 text-green-600"
                   disabled={isLoading}
                 />
                 Remember me
               </label>
             </div>
             <button
               type="submit"
               disabled={isLoading}
               className="w-full px-6 py-[1.125rem] bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white border-none rounded-2xl text-[0.95rem] font-bold cursor-pointer transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_12px_24px_-12px_rgba(34,197,94,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden tracking-[-0.01em] before:content-[''] before:absolute before:top-0 before:left-[-100%] before:w-full before:h-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:transition-[left] before:duration-500 hover:before:left-full hover:bg-gradient-to-br hover:from-green-500 hover:via-green-600 hover:to-green-700 hover:shadow-[0_20px_40px_rgba(34,197,94,0.4),inset_0_1px_0_rgba(255,255,255,0.3)] hover:translate-y-[-3px] active:translate-y-[-1px] active:shadow-[0_8px_16px_rgba(34,197,94,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none max-md:px-4 max-md:py-4 max-md:bg-green-400 max-md:text-white max-md:border-none max-md:rounded-lg max-md:text-base max-md:font-bold max-md:cursor-pointer max-md:transition-all max-md:duration-200 max-md:ease max-md:shadow-none max-md:relative max-md:overflow-hidden max-md:min-h-[48px] max-md:mt-2 max-md:before:hidden max-md:hover:bg-green-500 max-md:hover:shadow-[0_2px_8px_rgba(34,197,94,0.25)] max-md:hover:transform-none max-md:active:bg-green-600 max-md:active:transform-[scale(0.98)] max-md:active:shadow-none max-md:disabled:bg-gray-300 max-md:disabled:text-gray-500 max-md:disabled:cursor-not-allowed max-md:disabled:transform-none"
             >
               {isLoading ? (
                 <div className="flex items-center justify-center gap-3 max-md:gap-2">
                   <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin max-md:w-4 max-md:h-4 max-md:border-2 max-md:border-white/30 max-md:border-t-white max-md:rounded-full max-md:animate-spin"></span>
                   Signing in...
                 </div>
               ) : (
                 "Sign in"
               )}
             </button>
           </div>
          )}
          <div className="text-center mt-4 max-md:mt-6">
            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-green-600 dark:text-green-400 no-underline font-semibold text-[0.9rem] transition-all duration-300 ease relative tracking-[-0.01em] after:content-[''] after:absolute after:w-0 after:h-[2px] after:bottom-[-2px] after:left-1/2 after:bg-gradient-to-r after:from-green-600 after:to-green-500 dark:after:from-green-400 dark:after:to-green-500 after:transition-all after:duration-300 after:ease after:transform after:translate-x-[-50%] hover:text-green-700 dark:hover:text-green-300 hover:translate-y-[-1px] hover:after:w-full max-md:text-green-400 max-md:no-underline max-md:font-semibold max-md:text-sm max-md:transition-[color] max-md:duration-200 max-md:ease max-md:after:hidden max-md:hover:text-green-500 dark:max-md:hover:text-green-300 max-md:hover:transform-none"
            >
              Forgot password?
            </button>
          </div>
        </form>
      </div>

      {/* Forgot password modal */}
      {showForgotModal && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
            >
              <div
                onClick={() => setShowForgotModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <div className="relative z-10 max-w-3xl w-full bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100">Instruction</h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setShowForgotModal(false)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <div className="p-6 text-sm text-slate-700 dark:text-gray-300 leading-6">
                  <p className="mb-4">
                    For password reset requests and other reports for both GC Systems and Google Workspace account, kindly send an email to
                    <a className="ml-1 font-semibold text-blue-600 dark:text-blue-400" href="mailto:webadmin@gordoncollege.edu.ph">webadmin@gordoncollege.edu.ph</a>
                    using your domain email account or your registered alternate email account (personal) with the following format:
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 mb-4">
                    <p className="font-semibold text-slate-900 dark:text-gray-100">Subject:</p>
                    <p className="text-red-600 font-semibold">Password RESET Request for [GCES/GC LAMP/Google Account] (or the issue that you want to resolve)</p>
                    <ul className="mt-3 space-y-2">
                      <li><span className="font-semibold">Student Number:</span> [your student number]</li>
                      <li><span className="font-semibold">Student's Name (LN, FN MI):</span> [lastname, firstname, middle initial]</li>
                      <li><span className="font-semibold">Reason:</span> [state your reason here]</li>
                    </ul>
                    <p className="mt-3 text-xs text-slate-500 dark:text-gray-400">Note: Attach a clear and verifiable screenshot/s of the reported issue.</p>
                  </div>
                  <p>
                    Once verified, you will receive an email that contains the new account credentials. Only those emails that used the GC domain account or the registered alternate email account (personal email account that you registered using GCES) will be processed online. Otherwise, proceed to the MIS office (3rd floor, Rm. 302) to process your request.
                  </p>
                </div>
                <div className="flex justify-end gap-3 p-4 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-slate-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
