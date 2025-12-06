"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Chatbot from "@/components/organisms/Chatbot/chatbot/Chatbot";
// import TeacherBreadcrumbs from "@/components/ui/breadcrumbs/TeacherBreadcrumbs";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ChevronsUpDown } from "lucide-react";
import LogoutConfirmationModal from "@/components/molecules/LogoutConfirmationModal";

interface TeacherLayoutProps {
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
  [key: string]: unknown;
}

function TeacherLayoutContent({ children }: TeacherLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLibraryDropdownOpen, setIsLibraryDropdownOpen] = useState(false);

  // Client-side authentication redirect
  useEffect(() => {
    // Check both NextAuth session and manual auth tokens
    const hasManualAuth = () => {
      if (typeof window === "undefined") return false;
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      return !!(accessToken || refreshToken);
    };

    // Only redirect if BOTH session is unauthenticated AND no manual auth tokens
    if (status === "unauthenticated" && !hasManualAuth()) {
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTouchExpanded, setIsTouchExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const bufferActiveRef = useRef(false);
  const COLLAPSE_BUFFER = 96;
  
  // Current time and date state
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Disable breadcrumb sessionStorage operations for teacher pages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storage: any = sessionStorage;
    const origSet = storage.setItem.bind(storage);
    const origRemove = storage.removeItem.bind(storage);
    storage.setItem = (key: string, value: string) => {
      if (typeof key === 'string' && key.startsWith('breadcrumb_')) return;
      return origSet(key, value);
    };
    storage.removeItem = (key: string) => {
      if (typeof key === 'string' && key.startsWith('breadcrumb_')) return;
      return origRemove(key);
    };
    return () => {
      storage.setItem = origSet;
      storage.removeItem = origRemove;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyLocal = () => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!mounted) return;
        const name =
          (parsed.firstName && parsed.lastName && `${parsed.firstName} ${parsed.lastName}`) ||
          parsed.username ||
          parsed.name ||
          null;
        if (name) setUserName(name);
        if (parsed.email) setUserEmail(parsed.email);
        // Handle profile image - set to null if empty/removed, otherwise use the image
        const imageUrl = parsed.profileImage || parsed.image || null;
        setUserImage(imageUrl || null);
      } catch {
        // ignore
      }
    };

    if (typeof window !== "undefined") applyLocal();

    if (session?.user) {
      const sUser = session.user as SessionUser;
      if (mounted) {
        if (sUser.name) setUserName((prev) => prev ?? sUser.name ?? null);
        if (sUser.email) setUserEmail((prev) => prev ?? sUser.email ?? null);
        if (sUser.image) setUserImage((prev) => prev ?? sUser.image ?? null);
      }
    }

    (async () => {
      try {
        const userId = (session?.user as SessionUser | undefined)?.id || localStorage.getItem("userId");
        const token = localStorage.getItem("accessToken");
        if (!userId || !token) return;

        const res = await fetch(`/api/v1/users/current`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!res.ok) return;

        const json = await res.json().catch(() => ({} as unknown));
        const dbUser = json?.user ?? json;
        if (!mounted || !dbUser) return;

        const dbName =
          (dbUser.firstName && dbUser.lastName && `${dbUser.firstName} ${dbUser.lastName}`) ||
          dbUser.username ||
          dbUser.name ||
          null;
        if (dbName) setUserName(dbName);
        if (dbUser.email) setUserEmail(dbUser.email);
        if (dbUser.profileImage || dbUser.image) setUserImage(dbUser.profileImage || dbUser.image);
      } catch {
        // silent
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session]);

  // Listen for profile updates (upload/remove photo)
  useEffect(() => {
    const handleProfileUpdate = () => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) {
          setUserImage(null);
          return;
        }
        const parsed = JSON.parse(raw);
        const imageUrl = parsed.profileImage || parsed.image || null;
        setUserImage(imageUrl || null);
      } catch {
        // ignore
      }
    };

    window.addEventListener("profileUpdated", handleProfileUpdate);
    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdate);
    };
  }, []);

  const stopBufferCollapse = () => {
    bufferActiveRef.current = false;
    if (mouseMoveHandlerRef.current) {
      window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
      mouseMoveHandlerRef.current = null;
    }
  };

  const startBufferCollapse = () => {
    if (bufferActiveRef.current) return;
    const el = sidebarRef.current;
    if (!el) return;
    bufferActiveRef.current = true;
    const rect = el.getBoundingClientRect();
    const thresholdX = rect.right + COLLAPSE_BUFFER;
    const handler = (e: MouseEvent) => {
      if (!bufferActiveRef.current) return;
      if (e.clientX > thresholdX) {
        setIsTouchExpanded(false);
        setIsProfileDropdownOpen(false);
        setIsLibraryDropdownOpen(false);
        stopBufferCollapse();
      }
    };
    mouseMoveHandlerRef.current = handler;
    window.addEventListener("mousemove", handler);
  };

  useEffect(() => stopBufferCollapse, []);

  const handleTouchExpansion = () => {
    if (isSidebarCollapsed && isMobile) {
      setIsTouchExpanded(!isTouchExpanded);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isTouchExpanded && !target.closest("aside")) {
        setIsTouchExpanded(false);
      }
    };

    if (isTouchExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isTouchExpanded]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isProfileDropdownOpen && !target.closest(".user-profile")) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileDropdownOpen]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarCollapsed(false);
        setIsMobileMenuOpen(false);
      }
      if (!mobile) {
        setIsMobileMenuOpen(false);
        document.body.classList.remove("overflow-hidden");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update current time and date
  useEffect(() => {
    setIsMounted(true);
    
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const dateString = now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setCurrentTime(`${timeString} • ${dateString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isMobile && isMobileMenuOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }, [isMobile, isMobileMenuOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMobileMenuOpen]);

  const toggleDarkMode = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");

      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        credentials: "include",
      });

      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");

      if (!response.ok) {
        console.warn("Logout request failed, frontend cleaned up anyway");
      }

      window.location.href = "/auth/login?reason=logout";
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      window.location.href = "/auth/login?reason=logout";
    }
  };

  const isExpanded = !isSidebarCollapsed || isTouchExpanded;

  const navItems: { href: string; label: string; match: (p?: string | null) => boolean; icon: React.ReactNode }[] = [
    {
      href: "/teacher_page/dashboard",
      label: "Dashboard",
      match: (p?: string | null) => p === "/teacher_page/dashboard",
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
        </svg>
      ),
    },
    {
      href: "/teacher_page/classes",
      label: "Classes",
      match: (p?: string | null) => (p ? p.startsWith("/teacher_page/classes") : false),
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      href: "/teacher_page/assessment",
      label: "Assessments",
      match: (p?: string | null) => (p ? p.startsWith("/teacher_page/assessment") : false),
        icon: (
          <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        ),
      },
      {
        href: "/teacher_page/library",
        label: "Library",
        match: (p?: string | null) => (p ? p.startsWith("/teacher_page/library") || p.startsWith("/teacher_page/flashcard") : false),
        icon: (
          <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
      {
        href: "/teacher_page/leaderboards",
        label: "Leaderboards",
        match: (p?: string | null) => p === "/teacher_page/leaderboards",
        icon: (
          <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        ),
      },
  ];

  const quickAccessItems = [
    {
      href: "/teacher_page/ai-studio",
      label: "AI Assessments",
      match: (p?: string | null) => p === "/teacher_page/ai-studio",
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      href: "/teacher_page/ai-studio-resources",
      label: "AI Resources",
      match: (p?: string | null) => p === "/teacher_page/ai-studio-resources",
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      href: "/teacher_page/study_rooms",
      label: "Study Rooms",
      match: (p?: string | null) => (p ? p.startsWith("/teacher_page/study_rooms") : false),
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`min-h-screen bg-slate-50 transition-colors duration-300 ${resolvedTheme === 'dark' ? 'dark' : ''}`} style={resolvedTheme === 'dark' ? { backgroundColor: '#090909' } : {}}>
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 z-[70] bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
            >
              <svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Link href="/teacher_page/dashboard" className="flex items-center no-underline">
              <span className="text-lg font-bold bg-gradient-to-br from-green-500 to-green-600 bg-clip-text text-transparent tracking-tight">GCQuest</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
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
        <aside
          ref={sidebarRef}
          className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 ${!isExpanded && isProfileDropdownOpen ? "allow-overflow" : "overflow-hidden"} fixed left-0 top-0 bottom-0 z-50 shadow-[2px_0_8px_rgba(0,0,0,0.04)] transition-all duration-300 ${isSidebarCollapsed && !isTouchExpanded ? "w-20" : "w-80"} ${isMobile ? (isMobileMenuOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"}`}
          onClick={handleTouchExpansion}
          onMouseEnter={() => {
            stopBufferCollapse();
          }}
          onMouseLeave={() => {
            if (!isMobile && isSidebarCollapsed && isTouchExpanded) {
              startBufferCollapse();
            }
          }}
        >
          <div className="flex flex-col h-full max-h-screen">
            <div className={`flex-shrink-0 ${isExpanded ? "p-6" : "p-2"} border-b border-slate-200 dark:border-slate-800`}>
              <div className="flex items-center justify-between mb-8">
                {isExpanded && (
                  <Link href="/teacher_page/dashboard" className="flex items-center">
                    <h1 className="bg-gradient-to-br from-green-500 to-green-600 bg-clip-text text-transparent text-3xl font-extrabold m-0 tracking-tight">GCQuest</h1>
                  </Link>
                )}

                {isMobile ? (
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-label="Close menu"
                    className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <svg width="22" height="22" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                      <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={`p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ${isSidebarCollapsed ? "mx-auto" : ""}`}
                  >
                    {/* Hamburger icon to match mobile navbar */}
                    <svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                      <path strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                    </svg>
                  </button>
                )}
              </div>


            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto scrollbar-hide" style={{ maxHeight: "calc(100vh - 280px)" }}>
                <nav className="py-4">
                  <div className="mb-6">
                    {navItems.map((item) => {
                      const active = item.match(pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={!isExpanded ? item.label : ""}
                          className={`flex items-center ${!isExpanded ? "justify-center w-full p-2.5 mx-0" : "gap-4 px-5 py-2.5 mx-4"} text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${isExpanded ? "hover:translate-x-1" : ""} ${active ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]" : ""}`}
                        >
                          {React.cloneElement(item.icon as any, { className: `${(item.icon as any).props.className} ${active ? "text-[#2E7D32]" : ""}` })}
                          {isExpanded && <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mb-4">
                    {isExpanded && (
                      <div className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider px-6 mb-3">
                        Quick Access
                      </div>
                    )}

                    {quickAccessItems.map((item) => {
                      const active = item.match(pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={!isExpanded ? item.label : ""}
                          className={`flex items-center ${!isExpanded ? "justify-center w-full p-2.5 mx-0" : "gap-4 px-5 py-2.5 mx-4"} text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${isExpanded ? "hover:translate-x-1" : ""} ${active ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]" : ""}`}
                        >
                          {React.cloneElement(item.icon as any, { className: `${(item.icon as any).props.className} ${active ? "text-[#2E7D32]" : ""}` })}
                          {isExpanded && <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </nav>
              </div>
            </div>

            <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 p-6">
              <div className="relative user-profile">
                <button
                  className={`flex items-center w-full p-3 rounded-xl transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-800 group ${!isExpanded ? "justify-center" : "gap-4"}`}
                  onClick={() => {
                    if (!isExpanded) {
                      setIsProfileDropdownOpen(true);
                      return;
                    }
                    setIsProfileDropdownOpen(!isProfileDropdownOpen);
                  }}
                  title={!isExpanded ? (userName || "Teacher User") : ""}
                >
                  <div className="relative w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 transition-all duration-300 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 group-hover:border-green-500 group-hover:shadow-[0_0_0_4px_rgba(34,197,94,0.1)] group-hover:bg-gradient-to-br group-hover:from-green-500 group-hover:to-green-600 flex-shrink-0 overflow-hidden">
                    {userImage ? (
                      <Image src={userImage} alt="avatar" fill sizes="40px" className="object-cover" onError={() => setUserImage(null)} />
                    ) : (
                      <svg className="text-slate-500 dark:text-slate-400 transition-colors duration-300 group-hover:text-white" width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {isExpanded && (
                    <>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{userName ?? "Teacher"}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{userEmail ?? ""}</div>
                      </div>
                      <ChevronsUpDown className="flex-shrink-0 text-slate-400 dark:text-slate-500 transition-colors duration-300 group-hover:text-slate-600 dark:group-hover:text-slate-300" size={16} />
                    </>
                  )}
                </button>

                {isProfileDropdownOpen && (
                  <div className={`${isExpanded ? "absolute bottom-[calc(100%+0.5rem)] left-0 right-0" : "absolute bottom-[calc(100%+0.5rem)] left-[calc(100%+0.5rem)] w-72"} bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4),0_10px_10px_-5px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-800 z-[1000] overflow-hidden animate-in slide-in-from-bottom-2 duration-200`}>
      
                    {/* Profile and quick links */}
                    <div className="py-2 border-b border-slate-100 dark:border-slate-800">
                      <Link
                        href="/teacher_page/profile"
                        className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 border-none bg-transparent w-full text-left cursor-pointer rounded-lg hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1"
                      >
                        <svg
                          className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span>Profile</span>
                      </Link>
                    </div>

                    {/* quick links and actions */}
                    <div className="py-2">

                      <Link href="/teacher_page/history" className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1">
                        <svg className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>History</span>
                      </Link>

                      <Link href="/teacher_page/analytics" className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1">
                        <svg className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Analytics</span>
                      </Link>

                      <button
                        onClick={toggleDarkMode}
                        className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 border-none bg-transparent w-full text-left cursor-pointer hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1"
                        aria-label="Toggle dark mode"
                      >
                        <svg className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path className="block dark:hidden" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                          <path className="hidden dark:block" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                        <span className="block dark:hidden">Dark Mode</span>
                        <span className="hidden dark:block">Light Mode</span>
                      </button>
                    </div>

                    {/* footer actions */}
                    <div className="py-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setIsLogoutModalOpen(true)}
                        className="group flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 no-underline text-sm font-medium transition-all duration-200 border-none bg-transparent w-full text-left cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600"
                      >
                        <svg
                          className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                          width="18"
                          height="18"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        <span>Log out</span>
                      </button>
                    </div>
                  </div>
                 )}
              </div>
            </div>
          </div>
        </aside>

        {isMobile && isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
        )}

        <main className={`flex-1 transition-all duration-300 ${isMobile ? "ml-0 pt-16" : isExpanded ? "ml-80" : "ml-20"}`}>
          {/* Top bar with Breadcrumbs and Time - Sticky */}
          <div className="sticky top-0 z-40 bg-slate-50 dark:bg-[#090909] px-8 py-4 mb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              {/* Breadcrumbs only visible on lg and above (hidden on mobile/tablet) */}
              <div className="flex-1">
                {/* Breadcrumbs disabled: <TeacherBreadcrumbs /> */}
              </div>
              
              {/* Current Time and Date - hidden on mobile */}
              {!isMobile && isMounted && currentTime && (
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap ml-4">
                  {currentTime}
                </div>
              )}
            </div>
          </div>
          
          <div className="px-8 pb-8">
            {children}
          </div>
        </main> 
      </div>
      
      {/* Chatbot for authenticated teachers */}
      <Chatbot isAuthenticated={true} />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        userName={userName}
      />
    </div>
  );
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  return (
    <ThemeProvider>
      <TeacherLayoutContent>{children}</TeacherLayoutContent>
    </ThemeProvider>
  );
}