"use client";
import api from '@/lib/api';
import { useCallback } from 'react';

export function useAuthRequest() {
  const request = useCallback((path: string, options?: RequestInit) => {
    return api.request(path, options);
  }, []);

  const get = useCallback((path: string, options?: RequestInit) => api.get(path, options), []);
  const post = useCallback((path: string, data?: any, options?: RequestInit) => api.post(path, data, options), []);
  const patch = useCallback((path: string, data?: any, options?: RequestInit) => api.patch(path, data, options), []);
  const del = useCallback((path: string, options?: RequestInit) => api.del(path, options), []);

  return { request, get, post, patch, del };
}

export default useAuthRequest;
