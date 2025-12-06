"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * This page redirects to the Private Library.
 * The general library has been deprecated in favor of separate Public and Private libraries.
 */
function LibraryRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve any query parameters (like tab)
    const params = searchParams.toString();
    const destination = params 
      ? `/student_page/private_library?${params}` 
      : '/student_page/private_library';
    
    router.replace(destination);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090909]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">Redirecting to Private Library...</p>
      </div>
    </div>
  );
}

export default function LibraryRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090909]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <LibraryRedirect />
    </Suspense>
  );
}
