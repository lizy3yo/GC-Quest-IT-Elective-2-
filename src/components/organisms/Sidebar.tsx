"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

interface SidebarProps {
  isExpanded: boolean;
  isMobile: boolean;
  isMobileMenuOpen: boolean;
  toggleSidebar: () => void;
  closeMobileMenu: () => void;
  userImage: string | null;
  userName: string | null;
  userEmail: string | null;
  handleLogout: () => void;
}

export default function Sidebar({
  isExpanded,
  isMobile,
  isMobileMenuOpen,
  toggleSidebar,
  closeMobileMenu,
  userImage,
  userName,
  userEmail,
  handleLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isLibraryDropdownOpen, setIsLibraryDropdownOpen] = useState(false);

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 ${
        !isExpanded && isProfileDropdownOpen ? "allow-overflow" : "overflow-hidden"
      } fixed left-0 top-0 bottom-0 z-50 shadow-[2px_0_8px_rgba(0,0,0,0.04)] transition-all duration-300 ${
        !isExpanded ? "w-20" : "w-80"
      } ${isMobile ? (isMobileMenuOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0"}`}
    >
      <div className="flex flex-col h-full max-h-screen">
        {/* Header Section */}
        <div className={`sidebar-header flex-shrink-0 ${isExpanded ? "px-6 pt-6 pb-3" : "p-2"}`}>
          <div className="flex items-center justify-between mb-0">
            {isExpanded && (
              <Link href="/student_page/dashboard" className="flex items-center">
                <h1 className="text-[#04C40A] dark:text-[#04C40A] text-3xl font-extrabold m-0 tracking-tight">
                  GCQuest
                </h1>
              </Link>
            )}
            {isMobile ? (
              <button
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <svg width="22" height="22" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            ) : (
              <button
                onClick={toggleSidebar}
                aria-label={!isExpanded ? "Expand sidebar" : "Collapse sidebar"}
                className={`p-2 rounded-lg transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ${
                  !isExpanded ? "mx-auto" : ""
                }`}
              >
                <svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                  <path strokeWidth={2} strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="border-b border-slate-200 dark:border-slate-800"></div>

        {/* Navigation Section */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            className="h-full overflow-y-auto scrollbar-hide sidebar-nav"
            style={{ maxHeight: "calc(100vh - var(--sidebar-header-height) - var(--sidebar-footer-height))" }}
          >
            <nav className="pt-4 pb-4">
              <div className="mb-6">
                <Link
                  href="/student_page/dashboard"
                  className={`flex items-center ${
                    !isExpanded
                      ? "justify-center w-full p-2.5 mx-0"
                      : "gap-4 px-5 py-2.5 mx-4"
                  } text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${
                    isExpanded ? "hover:translate-x-1" : ""
                  } ${
                    pathname === "/student_page/dashboard"
                      ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                      : ""
                  }`}
                  title={!isExpanded ? "Home" : ""}
                >
                  <svg
                    className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                      pathname === "/student_page/dashboard"
                        ? "text-[#2E7D32]"
                        : ""
                    }`}
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 15v-4a2 2 0 012-2h4a2 2 0 012 2v4"
                    />
                  </svg>
                  {isExpanded && (
                    <span className="whitespace-nowrap">Home</span>
                  )}
                </Link>

                <Link
                  href="/student_page/student_class"
                  className={`flex items-center ${
                    !isExpanded
                      ? "justify-center w-full p-2.5 mx-0"
                      : "gap-4 px-5 py-2.5 mx-4"
                  } text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${
                    isExpanded ? "hover:translate-x-1" : ""
                  } ${
                    pathname === "/student_page/student_class"
                      ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                      : ""
                  }`}
                  title={!isExpanded ? "Your Classes" : ""}
                >
                  <svg
                    className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                      pathname === "/student_page/student_class"
                        ? "text-[#2E7D32]"
                        : ""
                    }`}
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  {isExpanded && (
                    <span className="whitespace-nowrap">Your Classes</span>
                  )}
                </Link>

                {/* Library Dropdown */}
                <div className="relative">
                  {!isExpanded ? (
                    <button
                      onClick={() => {
                        setIsLibraryDropdownOpen(true);
                      }}
                      className={`flex items-center justify-center w-full p-2.5 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 mx-0 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 bg-transparent border-none ${
                        pathname === "/student_page/private_library" ||
                        pathname === "/student_page/public_library"
                          ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                          : ""
                      }`}
                      title="Library"
                    >
                      <svg
                        className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                          pathname === "/student_page/private_library" ||
                          pathname === "/student_page/public_library"
                            ? "text-[#2E7D32]"
                            : ""
                        }`}
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setIsLibraryDropdownOpen(!isLibraryDropdownOpen)
                      }
                      className={`flex items-center gap-4 px-5 py-2.5 text-slate-500 dark:text-slate-400 text-sm font-medium transition-all duration-300 mx-4 w-[calc(100%-2rem)] rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1 ${
                        pathname === "/student_page/private_library" ||
                        pathname === "/student_page/public_library"
                          ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                          : ""
                      } bg-transparent border-none cursor-pointer`}
                    >
                      <svg
                        className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                          pathname === "/student_page/private_library" ||
                          pathname === "/student_page/public_library"
                            ? "text-[#2E7D32]"
                            : ""
                        }`}
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253v-13zM16.5 5c1.747 0 3.332.477 4.5 1.253v13c-1.168.776-2.754 1.253-4.5 1.253v-13z"
                      />
                      </svg>
                      <span className="whitespace-nowrap flex-1 text-left">
                        Library
                      </span>
                      <svg
                        className={`ml-auto flex-shrink-0 transition-transform duration-200 ${
                          isLibraryDropdownOpen ? "rotate-180" : ""
                        }`}
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Dropdown Content */}
                  {isLibraryDropdownOpen && isExpanded && (
                    <div className="relative ml-3 mt-1">
                      {/* Main vertical line */}
                      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-slate-300 dark:bg-[#2E2E2E]"></div>

                      <div className="pl-6 space-y-1">
                        <div className="relative">
                          <Link
                            href="/student_page/private_library"
                            className={`flex items-center gap-3 px-5 py-2.5 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 mx-4 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1 ${
                              pathname === "/student_page/private_library"
                                ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                                : ""
                            }`}
                          >
                            <svg
                              className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                                pathname === "/student_page/private_library"
                                  ? "text-[#2E7D32]"
                                  : ""
                              }`}
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                            <span className="whitespace-nowrap">
                              Private Library
                            </span>
                          </Link>
                        </div>

                        <div className="relative">
                          <Link
                            href="/student_page/public_library"
                            className={`flex items-center gap-3 px-5 py-2.5 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 mx-4 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 hover:translate-x-1 ${
                              pathname === "/student_page/public_library"
                                ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                                : ""
                            }`}
                          >
                            <svg
                              className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                                pathname === "/student_page/public_library"
                                  ? "text-[#2E7D32]"
                                  : ""
                              }`}
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M15 7a3 3 0 11-6 0 3 3 0 016 0zM21 10a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                            <span className="whitespace-nowrap">
                              Public Library
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider between Library and Flashcards when collapsed */}
              {!isExpanded && (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  className="mx-auto my-3 w-9/12 h-px bg-slate-200 dark:bg-slate-700"
                />
              )}

              <div className="mb-4">
                {isExpanded && (
                  <div className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-wider px-6 mb-3">
                    Quick Access
                  </div>
                )}

                <Link
                  href="/student_page/flashcards"
                  className={`flex items-center ${
                    !isExpanded
                      ? "justify-center w-full p-2.5 mx-0"
                      : "gap-4 px-5 py-2.5 mx-4"
                  } text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${
                    isExpanded ? "hover:translate-x-1" : ""
                  } ${
                    pathname === "/student_page/flashcards"
                      ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                      : ""
                  }`}
                  title={!isExpanded ? "Flashcards" : ""}
                >
                  <svg
                    className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                      pathname === "/student_page/flashcards"
                        ? "text-[#2E7D32]"
                        : ""
                    }`}
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  {isExpanded && (
                    <span className="whitespace-nowrap">Flashcards</span>
                  )}
                </Link>

                <Link
                  href="/student_page/to_do_list"
                  className={`flex items-center ${
                    !isExpanded
                      ? "justify-center w-full p-2.5 mx-0"
                      : "gap-4 px-5 py-2.5 mx-4"
                  } text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${
                    isExpanded ? "hover:translate-x-1" : ""
                  } ${
                    pathname === "/student_page/to_do_list"
                      ? "bg-[#E8F5E9] text-[#2E7D32] font-semibold shadow-[0_2px_8px_rgba(46,125,50,0.15)]"
                      : ""
                  }`}
                  title={!isExpanded ? "To-do List" : ""}
                >
                  <svg
                    className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                      pathname === "/student_page/to_do_list" ? "text-[#2E7D32]" : ""
                    }`}
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 8h6M9 12h6M9 16h4M9 3v2m6-2v2"
                    />
                  </svg>
                  {isExpanded && (
                    <span className="whitespace-nowrap">To-do List</span>
                  )}
                </Link>


                   <Link
                  href="/student_page/practice_tests"
                  className={`flex items-center ${
                    !isExpanded
                      ? "justify-center w-full p-2.5 mx-0"
                      : "gap-4 px-5 py-2.5 mx-4"
                  } text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${
                    isExpanded ? "hover:translate-x-1" : ""
                  } ${
                    pathname === "/student_page/practice_tests"
                      ? "bg-gradient-to-br from-green-500/10 to-green-600/5 text-green-500 font-semibold shadow-[0_2px_8px_rgba(34,197,94,0.1)]"
                      : ""
                  }`}
                  title={!isExpanded ? "Practice Tests" : ""}
                >
                  <svg
                    className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                      pathname === "/student_page/practice_tests"
                        ? "text-green-500"
                        : ""
                    }`}
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                  {isExpanded && (
                    <span className="whitespace-nowrap">
                      Practice Tests
                    </span>
                  )}
                </Link>

                <Link
                  href="/student_page/study_mode"
                  className={`flex items-center ${
                    !isExpanded
                      ? "justify-center w-full p-2.5 mx-0"
                      : "gap-4 px-5 py-2.5 mx-4"
                  } text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-300 rounded-xl hover:bg-[#E8F5E9] dark:hover:bg-slate-800 hover:text-[#2E7D32] dark:hover:text-slate-200 ${
                    isExpanded ? "hover:translate-x-1" : ""
                  } ${
                    pathname === "/student_page/study_mode"
                      ? "bg-gradient-to-br from-green-500/10 to-green-600/5 text-green-500 font-semibold shadow-[0_2px_8px_rgba(34,197,94,0.1)]"
                      : ""
                  }`}
                  title={!isExpanded ? "Study Mode" : ""}
                >
                  <svg
                    className={`flex-shrink-0 transition-transform duration-300 hover:scale-110 ${
                      pathname === "/student_page/study_mode"
                        ? "text-green-500"
                        : ""
                    }`}
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  {isExpanded && (
                    <span className="whitespace-nowrap">Study Mode</span>
                  )}
                </Link>
              </div>
            </nav>
          </div>
        </div>

        {/* Profile Section */}
        <div className="sidebar-footer flex-shrink-0 border-t border-slate-200 dark:border-slate-800 p-6">
          <div className="relative user-profile">
            <button
              className={`flex items-center w-full p-3 rounded-xl transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-800 group ${
                !isExpanded ? "justify-center" : "gap-4"
              }`}
              onClick={() => {
                if (!isExpanded) {
                  setIsProfileDropdownOpen(true);
                  return;
                }
                setIsProfileDropdownOpen(!isProfileDropdownOpen);
              }}
              title={!isExpanded ? (userName || "Student User") : ""}
            >
              <div className="relative w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 transition-all duration-300 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 group-hover:border-[#1C2B1C] group-hover:shadow-[0_0_0_4px_rgba(30,93,66,0.1)] group-hover:bg-gradient-to-br group-hover:from-[#1C2B1C] group-hover:to-[#1C2B1C] flex-shrink-0 overflow-hidden">
                {userImage ? (
                  <Image
                    src={userImage}
                    alt="avatar"
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  <svg
                    className="text-slate-500 dark:text-slate-400 transition-colors duration-300 group-hover:text-white"
                    width="24"
                    height="24"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {userName ?? "Student User"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {userEmail ?? "student@example.com"}
                  </div>
                </div>
              )}
            </button>

            {isProfileDropdownOpen && (
              <div className={`${
                  isExpanded
                    ? "absolute bottom-[calc(100%+0.5rem)] left-0 right-0"
                    : "absolute bottom-[calc(100%+0.5rem)] left-[calc(100%+0.5rem)] w-64"
                } bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_10px_10px_-5px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4),0_10px_10px_-5px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-800 z-[1000] overflow-hidden animate-in slide-in-from-bottom-2 duration-200`}>
                <div className="py-2 border-b border-slate-100 dark:border-slate-800">
                  <Link
                    href="/student_page/achievements"
                    className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-200 border-none bg-transparent w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
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
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    <span>Achievements</span>
                  </Link>

                  <Link
                    href="/student_page/settings"
                    className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-200 border-none bg-transparent w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
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
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>Settings</span>
                  </Link>
                </div>

                <div className="py-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    className="group flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 no-underline text-sm font-medium transition-all duration-200 border-none bg-transparent w-full text-left cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600"
                    onClick={handleLogout}
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

                <div className="py-2">
                  <Link
                    href="/student_page/privacy_policy"
                    className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-200 border-none bg-transparent w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
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
                        d="M9 12l2 2 4-4m5-6v6a7 7 0 11-14 0V6a7 7 0 1114 0z"
                      />
                    </svg>
                    <span>Privacy Policy</span>
                  </Link>

                  <Link
                    href="/student_page/help"
                    className="group flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 no-underline text-sm font-medium transition-all duration-200 border-none bg-transparent w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
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
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Help & Support</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
