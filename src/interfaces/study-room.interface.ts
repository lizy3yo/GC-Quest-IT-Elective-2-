export interface StudyRoom {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: string[];
  isPublic: boolean;
  maxMembers?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudyRoomData {
  name: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

export interface UpdateStudyRoomData extends Partial<CreateStudyRoomData> {}

export interface StudyRoomFilters {
  isPublic?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StudyRoomListResponse {
  rooms: StudyRoom[];
  total: number;
  page: number;
  totalPages: number;
}

export interface StudyRoomInvite {
  id: string;
  roomId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface SendInviteData {
  roomId: string;
  inviteeId: string;
}

export interface RespondToInviteData {
  inviteId: string;
  accept: boolean;
}
