import { ResourceItem } from "@/interfaces";

interface ResourcePreviewModalProps {
  resource: ResourceItem;
  onClose: () => void;
}

export default function ResourcePreviewModal({ resource, onClose }: ResourcePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate pr-4">{resource.title}</div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          <iframe
            src={resource.url}
            title={resource.title}
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </div>
  );
}
