import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

class RequestService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '/api';
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('auth_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - clear token and redirect
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError<ApiError>): ApiError {
    if (error.response) {
      return {
        message: error.response.data?.message || 'An error occurred',
        statusCode: error.response.status,
        errors: error.response.data?.errors,
      };
    } else if (error.request) {
      return {
        message: 'No response from server. Please check your connection.',
        statusCode: 0,
      };
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
      };
    }
  }

  async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api.get(url, config);
    return response.data;
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api.post(url, data, config);
    return response.data;
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api.put(url, data, config);
    return response.data;
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api.patch(url, data, config);
    return response.data;
  }

  async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api.delete(url, config);
    return response.data;
  }

  // Upload file with progress tracking
  async upload<T = any>(
    url: string,
    formData: FormData,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse<ApiResponse<T>> = await this.api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  }
}

export const requestService = new RequestService();
