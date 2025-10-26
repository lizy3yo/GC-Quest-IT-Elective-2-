"use client";
import Link from "next/link";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import "./home.css";

export default function Home() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Close mobile menu when screen size changes to tablet/desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="main-container">
      {/* Header */}
      <header
        className={`header ${isMobileMenuOpen ? "mobile-menu-open" : ""}`}
      >
        <div className="header-content">
          <div className="header-inner">
            <div className="logo-section">
              <div className="logo-wrapper">
                <Image
                  src="/gc-logo.png"
                  alt="GC Quest Logo"
                  width={44}
                  height={44}
                  className="logo-image"
                />
              </div>
              <h1 className="logo-text">GC Quest</h1>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="navigation desktop-nav">
              <a href="#features" className="nav-link">
                Features
              </a>
              <a href="#how-it-works" className="nav-link">
                How It Works
              </a>
              <a href="#pricing" className="nav-link">
                Pricing
              </a>
            </nav>
            
            <div className="header-buttons">
              <button
                className="get-started-btn desktop-get-started"
                onClick={() => router.push("/auth/login")}
              >
                Get Started
              </button>
              
              {/* Mobile Menu Button */}
              <button 
                className="mobile-menu-btn"
                onClick={toggleMobileMenu}
                aria-label="Toggle mobile menu"
              >
                <div className={`hamburger ${isMobileMenuOpen ? 'active' : ''}`}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </button>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          <div className={`mobile-nav ${isMobileMenuOpen ? 'active' : ''}`}>
            <nav className="mobile-nav-content">
              <a href="#features" className="mobile-nav-link" onClick={toggleMobileMenu}>Features</a>
              <a href="#how-it-works" className="mobile-nav-link" onClick={toggleMobileMenu}>How It Works</a>
              <a href="#pricing" className="mobile-nav-link" onClick={toggleMobileMenu}>Pricing</a>
              <button className="mobile-get-started-btn" onClick={() => { router.push('/auth/login'); toggleMobileMenu(); }}>
                Get Started
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg"></div>
        <div className="hero-decoration"></div>

        <div className="hero-content">
          <h2 className="hero-title">
            Study tools that teach,
            <span className="hero-title-highlight">
              not tell
            </span>
          </h2>

          <p className="hero-description">
            Build confidence and master every subject with GC Quest&apos;s interactive flashcards,
            personalized practice tests, and engaging study games.
          </p>

          <div className="hero-buttons">
            <button className="hero-btn-primary"
              onClick={() => router.push('/auth/login')}
            >
              Get Started
            </button>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-20 max-w-6xl mx-auto">
            <div className="bg-white p-8 rounded-2xl text-center border border-gray-100 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-[#1C2B1C]/30 shadow-md">
              <div className="w-16 h-16 bg-[#1C2B1C]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all hover:bg-[#1C2B1C] hover:scale-110 group">
                <svg className="w-8 h-8 text-[#1C2B1C] transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Get relevant content</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Access millions of study sets created by students and teachers</p>
            </div>

            <div className="bg-white p-8 rounded-2xl text-center border border-gray-100 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-[#1C2B1C]/30 shadow-md">
              <div className="w-16 h-16 bg-[#1C2B1C]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all hover:bg-[#1C2B1C] hover:scale-110 group">
                <svg className="w-8 h-8 text-[#1C2B1C] transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Jump into studying</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Start learning immediately with interactive study modes</p>
            </div>

            <div className="bg-white p-8 rounded-2xl text-center border border-gray-100 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-[#1C2B1C]/30 shadow-md">
              <div className="w-16 h-16 bg-[#1C2B1C]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all hover:bg-[#1C2B1C] hover:scale-110 group">
                <svg className="w-8 h-8 text-[#1C2B1C] transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Learn anything</h3>
              <p className="text-sm text-gray-600 leading-relaxed">From languages to sciences, master any subject at your pace</p>
            </div>

            <div className="bg-white p-8 rounded-2xl text-center border border-gray-100 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-[#1C2B1C]/30 shadow-md">
              <div className="w-16 h-16 bg-[#1C2B1C]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all hover:bg-[#1C2B1C] hover:scale-110 group">
                <svg className="w-8 h-8 text-[#1C2B1C] transition-colors group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Review with friends</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Study together and share progress with your study group</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white relative overflow-hidden">
  <div className="absolute top-0 right-0 w-96 h-96 bg-[#1C2B1C]/10 rounded-full blur-3xl opacity-50"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#1C2B1C]/10 text-[#1C2B1C] text-sm font-medium mb-6">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Dual-Mode Learning System
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Two Powerful Quiz Modes
            </h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Flexible learning solutions designed for every classroom scenario and learning style
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Live Quiz Mode */}
            <div className="relative p-8 rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 transition-all hover:shadow-2xl hover:-translate-y-2 group">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg transition-transform group-hover:scale-110">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>

                <h4 className="text-3xl font-bold text-gray-900 mb-6">Live Quiz Presentations</h4>
                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                  Host interactive, real-time quizzes that engage your entire classroom.
                  Students participate instantly using their devices while you control the pace and energy.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center p-3 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700">Real-time participation & instant engagement</span>
                  </div>
                  <div className="flex items-center p-3 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700">Instant feedback and live results</span>
                  </div>
                  <div className="flex items-center p-3 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700">Enhanced classroom engagement</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Deadline-Based Quiz Mode */}
            <div className="relative p-8 rounded-3xl border border-[#1C2B1C]/30 bg-white transition-all hover:shadow-2xl hover:-translate-y-2 group">
              <div className="absolute inset-0 bg-[#1C2B1C]/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

              <div className="relative">
                <div className="w-16 h-16 bg-[#1C2B1C] rounded-2xl flex items-center justify-center mb-8 shadow-lg transition-transform group-hover:scale-110">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>

                <h4 className="text-3xl font-bold text-gray-900 mb-6">Self-Paced Quizzes</h4>
                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                  Assign flexible quizzes with deadlines that students can complete at their own pace,
                  perfect for homework, assessments, and independent learning journeys.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center p-3 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-[#1C2B1C] rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700">Flexible deadline management</span>
                  </div>
                  <div className="flex items-center p-3 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-[#1C2B1C] rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700">Self-paced learning experience</span>
                  </div>
                  <div className="flex items-center p-3 bg-white/60 rounded-xl">
                    <div className="w-8 h-8 bg-[#1C2B1C] rounded-lg flex items-center justify-center mr-4">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-700">Advanced progress tracking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-[#1C2B1C]/5 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#1C2B1C]/10 rounded-full blur-3xl opacity-40"></div>
  <div className="absolute top-1/2 right-0 w-64 h-64 bg-[#1C2B1C]/10 rounded-full blur-2xl opacity-30"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-[#1C2B1C]/10 text-[#1C2B1C] text-sm font-medium mb-6">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Simple 3-Step Process
            </div>
            <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Simple. Powerful. Effective.
            </h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in minutes with our intuitive platform designed for educators
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center relative">
              <div className="relative">
                <div className="w-20 h-20 bg-[#1C2B1C] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl transition-all hover:shadow-2xl hover:scale-110">
                  <span className="text-3xl font-bold text-white">1</span>
                </div>
                <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-[#1C2B1C]/30 -z-10"></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg transition-all hover:shadow-xl border border-gray-100">
                <h4 className="text-2xl font-bold text-gray-900 mb-4">Create Your Quiz</h4>
                <p className="text-gray-600 leading-relaxed">
                  Build engaging quizzes with multiple question types, rich media, and interactive elements using our intuitive drag-and-drop interface
                </p>
              </div>
            </div>

            <div className="text-center relative">
              <div className="relative">
                <div className="w-20 h-20 bg-[#1C2B1C] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl transition-all hover:shadow-2xl hover:scale-110">
                  <span className="text-3xl font-bold text-white">2</span>
                </div>
                <div className="hidden md:block absolute top-10 left-full w-full h-0.5 bg-[#1C2B1C]/30 -z-10"></div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg transition-all hover:shadow-xl border border-gray-100">
                <h4 className="text-2xl font-bold text-gray-900 mb-4">Choose Your Mode</h4>
                <p className="text-gray-600 leading-relaxed">
                  Host live presentations for immediate classroom engagement or assign deadline-based quizzes for flexible learning
                </p>
              </div>
            </div>

            <div className="text-center relative">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl transition-all hover:shadow-2xl hover:scale-110">
                  <span className="text-3xl font-bold text-white">3</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg transition-all hover:shadow-xl border border-gray-100">
                <h4 className="text-2xl font-bold text-gray-900 mb-4">Track & Analyze</h4>
                <p className="text-gray-600 leading-relaxed">
                  Monitor student progress with detailed analytics, identify learning gaps, and gain actionable insights to improve outcomes
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
  <section className="py-24 bg-[#1C2B1C] relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Ready to Transform Your Classroom?
            </h3>
            <p className="text-xl md:text-2xl text-white/90 mb-12 leading-relaxed">
              Join thousands of educators already using GC Quest to enhance learning experiences
              and boost student engagement across the globe
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <button className="bg-white text-[#1C2B1C] px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105">
                <span className="flex items-center">
                  Start Your Free Trial
                  <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
              <button className="border-2 border-white/30 text-white px-10 py-4 rounded-2xl text-lg font-semibold hover:bg-white/10 hover:border-white/50 transition-all">
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Schedule Demo
                </span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mt-12 text-white/80">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No credit card required
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                14-day free trial
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
  <footer className="bg-[#123A28] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12">
            <div className="col-span-1">
              <div className="flex items-center mb-6">
                <div className="relative">
                  <Image
                    src="/gc-logo.png"
                    alt="GC Quest Logo"
                    width={40}
                    height={40}
                    className="mr-3 rounded-lg"
                  />
                </div>
                <h4 className="text-2xl font-bold text-white">
                  GC Quest
                </h4>
              </div>
              <p className="text-gray-300 leading-relaxed mb-6">
                Empowering educators with interactive quiz solutions for modern classrooms and digital learning environments.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 bg-[#1C2B1C] rounded-lg flex items-center justify-center hover:brightness-110 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 bg-[#1C2B1C] rounded-lg flex items-center justify-center hover:brightness-110 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z" />
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 bg-[#1C2B1C] rounded-lg flex items-center justify-center hover:brightness-110 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h5 className="text-lg font-bold text-white mb-6">Product</h5>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Demo</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Integrations</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">API</a></li>
              </ul>
            </div>

            <div>
              <h5 className="text-lg font-bold text-white mb-6">Support</h5>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Community</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Documentation</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Status</a></li>
              </ul>
            </div>

            <div>
              <h5 className="text-lg font-bold text-white mb-6">Company</h5>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">About</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Press</a></li>
                <li><a href="#" className="text-gray-300 hover:text-[#1C2B1C] transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                &copy; 2025 GC Quest. All rights reserved.
              </p>
              <div className="flex gap-6 mt-4 md:mt-0">
                <a href="#" className="text-gray-400 hover:text-[#1C2B1C] text-sm transition-colors">Terms</a>
                <a href="#" className="text-gray-400 hover:text-[#1C2B1C] text-sm transition-colors">Privacy</a>
                <a href="#" className="text-gray-400 hover:text-[#1C2B1C] text-sm transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}