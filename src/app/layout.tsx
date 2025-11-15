import { SessionProvider } from 'next-auth/react';
import { Inter } from 'next/font/google';
import './globals.css'
import ThemeProvider from "@/utils/ThemeProvider";
import QueryProvider from '@/utils/QueryProvider';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'GC Quest',
  description: 'Flashcard platform for learning',
  // Next.js 15 automatically uses icon.png in the app directory
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider refetchOnWindowFocus={false}>
          <QueryProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}