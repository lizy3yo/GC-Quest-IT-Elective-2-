import { StudentClassDetails } from "@/interfaces";

interface ClassHeaderProps {
  classDetails: StudentClassDetails;
}

export default function ClassHeader({ classDetails }: ClassHeaderProps) {
  return (
    <header className="mb-6 rounded-lg bg-[#1C2B1C] text-white shadow-sm">
      <div className="flex items-center justify-between gap-4 p-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-normal text-white truncate" title={classDetails.name}>{classDetails.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-white/90">
            <span className="truncate" title={classDetails.classCode ?? ''}>{classDetails.classCode ?? '—'}</span>
            <span>•</span>
            <span className="truncate" title={classDetails.schedule ?? ''}>{classDetails.schedule ?? '—'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
