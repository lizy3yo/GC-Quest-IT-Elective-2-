import { useMutation } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS } from '@/constants/api.constants';

export interface UploadFileResponse {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

export interface UploadImageResponse {
  url: string;
  filename: string;
  width?: number;
  height?: number;
}

// Upload file
export const useUploadFile = () => {
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await requestService.upload<UploadFileResponse>(
        API_ENDPOINTS.UPLOAD.FILE,
        formData
      );
      return response.data;
    },
  });

  // avoid importing hook utilities here to keep upload hook minimal; caller can adapt the response as needed
  return mutation;
};

// Upload image
export const useUploadImage = () => {
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      const response = await requestService.upload<UploadImageResponse>(
        API_ENDPOINTS.UPLOAD.IMAGE,
        formData
      );
      return response.data;
    },
  });

  return mutation;
};

// Upload with progress tracking
export const useUploadWithProgress = () => {
  const mutation = useMutation({
    mutationFn: async ({
      file,
      endpoint,
      onProgress,
    }: {
      file: File;
      endpoint: string;
      onProgress?: (progress: number) => void;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await requestService.upload(
        endpoint,
        formData,
        (progressEvent: any) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        }
      );
      return response.data;
    },
  });

  return mutation;
};
