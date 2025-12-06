"use client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import Image from "next/image";
import "./home-page.css";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      // Redirect authenticated users - they can choose their dashboard from the home page
      // or we can fetch their role from the API if needed
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Image
                src="/gc-logo.png"
                alt="GC Quest Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                GC Quest
              </h1>
            </div>
            <button
              onClick={() => router.push("/auth/login")}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                GC Quest
              </span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Your interactive learning platform for creating engaging quizzes, assessments, and study materials
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push("/auth/login")}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                Get Started
              </button>
              <button
                onClick={() => router.push("/landing")}
                className="px-8 py-4 bg-white text-gray-700 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:border-green-600 hover:text-green-600 transition-all"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Quizzes</h3>
              <p className="text-gray-600 text-sm">Build engaging quizzes with multiple question types</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Live Sessions</h3>
              <p className="text-gray-600 text-sm">Host real-time interactive quiz sessions</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Track Progress</h3>
              <p className="text-gray-600 text-sm">Monitor student performance with detailed analytics</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Study Resources</h3>
              <p className="text-gray-600 text-sm">Access a library of educational materials</p>
            </div>
          </div>

          {/* Quick Access Cards */}
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-8 rounded-3xl text-white shadow-2xl">
              <h3 className="text-3xl font-bold mb-4">For Teachers</h3>
              <p className="text-green-50 mb-6">
                Create engaging lessons, track student progress, and manage your classroom efficiently
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Create unlimited quizzes
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Real-time analytics
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Manage multiple classes
                </li>
              </ul>
              <button
                onClick={() => router.push("/auth/login")}
                className="w-full py-3 bg-white text-green-600 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Start Teaching
              </button>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-8 rounded-3xl text-white shadow-2xl">
              <h3 className="text-3xl font-bold mb-4">For Students</h3>
              <p className="text-blue-50 mb-6">
                Learn at your own pace, practice with interactive quizzes, and track your improvement
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Interactive learning
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Track your progress
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Study anytime, anywhere
                </li>
              </ul>
              <button
                onClick={() => router.push("/auth/login")}
                className="w-full py-3 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Start Learning
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <Image
                src="/gc-logo.png"
                alt="GC Quest Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-xl font-bold">GC Quest</span>
            </div>
            <p className="text-gray-400 text-sm">
              &copy; 2025 GC Quest. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
