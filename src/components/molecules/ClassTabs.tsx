interface ClassTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function ClassTabs({ activeTab, setActiveTab }: ClassTabsProps) {
  return (
    <nav className="mb-6 bg-transparent">
      <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
        {["Overview", "Resources and Assessments", "Class List"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 text-sm font-medium transition-colors ${activeTab === tab
                ? "text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white -mb-[2px]"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </nav>
  );
}
