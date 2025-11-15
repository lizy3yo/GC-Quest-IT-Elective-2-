import { StudentInfo, TeacherInfo } from "@/interfaces";

interface StudentListProps {
  students: StudentInfo[];
  instructor?: TeacherInfo;
}

export default function StudentList({ students, instructor }: StudentListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Class List ({students.length} students)
        </h2>
        {instructor && (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Instructor: <span className="font-medium">{instructor.name}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {students.map((student) => (
          <div key={student.id} className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <div className="w-12 h-12 flex-shrink-0">
              <img
                src={student.avatar || "/gc-logo.png"}
                alt={student.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
              />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {student.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                {student.email}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
