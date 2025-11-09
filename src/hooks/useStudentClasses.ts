"use client";
import { useState, useEffect } from 'react';
import { studentApi, ClassListResponse } from '@/services';

export function useStudentClasses(params?: { active?: boolean; limit?: number; page?: number }) {
  const [data, setData] = useState<ClassListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    studentApi.getClasses(params)
      .then(res => {
        if (!mounted) return;
        if (res.success) setData(res.data ?? null);
        else setError(res.error || 'Failed to load classes');
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
  }, [JSON.stringify(params)]);

  return { data, loading, error };
}

export default useStudentClasses;
