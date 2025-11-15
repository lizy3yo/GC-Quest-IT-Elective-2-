import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/services';
import { StudentClassDetails } from '@/interfaces';

const fetchClassDetails = async (classId: string): Promise<StudentClassDetails> => {
  const response = await studentApi.getClassDetails(classId, true);
  if (response.success && response.data?.class) {
    return response.data.class;
  }
  throw new Error(response.error || 'Failed to fetch class details');
};

export const useClassDetails = (classId: string) => {
  return useQuery<StudentClassDetails, Error>({
    queryKey: ['classDetails', classId],
    queryFn: () => fetchClassDetails(classId),
    enabled: !!classId,
  });
};