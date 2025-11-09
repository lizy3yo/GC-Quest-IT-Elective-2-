"use client";
import { useState, useEffect } from 'react';
import { studentApi, ClassDetailResponse } from '@/services';

export function useClassDetails(classId?: string, includeDetails = true) {
  const [data, setData] = useState<ClassDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!classId) return;
    let mounted = true;
    setLoading(true);

    studentApi.getClassDetails(classId, includeDetails)
      .then(res => {
        if (!mounted) return;
        if (res.success) setData(res.data ?? null);
        else setError(res.error || 'Failed to load class');
      })
      .catch(err => {
        if (!mounted) return;
        setError(err?.message || 'Network error');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => { mounted = false };
  }, [classId, includeDetails]);

  return { data, loading, error };
}

export default useClassDetails;
