"use client";

import "./student.css";
import { usePathname, useRouter } from "next/navigation";
import Breadcrumbs from "@/components/molecules/breadcrumbs/Breadcrumbs";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react"; // << added import
import Image from "next/image";

interface StudentLayoutProps {
  children: React.ReactNode;
}

interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  image?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  [key: string]: unknown; // allow extra fields without using any
}

interface CurrentUserResponseUser extends SessionUser {
  firstName?: string;
  lastName?: string;
  username?: string;
}

interface CurrentUserResponse {
  user?: CurrentUserResponseUser;
}

import Sidebar from "@/components/organisms/Sidebar";

export default function StudentLayout({ children }: StudentLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession(); // << get NextAuth session with status
  const [isMobile, setIsMobile] = useState(false);

  // Client-side authentication redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Mobile off-canvas menu state (separate from collapsed logic used on desktop)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null); // << new state
  const [userEmail, setUserEmail] = useState<string | null>(null); // << new state
  const [userImage, setUserImage] = useState<string | null>(null); // << new state
  const [currentTime, setCurrentTime] = useState<string>("");

  // Try to populate display info from (in order): DB (if available), session, localStorage
  useEffect(() => {
    let mounted = true;

    const applyLocal = () => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!mounted) return;
        // prefer firstName/lastName, fall back to username or name
        const name =
          (parsed.firstName && parsed.lastName && `${parsed.firstName} ${parsed.lastName}`) ||
          parsed.username ||
          parsed.name ||
          null;
        if (name) setUserName(name);
        if (parsed.email) setUserEmail(parsed.email);
        if (parsed.image) setUserImage(parsed.image);
      } catch {
        // ignore parse errors
      }
    };

    // apply localStorage immediately if present
    if (typeof window !== "undefined") applyLocal();

    // session.user tends to have name/email/image from Google provider
    if (session?.user) {
      const sUser = session.user as SessionUser;
      if (mounted) {
        if (sUser.name) setUserName((prev) => prev ?? sUser.name ?? null);
        if (sUser.email) setUserEmail((prev) => prev ?? sUser.email ?? null);
        if (sUser.image) setUserImage((prev) => prev ?? sUser.image ?? null);
      }
    }

    // Optionally fetch full user from DB if we have an id + accessToken
    (async () => {
      try {
        const userId = (session?.user as SessionUser | undefined)?.id || localStorage.getItem("userId");
        const token = localStorage.getItem("accessToken");
        if (!userId || !token) return;

        const res = await fetch(`/api/v1/users/current`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!res.ok) {
          // don't throw here — silently ignore so UI falls back to session/local data
          return;
        }

        // The current route returns { user }
        const json: CurrentUserResponse = await res.json().catch(() => ({}) as CurrentUserResponse);
        const dbUser = json.user;
        if (!mounted || !dbUser) return;

        const dbName =
          (dbUser.firstName && dbUser.lastName && `${dbUser.firstName} ${dbUser.lastName}`) ||
          dbUser.username ||
          dbUser.name ||
          null;
        if (typeof dbName === "string") setUserName(dbName);
        if (typeof dbUser.email === "string") setUserEmail(dbUser.email);
        if (typeof dbUser.image === "string") setUserImage(dbUser.image);
      } catch {
        // silent fallback; keep session/local values
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      // Auto-expand sidebar on mobile
      if (mobile) {
        setIsSidebarCollapsed(false);
        // Close off-canvas if switching to mobile to avoid inconsistent transform states
        setIsMobileMenuOpen(false);
      }
      if (!mobile) {
        // Ensure body scroll not locked when returning to desktop
        setIsMobileMenuOpen(false);
        document.body.classList.remove("overflow-hidden");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    if (isMobile && isMobileMenuOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }, [isMobile, isMobileMenuOpen]);

  // Close mobile menu on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobileMenuOpen]);

  // Update current time and date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
      
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const date = now.getDate();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Format time as 12-hour with AM/PM
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, "0");
      
      const timeString = `${dayName}, ${monthName} ${date} • ${displayHours}:${displayMinutes} ${period}`;
      setCurrentTime(timeString);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const toggleDarkMode = () => {
    const currentTheme = localStorage.getItem("theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleLogout = async () => {
    try {
      // Get the access token from localStorage
      const accessToken = localStorage.getItem("accessToken");

      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Include the Authorization header if token exists
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        credentials: "include",
      });

      // Even if logout fails on backend, clean up frontend
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");

      // Check if logout was successful
      if (response.ok) {
        console.log("Logout successful");
      } else {
        console.warn(
          "Logout request failed, but proceeding with frontend cleanup"
        );
      }

      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Logout failed:", error);

      // Still clean up frontend even if backend call fails
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");

      window.location.href = "/auth/login";
    }
  };

  // Helper to determine if sidebar should show expanded content
  const isExpanded = !isSidebarCollapsed;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Mobile Top Navbar */}
      {isMobile && (
        <header className={`fixed top-0 left-0 right-0 h-14 z-[70] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 backdrop-blur ${
          isMobileMenuOpen ? "bg-white dark:bg-slate-900" : "bg-white/70 dark:bg-slate-900/50"
        }`}>          
          <div className="flex items-center justify-between h-full relative">
            {/* Left: Hamburger Menu */}
            <button
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 z-10"
            >
              {/* Hamburger icon */}
              <svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>

            {/* Center: Logo */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Link href="/student_page/dashboard" className="flex items-center no-underline">
                <span className="text-lg font-bold text-[#04C40A] dark:text-[#04C40A] tracking-tight whitespace-nowrap">GCQuest</span>
              </Link>
            </div>

            {/* Right: Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 z-10"
            >
              <svg className="block dark:hidden" width="20" height="20" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg className="hidden dark:block" width="20" height="20" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          </div>
        </header>
      )}
      <div className="flex">
        <Sidebar
          isExpanded={isExpanded}
          isMobile={isMobile}
          isMobileMenuOpen={isMobileMenuOpen}
          toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          closeMobileMenu={() => setIsMobileMenuOpen(false)}
          userImage={userImage}
          userName={userName}
          userEmail={userEmail}
          handleLogout={handleLogout}
        />

        {/* Mobile overlay */}
        {isMobile && isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main Content Area */}
        <main
          className={`flex-1 p-8 transition-all duration-300 ${
            isMobile ? "ml-0 pt-16" : isExpanded ? "ml-80" : "ml-20"
          }`}
        >
          {/* Top bar with Breadcrumbs and Time */}
          <div className="flex items-center justify-between mb-6">
            {/* Breadcrumbs only visible on lg and above (hidden on mobile/tablet) */}
            <div className="flex-1">
              <Breadcrumbs />
            </div>
            
            {/* Current Time and Date - hidden on mobile */}
            {!isMobile && currentTime && (
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap ml-4">
                {currentTime}
              </div>
            )}
          </div>
          
          {children}
        </main>
      </div>
    </div>
  );
}
