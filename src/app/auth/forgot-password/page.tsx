"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { showError, showSuccess, showInfo } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'OAUTH_ACCOUNT') {
          showInfo(data.message, "Google Account Detected");
        } else {
          showError(data.message || "Failed to send reset email", "Error");
        }
        return;
      }

      showSuccess(data.message, "Reset Email Sent");
      
      // Redirect to reset password page after a short delay
      setTimeout(() => {
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);

    } catch (error) {
      console.error("Forgot password error:", error);
      showError(
        "Network error. Please check your connection and try again.",
        "Connection Error"
      );
    } finally {
      setIsLoading(false);
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
          className="hidden lg:flex absolute top-4 left-4 lg:top-6 lg:left-6 items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 text-sm font-medium cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md"
          onClick={() => router.push("/auth/login")}
          disabled={isLoading}
          aria-label="Go back to login"
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
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          <span>Back to Login</span>
        </button>

        <div className="mb-6 sm:mb-8 lg:mt-14 text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
            Forgot Password?
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            Enter your email address and we&apos;ll send you a reset code
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-green-500/15 dark:border-green-400/25 rounded-xl text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:border-green-600 dark:focus:border-green-400 focus:ring-4 focus:ring-green-100 dark:focus:ring-green-900/30 outline-none transition-all duration-200 text-base placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your email address"
              disabled={isLoading}
            />
          </div>

          {/* Send Reset Code Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 sm:py-4 bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-500 hover:via-green-600 hover:to-green-700 focus:ring-4 focus:ring-green-200 shadow-[0_8px_20px_rgba(34,197,94,0.25)] transition-all duration-200 disabled:opacity-50 text-base"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Sending Reset Code...
              </div>
            ) : (
              "Send Reset Code"
            )}
          </button>

          {/* Sign In Link */}
          <div className="text-center pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              Remember your password?{" "}
              <button
                type="button"
                onClick={() => router.push("/auth/login")}
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-semibold transition-colors"
                disabled={isLoading}
              >
                Sign in here
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}