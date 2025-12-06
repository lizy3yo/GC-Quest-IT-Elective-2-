import { useQuery } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME } from '@/constants/api.constants';
import type { OverviewData } from '@/interfaces/analytics.interface';
import { createComponentProps } from './useQueryHook';

// Get parent overview
export const useParentOverview = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.PARENT.OVERVIEW,
    queryFn: async () => {
      const response = await requestService.get<OverviewData>(
        API_ENDPOINTS.PARENT.OVERVIEW
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};
