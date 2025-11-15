import { ResourceItem } from "@/interfaces";
import { useState } from "react";
import ResourcePreviewModal from "./ResourcePreviewModal";

interface ResourcesProps {
  resources: ResourceItem[];
}

function FileIcon({ name, type, size = 20 }: { name?: string; type?: string; size?: number }) {
  const rawName = name || '';
  const maybeExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : undefined;
  const mime = (type || '').toLowerCase();

  let key = 'file-generic';
  if (maybeExt) {
    if (maybeExt === 'pdf') key = 'file-pdf';
    else if (['doc', 'docx'].includes(maybeExt)) key = 'file-doc';
    else if (['xls', 'xlsx'].includes(maybeExt)) key = 'file-xls';
    else if (['ppt', 'pptx'].includes(maybeExt)) key = 'file-ppt';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(maybeExt)) key = 'file-img';
    else key = 'file-generic';
  } else if (mime.includes('pdf')) key = 'file-pdf';
  else if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) key = 'file-doc';
  else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml')) key = 'file-xls';
  else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('officedocument.presentationml')) key = 'file-ppt';
  else if (mime.startsWith('image/')) key = 'file-img';

  const src = `/icons/${key}.svg`;
  return (
    <img src={src} alt={`${maybeExt ? maybeExt.toUpperCase() : 'file'} icon`} width={size} height={size} />
  );
}

export default function Resources({ resources }: ResourcesProps) {
  const [resourcePreview, setResourcePreview] = useState<ResourceItem | null>(null);

  const downloadResource = (resource: ResourceItem) => {
    // In a real app, you would have a secure download endpoint
    window.open(resource.url, '_blank');
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Resources</h2>
      {resources.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <div className="text-slate-500 dark:text-slate-400">No resources available</div>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map((res) => (
            <div
              key={res.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                  <FileIcon name={res.title} type={res.mimeType} size={40} />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setResourcePreview(res)}
                    className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1 truncate text-left w-full"
                    title={res.title}
                  >
                    {res.title}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setResourcePreview(res)}
                    className="text-xs px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => downloadResource(res)}
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {resourcePreview && (
        <ResourcePreviewModal resource={resourcePreview} onClose={() => setResourcePreview(null)} />
      )}
    </div>
  );
}
