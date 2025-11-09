"use client";
import { useState, useEffect } from 'react';
import { assessmentApi } from '@/services';

export function useAssessments(params?: { classId?: string; category?: string; published?: boolean; limit?: number; page?: number }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    assessmentApi.getAssessments(params as any)
      .then(res => {
        if (!mounted) return;
        if (res.success) setData(res.data ?? null);
        else setError(res.error || 'Failed to load assessments');
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

export default useAssessments;
