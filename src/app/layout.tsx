import { SessionProvider } from 'next-auth/react';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/contexts/ToastContext';
import type { Metadata, Viewport } from 'next';
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Enhanced SEO Metadata
export const metadata: Metadata = {
  title: {
    default: 'GC Quest - Interactive Learning Platform',
    template: '%s | GC Quest',
  },
  description: 'GC Quest is an interactive learning platform featuring flashcards, practice tests, study rooms, and AI-powered study tools for students and teachers.',
  keywords: ['education', 'learning', 'flashcards', 'study', 'quiz', 'assessment', 'e-learning', 'students', 'teachers'],
  authors: [{ name: 'GC Quest Team' }],
  creator: 'GC Quest',
  publisher: 'GC Quest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'GC Quest',
    title: 'GC Quest - Interactive Learning Platform',
    description: 'Transform your learning experience with AI-powered flashcards, practice tests, and collaborative study rooms.',
    images: [
      {
        url: '/gc-logo.png',
        width: 512,
        height: 512,
        alt: 'GC Quest Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GC Quest - Interactive Learning Platform',
    description: 'Transform your learning experience with AI-powered flashcards, practice tests, and collaborative study rooms.',
    images: ['/gc-logo.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/gc-logo.png',
  },
  manifest: '/manifest.json',
  category: 'education',
};

// Viewport configuration
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body className={inter.className}>
        <SessionProvider refetchOnWindowFocus={false}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}