import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME } from '@/constants/api.constants';
import { createComponentProps, transformMutationResult } from './useQueryHook';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageData {
  message: string;
  sessionId?: string;
  context?: any;
}

export interface ExtractFileData {
  file: File;
}

// Get chat sessions
export const useChatSessions = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.CHATBOT.SESSIONS,
    queryFn: async () => {
      const response = await requestService.get<ChatSession[]>(
        API_ENDPOINTS.CHATBOT.SESSIONS
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

// Get single chat session
export const useChatSession = (sessionId: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.CHATBOT.SESSION(sessionId),
    queryFn: async () => {
      const response = await requestService.get<ChatSession>(
        API_ENDPOINTS.CHATBOT.SESSION_DETAIL(sessionId)
      );
      return response.data;
    },
    enabled: enabled && !!sessionId,
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

// Send message to chatbot
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: SendMessageData) => {
      const response = await requestService.post<{
        message: string;
        sessionId: string;
      }>(API_ENDPOINTS.CHATBOT.CHAT, data);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.sessionId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.CHATBOT.SESSION(data.sessionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CHATBOT.SESSIONS });
    },
  });

  return transformMutationResult(mutation);
};

// Extract text from file
export const useExtractFile = () => {
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await requestService.upload<{ text: string }>(
        API_ENDPOINTS.CHATBOT.EXTRACT_FILE,
        formData
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// Delete chat session
export const useDeleteChatSession = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await requestService.delete(API_ENDPOINTS.CHATBOT.SESSION_DETAIL(sessionId));
    },
    onSuccess: (_, sessionId) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.CHATBOT.SESSION(sessionId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CHATBOT.SESSIONS });
    },
  });

  return transformMutationResult(mutation);
};

// Check chatbot health
export const useChatbotHealth = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.CHATBOT.HEALTH,
    queryFn: async () => {
      const response = await requestService.get<{ status: string }>(
        API_ENDPOINTS.CHATBOT.HEALTH
      );
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
    retry: false,
  });

  return createComponentProps(result);
};
