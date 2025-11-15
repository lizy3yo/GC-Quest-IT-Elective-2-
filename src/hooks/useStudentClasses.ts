import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/services';
import { IClassInfo, StudentClassDetails } from '@/interfaces';

const fetchStudentClasses = async (): Promise<IClassInfo[]> => {
  const response = await studentApi.getClasses({ active: true, limit: 50 });
  if (response.success && response.data?.classes) {
    const classes = response.data.classes as StudentClassDetails[];
    return classes.map((c) => ({
      _id: c._id,
      name: c.name,
      teacher: c.instructor?.name || '',
      subject: c.subject,
      studentCount: c.studentCount,
      classCode: c.classCode,
      description: c.description,
      createdAt: c.createdAt,
      courseYear: c.courseYear,
      // leave day/time/room undefined for now; source has `schedule: string` if needed later
    }));
  }
  throw new Error(response.error || 'Failed to fetch classes');
};

export const useStudentClasses = () => {
  return useQuery<IClassInfo[], Error>({
    queryKey: ['studentClasses'],
    queryFn: fetchStudentClasses,
  });
};