"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLibraryDropdownOpen, setIsLibraryDropdownOpen] = useState(false);

  // Client-side authentication redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTouchExpanded, setIsTouchExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const mouseMoveHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const bufferActiveRef = useRef(false);
  const COLLAPSE_BUFFER = 96;

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
        if (parsed.image) setUserImage(parsed.image);
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

        const json = await res.json().catch(() => ({} as any));
        const dbUser = json?.user ?? json;
        if (!mounted || !dbUser) return;

        const dbName =
          (dbUser.firstName && dbUser.lastName && `${dbUser.firstName} ${dbUser.lastName}`) ||
          dbUser.username ||
          dbUser.name ||
          null;
        if (dbName) setUserName(dbName);
        if (dbUser.email) setUserEmail(dbUser.email);
        if (dbUser.image) setUserImage(dbUser.image);
      } catch {
        // silent
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session]);

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

      window.location.href = "/auth/login";
    } catch (error) {
      console.error("Logout failed:", error);
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      window.location.href = "/auth/login";
    }
  };

  const isExpanded = !isSidebarCollapsed || isTouchExpanded;

  // Navigation items (update this list to reflect your folders/routes)
  const navItems: { href: string; label: string; match: (p?: string | null) => boolean; icon: React.ReactNode }[] = [
    {
      href: "/teacher_page/dashboard",
      label: "Dashboard",
      match: (p) => p === "/teacher_page/dashboard",
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
        </svg>
      ),
    },
    {
      href: "/teacher_page/class",
      label: "Classes",
      match: (p) => p === "/teacher_page/class",
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      href: "/teacher_page/analytics",
      label: "Analytics",
      match: (p) => p === "/teacher_page/analytics",
      icon: (
        <svg className="flex-shrink-0 transition-transform duration-300 hover:scale-110" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v18M20 12v6M2 7v12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
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
                    <svg className={`transition-transform duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {isExpanded ? (
                <div className="relative -mx-2">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search"
                    className="w-full py-2.5 pl-12 pr-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none transition-all duration-300 font-medium text-slate-500 dark:text-slate-400 placeholder:text-slate-400 dark:placeholder:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border-green-500 focus:text-slate-900 dark:focus:text-slate-100 focus:shadow-[0_0_0_4px_rgba(34,197,94,0.1)]"
                  />
                  <svg className="absolute left-6 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 z-10 transition-colors duration-200 flex-shrink-0" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsTouchExpanded(true);
                      setTimeout(() => searchInputRef.current?.focus(), 0);
                    }}
                    className="w-full flex items-center justify-center p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                    title="Search"
                  >
                    <svg className="text-slate-500 dark:text-slate-400" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto scrollbar-hide" style={{ maxHeight: "calc(100vh - 280px)" }}>
                <nav className="py-4">
                  <div className="mb-6">
                    {navItems.slice(0, 2).map((item) => {
                      const active = item.match(pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={!isExpanded ? item.label : ""}
                          className={`flex items-center ${!isExpanded ? "justify-center w-full p-2.5 mx-0" : "gap-4 px-5 py-2.5 mx-4"} text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 ${isExpanded ? "hover:translate-x-1" : ""} ${active ? "bg-gradient-to-br from-green-500/10 to-green-600/5 text-green-500 font-semibold shadow-[0_2px_8px_rgba(34,197,94,0.1)]" : ""}`}
                        >
                          {React.cloneElement(item.icon as any, { className: `${(item.icon as any).props.className} ${active ? "text-green-500" : ""}` })}
                          {isExpanded && <span className="truncate text-sm text-slate-700 dark:text-slate-200">{item.label}</span>}
                        </Link>
                      );
                    })}

                    <div className="relative">{isLibraryDropdownOpen && isExpanded && null}</div>
                  </div>

                  <div className="mb-4">
                    {/* "Start here" header removed */}

                    {navItems.slice(2).map((item) => {
                      const active = item.match(pathname);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={!isExpanded ? item.label : ""}
                          className={`flex items-center ${!isExpanded ? "justify-center w-full p-2.5 mx-0" : "gap-4 px-5 py-2.5 mx-4"} text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 ${isExpanded ? "hover:translate-x-1" : ""} ${active ? "bg-gradient-to-br from-green-500/10 to-green-600/5 text-green-500 font-semibold shadow-[0_2px_8px_rgba(34,197,94,0.1)]" : ""}`}
                        >
                          {React.cloneElement(item.icon as any, { className: `${(item.icon as any).props.className} ${active ? "text-green-500" : ""}` })}
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
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{userName ?? "Teacher"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{userEmail ?? ""}</div>
                    </div>
                  )}
                </button>

                {isProfileDropdownOpen && (
                  <div className={`${isExpanded ? "absolute bottom-[calc(100%+0.5rem)] left-0 right-0" : "absolute bottom-[calc(100%+0.5rem)] left-[calc(100%+0.5rem)] w-72"} bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4),0_10px_10px_-5px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-800 z-[1000] overflow-hidden animate-in slide-in-from-bottom-2 duration-200`}>
      
                    {/* quick links and actions */}
                    <div className="py-2">

                      <Link href="/teacher_page/settings" className="group flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-300 no-underline text-sm font-medium transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                        Settings
                      </Link>

                      <button
                        onClick={toggleDarkMode}
                        className="w-full text-left px-4 py-3 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-200 flex items-center gap-3"
                        aria-label="Toggle dark mode"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500 dark:text-slate-300">
                          <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                        Dark mode
                      </button>
                    </div>

                    {/* footer actions */}
                    <div className="py-2 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md transition-colors duration-150">
                        Sign out
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

        <main className={`flex-1 p-8 transition-all duration-300 ${isMobile ? "ml-0 pt-16" : isExpanded ? "ml-80" : "ml-20"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}