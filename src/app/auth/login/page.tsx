"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import "./login-mobile.css";

interface LoginData {
  email: string;
  password: string;
  role: "student" | "parent";
}

interface Student {
  _id: string;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  emailVerified?: boolean;
}

interface LoginResponse {
  Student: Student;
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
  const [showCoordinatorModal, setShowCoordinatorModal] = useState(false);
  const [coordinatorEmail, setCoordinatorEmail] = useState("");
  const [coordinatorPassword, setCoordinatorPassword] = useState("");
  const [showCoordinatorPassword, setShowCoordinatorPassword] = useState(false);
  const [coordinatorRole, setCoordinatorRole] = useState<"instructor" | "coordinator">("coordinator");
  const [coordinatorRememberMe, setCoordinatorRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  
  // Load remembered credentials based on selected role
  useEffect(() => {
    const loadCredentials = () => {
      try {
        const storageKey = `remembered_${formData.role}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const creds = JSON.parse(stored) as { email?: string; password?: string };
          if (creds?.email && creds?.password) {
            setFormData(prev => ({
              ...prev,
              email: creds.email || "",
              password: creds.password || ""
            }));
            setRememberMe(true);
            return;
          }
        }
        // Clear form when switching to a role without saved credentials
        setFormData(prev => ({
          ...prev,
          email: "",
          password: ""
        }));
        setRememberMe(false);
      } catch {
        // ignore errors
      }
    };
    
    loadCredentials();
  }, [formData.role]);
  
  // Show an error when redirected after a rejected Google sign-in (non-Gordon domain)
  // or when session expires, or show success on logout
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
      } else if (reason === "session_expired") {
        showError(
          "Your session has expired due to inactivity. Please sign in again.",
          "Session Expired"
        );
        // Clear the query string to avoid repeated alerts
        router.replace(window.location.pathname);
      } else if (reason === "logout") {
        showSuccess(
          "You have been successfully logged out.",
          "Logged Out"
        );
        // Clear the query string to avoid repeated alerts
        router.replace(window.location.pathname);
      }
    } catch (err) {
      // noop
    }
  }, [router, showError, showSuccess]);



  // Coordinator shortcut: Ctrl+Shift+C or Cmd+Shift+C
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setShowCoordinatorModal(true);
      }
      if (showCoordinatorModal && e.key === 'Escape') {
        setShowCoordinatorModal(false);
        // Only clear credentials if remember me is not checked
        if (!coordinatorRememberMe) {
          setCoordinatorEmail("");
          setCoordinatorPassword("");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCoordinatorModal]);

  // Load remembered coordinator credentials based on selected role
  useEffect(() => {
    if (!showCoordinatorModal) return;
    
    const loadCoordinatorCredentials = () => {
      try {
        const storageKey = `remembered_${coordinatorRole}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const creds = JSON.parse(stored) as { email?: string; password?: string };
          if (creds?.email && creds?.password) {
            setCoordinatorEmail(creds.email);
            setCoordinatorPassword(creds.password);
            setCoordinatorRememberMe(true);
            return;
          }
        }
        // Clear form when switching to a role without saved credentials
        setCoordinatorEmail("");
        setCoordinatorPassword("");
        setCoordinatorRememberMe(false);
      } catch {
        // ignore errors
      }
    };
    
    loadCoordinatorCredentials();
  }, [showCoordinatorModal, coordinatorRole]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRoleChange = (role: "student" | "parent") => {
    setFormData((prev) => ({
      ...prev,
      role,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
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

      // Check if email is verified (only for students and parents)
      if ((formData.role === "student" || formData.role === "parent") && !loginData.Student.emailVerified) {
        // Store user data temporarily
        localStorage.setItem("user", JSON.stringify(loginData.Student));
        localStorage.setItem("userId", loginData.Student._id);
        localStorage.setItem("accessToken", loginData.accessToken);
        
        // Automatically send verification email
        try {
          const verifyResponse = await fetch("/api/auth/send-verification", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: loginData.Student.email }),
          });

          if (verifyResponse.ok) {
            showSuccess("Verification code sent to your email", "Email Not Verified");
          } else {
            showError("Please verify your email before accessing your dashboard", "Email Not Verified");
          }
        } catch (err) {
          console.error("Failed to send verification email:", err);
          showError("Please verify your email before accessing your dashboard", "Email Not Verified");
        }
        
        // Redirect to verification page
        setTimeout(() => {
          router.push(`/auth/verify-email?email=${encodeURIComponent(loginData.Student.email)}`);
        }, 1500);
        return;
      }

      // Store user data
      localStorage.setItem("user", JSON.stringify(loginData.Student));
      localStorage.setItem("userId", loginData.Student._id);
      localStorage.setItem("accessToken", loginData.accessToken);

      // Save credentials if remember me is checked (role-specific storage)
      const storageKey = `remembered_${formData.role}`;
      if (rememberMe) {
        localStorage.setItem(storageKey, JSON.stringify({
          email: formData.email,
          password: formData.password
        }));
      } else {
        localStorage.removeItem(storageKey);
      }

      showSuccess("Login successful! Redirecting...", "Welcome back");

      // Navigate based on user role
      setTimeout(() => {
        switch (loginData.Student.role) {
          case "admin":
            router.push("/admin");
            break;
          case "coordinator":
            router.push("/coordinator_page");
            break;
          case "teacher":
          case "instructor":
            router.push("/teacher_page/dashboard");
            break;
          case "student":
            router.push("/student_page/dashboard");
            break;
          case "parent":
            router.push("/parent_page");
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



  // Coordinator quick login
  const handleCoordinatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: coordinatorEmail,
          password: coordinatorPassword,
          role: coordinatorRole, // Send the selected role
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiError;
        showError(errorData.message || "Invalid credentials", "Login Failed");
        return;
      }

      const loginData = data as LoginResponse;

      // Store user data
      localStorage.setItem("user", JSON.stringify(loginData.Student));
      localStorage.setItem("userId", loginData.Student._id);
      localStorage.setItem("accessToken", loginData.accessToken);

      const roleLabel = coordinatorRole === "coordinator" ? "Coordinator" : "Instructor";
      showSuccess(`${roleLabel} access granted! Redirecting...`, "Welcome");

      // Save credentials if remember me is checked (role-specific storage)
      const storageKey = `remembered_${coordinatorRole}`;
      if (coordinatorRememberMe) {
        localStorage.setItem(storageKey, JSON.stringify({
          email: coordinatorEmail,
          password: coordinatorPassword
        }));
      } else {
        localStorage.removeItem(storageKey);
      }

      // Close modal and redirect based on role
      setShowCoordinatorModal(false);
      setTimeout(() => {
        if (coordinatorRole === "coordinator") {
          router.push("/coordinator_page");
        } else {
          // Ensure instructors go to the dashboard (not the base teacher_page route)
          router.push("/teacher_page/dashboard");
        }
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);
      showError("Network error. Please try again.", "Connection Error");
    } finally {
      setIsLoading(false);
      if (!coordinatorRememberMe) {
        setCoordinatorEmail("");
        setCoordinatorPassword("");
        setCoordinatorRole("coordinator");
      }
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center relative overflow-hidden font-[Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800"
      data-login-page
    >
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
                  formData.role === "parent"
                    ? "bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white shadow-[0_8px_20px_rgba(34,197,94,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] transform scale-[1.02] max-md:bg-green-400 max-md:text-white max-md:shadow-[0_2px_8px_rgba(34,197,94,0.25)] max-md:transform-none"
                    : "text-gray-500 dark:text-gray-400 hover:bg-green-100/80 dark:hover:bg-green-800/30 hover:text-green-600 dark:hover:text-green-400 hover:translate-y-[-1px] max-md:hover:bg-gray-100 dark:max-md:hover:bg-gray-600 max-md:hover:text-gray-700 dark:max-md:hover:text-gray-300 max-md:hover:transform-none"
                }`}
                onClick={() => handleRoleChange("parent")}
                disabled={isLoading}
              >
                Parent
              </button>
            </div>
          </div>

          <div className="[&>div]:mb-6 [&>div:last-child]:mb-0 [&>div]:relative max-md:[&>div]:mb-4">
            {/* Manual login fields for all roles */}
            <>
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
          </div>
          {/* Show manual submit for all roles */}
          {(formData.role === "student" || formData.role === "parent") && (
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
              onClick={() => router.push("/auth/forgot-password")}
              className="text-green-600 dark:text-green-400 no-underline font-semibold text-[0.9rem] transition-all duration-300 ease relative tracking-[-0.01em] after:content-[''] after:absolute after:w-0 after:h-[2px] after:bottom-[-2px] after:left-1/2 after:bg-gradient-to-r after:from-green-600 after:to-green-500 dark:after:from-green-400 dark:after:to-green-500 after:transition-all after:duration-300 after:ease after:transform after:translate-x-[-50%] hover:text-green-700 dark:hover:text-green-300 hover:translate-y-[-1px] hover:after:w-full max-md:text-green-400 max-md:no-underline max-md:font-semibold max-md:text-sm max-md:transition-[color] max-md:duration-200 max-md:ease max-md:after:hidden max-md:hover:text-green-500 dark:max-md:hover:text-green-300 max-md:hover:transform-none"
            >
              Forgot password?
            </button>
          </div>
        </form>
      </div>

      {/* Coordinator Quick Login Modal */}
          {showCoordinatorModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
              <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-green-500/20 dark:border-green-400/30 animate-slideUp">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {coordinatorRole === "instructor" ? "Instructor Access" : "Coordinator Access"}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {coordinatorRole === "instructor" ? "Quick login for instructors" : "Quick login for coordinators"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowCoordinatorModal(false);
                        // Only clear credentials if remember me is not checked
                        if (!coordinatorRememberMe) {
                          setCoordinatorEmail("");
                          setCoordinatorPassword("");
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      disabled={isLoading}
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
                        className="text-gray-500 dark:text-gray-400"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Body */}
                <form onSubmit={handleCoordinatorLogin} className="p-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-green-600 dark:text-green-400 flex-shrink-0"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Shortcut: <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-green-300 dark:border-green-600 rounded text-xs font-mono">Ctrl+Shift+C</kbd>
                      </p>
                    </div>

                    {/* Role Selector */}
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Select Role
                    </label>
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setCoordinatorRole("instructor")}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          coordinatorRole === "instructor"
                            ? "bg-green-500 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        Instructor
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoordinatorRole("coordinator")}
                        disabled={isLoading}
                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          coordinatorRole === "coordinator"
                            ? "bg-green-500 text-white shadow-md"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        Coordinator
                      </button>
                    </div>

                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={coordinatorEmail}
                      onChange={(e) => setCoordinatorEmail(e.target.value)}
                      placeholder="Enter coordinator email"
                      required
                      disabled={isLoading}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-500/20 dark:focus:ring-green-400/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCoordinatorPassword ? "text" : "password"}
                        value={coordinatorPassword}
                        onChange={(e) => setCoordinatorPassword(e.target.value)}
                        placeholder="Enter coordinator password"
                        autoFocus
                        required
                        disabled={isLoading}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-500/20 dark:focus:ring-green-400/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCoordinatorPassword(!showCoordinatorPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        disabled={isLoading}
                        tabIndex={-1}
                      >
                        {showCoordinatorPassword ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
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
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="mb-4">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coordinatorRememberMe}
                        onChange={(e) => setCoordinatorRememberMe(e.target.checked)}
                        disabled={isLoading}
                        className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Remember me
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !coordinatorEmail || !coordinatorPassword}
                    className="w-full px-6 py-3 bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      <>
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                          <polyline points="10 17 15 12 10 7" />
                          <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                        {coordinatorRole === "instructor" ? "Access Instructor" : "Access Coordinator"}
                      </>
                    )}
                  </button>
                </form>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    This is a secure {coordinatorRole} access point
                  </p>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
