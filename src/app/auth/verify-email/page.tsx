"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

function VerifyEmailForm() {
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(0);
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // If no email in URL, redirect to signup
      router.push("/auth/signup");
    }
  }, [searchParams, router]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setVerificationCode(value);
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // block non-digit printable characters while allowing navigation/control keys
    if (e.key.length === 1 && !/\d/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("Text");
    if (/\D/.test(pasted)) {
      e.preventDefault();
      const digits = pasted.replace(/\D/g, "").slice(0, 6);
      setVerificationCode(digits);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (verificationCode.length !== 6) {
      showError("Please enter a 6-digit verification code", "Invalid Code");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.message || "Verification failed", "Verification Failed");
        return;
      }

      showSuccess("Email verified successfully! Welcome to GCQuest!", "Verification Successful");

      // Navigate to dashboard (user data should already be in localStorage from login)
      setTimeout(() => {
        const user = localStorage.getItem("user");
        if (user) {
          const userData = JSON.parse(user);
          // Update emailVerified status in localStorage
          userData.emailVerified = true;
          localStorage.setItem("user", JSON.stringify(userData));
          
          // Redirect based on role
          if (userData.role === "student") {
            window.location.href = "/student_page/dashboard";
          } else if (userData.role === "parent") {
            window.location.href = "/parent_page/dashboard";
          } else {
            window.location.href = "/dashboard";
          }
        } else {
          // If no user in localStorage, redirect to login
          window.location.href = "/auth/login";
        }
      }, 1500);

    } catch (error) {
      console.error("Verification error:", error);
      showError(
        "Network error. Please check your connection and try again.",
        "Connection Error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setIsResending(true);

    try {
      const response = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(data.message || "Failed to resend code", "Resend Failed");
        return;
      }

      showSuccess("Verification code sent successfully!", "Code Sent");
      setCountdown(60); // 60 second cooldown
      setVerificationCode(""); // Clear current code

    } catch (error) {
      console.error("Resend error:", error);
      showError(
        "Network error. Please check your connection and try again.",
        "Connection Error"
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden font-[Inter,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6 lg:p-8 transition-colors duration-300">

      {/* GCQuest Title */}
      <div className="relative z-10 mb-6 sm:mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold bg-gradient-to-br from-green-600 via-green-500 to-green-700 dark:from-green-400 dark:via-green-500 dark:to-green-600 bg-clip-text text-transparent tracking-tight relative after:content-[''] after:absolute after:bottom-[-12px] after:left-1/2 after:transform after:translate-x-[-50%] after:w-[80px] after:h-[4px] after:bg-gradient-to-r after:from-green-600 after:to-green-500 dark:after:from-green-400 dark:after:to-green-500 after:rounded-[2px] after:opacity-60">
          GCQuest
        </h1>
      </div>

      <div className="relative z-10 w-full max-w-md sm:max-w-lg p-6 sm:p-8 lg:p-10 bg-gradient-to-br from-white/98 to-white/95 dark:from-gray-800/95 dark:to-gray-900/98 backdrop-blur-[20px] rounded-2xl sm:rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(34,197,94,0.08)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4),0_0_0_1px_rgba(34,197,94,0.12)] border border-green-500/12 dark:border-green-400/20 transition-all duration-300 hover:shadow-[0_48px_100px_-12px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_48px_100px_-12px_rgba(0,0,0,0.6)]">
        {/* Back Button - Inside Container - Hidden on mobile/tablet */}
        <button
          type="button"
          className="hidden lg:flex absolute top-4 left-4 lg:top-6 lg:left-6 items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
          onClick={() => router.push("/auth/signup")}
          disabled={isLoading}
          aria-label="Go back to signup"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          <span>Back</span>
        </button>

        <div className="mb-6 sm:mb-8 lg:mt-14 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400 via-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_8px_20px_rgba(34,197,94,0.25)]">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Verify Your Email</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
            We've sent a 6-digit verification code to
          </p>
          <p className="text-green-600 dark:text-green-400 font-semibold text-sm sm:text-base">{email}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="verificationCode" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Verification Code
            </label>
            <input
              id="verificationCode"
              name="verificationCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={verificationCode}
              onChange={handleInputChange}
              onKeyDown={handleCodeKeyDown}
              onPaste={handleCodePaste}
              className="w-full px-4 py-4 border border-green-500/15 dark:border-green-400/25 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:border-green-600 dark:focus:border-green-400 focus:ring-4 focus:ring-green-100 dark:focus:ring-green-900/30 outline-none transition-all duration-200 text-center text-xl sm:text-2xl font-mono tracking-widest placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="000000"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Enter the 6-digit code sent to your email
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || verificationCode.length !== 6}
            className="w-full px-6 py-3 sm:py-4 bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-500 hover:via-green-600 hover:to-green-700 focus:ring-4 focus:ring-green-200 shadow-[0_8px_20px_rgba(34,197,94,0.25)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Verifying...
              </div>
            ) : (
              "Verify Email"
            )}
          </button>
        </form>

        <div className="text-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm sm:text-base">Didn't receive the code?</p>
          <button
            onClick={handleResendCode}
            disabled={countdown > 0 || isResending}
            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {isResending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-green-600/30 border-t-green-600 rounded-full animate-spin"></div>
                Sending...
              </span>
            ) : countdown > 0 ? (
              `Resend code in ${countdown}s`
            ) : (
              "Resend verification code"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
          <span className="text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}