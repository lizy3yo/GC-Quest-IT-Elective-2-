import Link from 'next/link';

export default function UploadFileCard() {
  return (
    <Link href="/student_page/flashcards/upload" className="group">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 hover:border-blue-500 hover:shadow-xl transition-all duration-300 h-full">
        <div className="text-center">
          <div className="w-25 h-25 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Upload File
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-3">
            Import flashcards from CSV, Excel, or text files to quickly create large sets
          </p>
          <ul className="text-slate-500 dark:text-slate-400 space-y-1">
            <li>✓ Quick bulk import</li>
            <li>✓ Supports multiple formats</li>
            <li>✓ Great for existing study materials</li>
          </ul>
        </div>
      </div>
    </Link>
  );
}
