import { ReactNode } from 'react';

export default function CoordinatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {children}
    </div>
  );
}
