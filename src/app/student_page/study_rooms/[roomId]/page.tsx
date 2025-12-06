"use client";

import "../../dashboard/styles.css";
import { useState, useEffect, useRef } from "react";
import Image from 'next/image';
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { 
  MessageSquare, FileText, Award, Send, Users, ArrowLeft, Trash2, Edit2, 
  MoreVertical, X, Check, Video, VideoOff, Mic, MicOff, Monitor, MonitorOff, PhoneOff,
  Maximize, Minimize, Phone, PhoneIncoming, Plus, Save, UserPlus, Mail
} from "lucide-react";
import { Paperclip } from "lucide-react";
import { WebRTCService } from "@/lib/services/webrtc";
import RichTextEditor from "@/components/molecules/RichTextEditor";
import ConfirmModal from "@/components/molecules/ConfirmModal";
import { useToast } from "@/contexts/ToastContext";
import Pusher from 'pusher-js';

interface Message {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  message: string;
  editHistory?: { message: string; editedAt: string }[];
  isEdited?: boolean;
  timestamp: string;
  type?: 'message' | 'system';
  attachments?: {
    url: string;
    filename?: string;
    resource_type?: string;
    public_id?: string;
  }[];
  deletedForEveryone?: boolean;
  deletedFor?: string[];
}

interface Note {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  title: string;
  content: string;
  createdAt: string;
}

interface Challenge {
  _id: string;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  responses: {
    userId: string;
    selectedOption: number;
    isCorrect: boolean;
  }[];
  createdAt: string;
}

interface StudyRoomDetails {
  _id: string;
  name: string;
  description: string;
  subject: string;
  isPrivate: boolean;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  members: {
    _id: string;
    firstName: string;
    lastName: string;
  }[];
  pendingInvites: {
    userId: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    invitedBy: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    invitedAt: string;
  }[];
  messages: Message[];
  notes: Note[];
  challenges: Challenge[];
}

interface RemotePeer {
  userId: string;
  userName: string;
  stream: MediaStream;
}

type CallViewMode = "hidden" | "modal" | "minimized" | "fullscreen";

export default function StudyRoomDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const { showSuccess, showError } = useToast();
  
  // Track current user ID for call filtering
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [room, setRoom] = useState<StudyRoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "notes" | "challenges">("chat");
  const [messageInput, setMessageInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState("");
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showNoteMenu, setShowNoteMenu] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showChallengeMenu, setShowChallengeMenu] = useState<string | null>(null);
  const [newChallenge, setNewChallenge] = useState({
    question: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    explanation: "",
  });
  
  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [modalView, setModalView] = useState<'invite' | 'members'>('invite');
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageFormRef = useRef<HTMLFormElement>(null);
  const hasAutoScrolledRef = useRef(false);
  const chatScrollPositionRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Video call states
  const [callViewMode, setCallViewMode] = useState<CallViewMode>("hidden");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [incomingCall, setIncomingCall] = useState<{from: string, fromName: string} | null>(null);
  
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    isDangerous: false,
    confirmText: "OK",
  });

  // Unsend modal state
  const [unsendModal, setUnsendModal] = useState<{
    isOpen: boolean;
    messageId: string | null;
  }>({
    isOpen: false,
    messageId: null,
  });

  // Track which messages have edit history visible
  const [showEditHistory, setShowEditHistory] = useState<Set<string>>(new Set());
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcServiceRef = useRef<WebRTCService | null>(null);
  const signalingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    // Check both NextAuth session and manual auth tokens
    const hasManualAuth = () => {
      if (typeof window === "undefined") return false;
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      return !!(accessToken || refreshToken);
    };

    // Only redirect if BOTH session is unauthenticated AND no manual auth tokens
    if (status === "unauthenticated" && !hasManualAuth()) {
      router.push("/auth/login");
    }
  }, [status, router]);

  // Extract current user ID from token on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token && !currentUserId) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.userId || payload.sub || payload.id;
        if (userId) {
          setCurrentUserId(userId);
          console.log('Set currentUserId from token:', userId);
        }
      } catch (e) {
        console.error("Error parsing token for user ID:", e);
      }
    }
  }, [currentUserId]);

  useEffect(() => {
    // Check both NextAuth session and manual auth tokens
    const hasManualAuth = () => {
      if (typeof window === "undefined") return false;
      const accessToken = localStorage.getItem("accessToken");
      return !!accessToken;
    };

    if ((status === "authenticated" || hasManualAuth()) && roomId) {
      fetchRoomDetails();
      connectWebSocket();
      startSignalingPoll();
      
      pollingIntervalRef.current = setInterval(() => {
        fetchRoomDetails();
      }, 3000);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (signalingIntervalRef.current) {
        clearInterval(signalingIntervalRef.current);
      }
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.closeAllConnections();
      }
      // Disconnect Pusher
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`study-room-${roomId}`);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, roomId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const msgs = room?.messages || [];

    // On initial load of messages, always scroll to bottom so the latest conversations are visible
    if (!hasAutoScrolledRef.current && msgs.length > 0) {
      scrollToBottom();
      hasAutoScrolledRef.current = true;
      return;
    }

    // Otherwise only auto-scroll if user is already near the bottom (within 100px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [room?.messages]);

  // Adjust messages container max-height so the input stays visible on initial load
  useEffect(() => {
    const adjustHeights = () => {
      const container = messagesContainerRef.current;
      const form = messageFormRef.current;
      if (!container) return;

      const containerTop = container.getBoundingClientRect().top;
      const formHeight = form ? form.getBoundingClientRect().height : 100; // fallback

      // Try to account for the parent's bottom padding so we fill the area tightly
      const parent = container.parentElement;
      const parentStyle = parent ? getComputedStyle(parent) : null;
      const parentPaddingBottom = parentStyle ? parseFloat(parentStyle.paddingBottom || "0") : 0;

      // Compute maxHeight so the messages area reaches just above the input/form + parent's padding
      const computed = window.innerHeight - containerTop - formHeight - parentPaddingBottom - 8; // small offset
      const minHeight = 180;
      const maxHeight = Math.max(minHeight, computed);
      container.style.maxHeight = `${maxHeight}px`;
    };

    // Run on mount and on resize
    adjustHeights();
    window.addEventListener("resize", adjustHeights);
    return () => window.removeEventListener("resize", adjustHeights);
  }, [activeTab, loading]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.message-menu')) {
        setShowMessageMenu(null);
        setShowNoteMenu(null);
        setShowChallengeMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/websocket?roomId=${roomId}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "message") {
          setRoom((prevRoom) => {
            if (!prevRoom) return prevRoom;
            return {
              ...prevRoom,
              messages: [...prevRoom.messages, data.message],
            };
          });
        }
      };

      wsRef.current.onerror = () => {
        console.log("WebSocket connection failed, using polling");
      };
    } catch (error) {
      console.log("WebSocket not available, using polling");
    }
  };

  const startSignalingPoll = () => {
    // Use Pusher for real-time signaling instead of polling
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    
    if (!pusherKey || !pusherCluster) {
      console.error("Pusher credentials not found");
      return;
    }
    
    // Initialize Pusher client
    pusherRef.current = new Pusher(pusherKey, {
      cluster: pusherCluster,
      forceTLS: true,
    });
    
    // Subscribe to the study room channel
    const channel = pusherRef.current.subscribe(`study-room-${roomId}`);
    
    // Listen for call signals
    channel.bind('call-signal', (data: any) => {
      console.log('Received call signal via Pusher:', data);
      // Filter out signals from current user
      const myUserId = currentUserId || session?.user?.id;
      if (data.from !== myUserId) {
        handleSignal(data);
      }
    });
    
    console.log(`Subscribed to Pusher channel: study-room-${roomId}`);
  };

  const handleSignal = async (signal: unknown) => {
    if (!webrtcServiceRef.current) return;
    
    const { type, from, fromName } = signal as any;
    
    // Get current user ID from state, session, or token
    const myUserId = currentUserId || session?.user?.id;

    switch (type) {
      case "call-initiated":
        // Don't show incoming call notification to the caller themselves
        if (from !== myUserId && callViewMode === "hidden") {
          setIncomingCall({ from, fromName });
        }
        break;
        
      case "offer":
        if (callViewMode !== "hidden") {
          await webrtcServiceRef.current.createPeerConnection(
            from,
            fromName,
            false,
            (candidate) => sendSignal("ice-candidate", from, candidate),
            undefined,
            (answer) => sendSignal("answer", from, answer)
          );
          await webrtcServiceRef.current.handleOffer(from, (signal as any).signal, (answer) => {
            sendSignal("answer", from, answer);
          });
        }
        break;
        
      case "answer":
        await webrtcServiceRef.current.handleAnswer(from, (signal as any).signal);
        break;
        
      case "ice-candidate":
        await webrtcServiceRef.current.handleIceCandidate(from, (signal as any).signal);
        break;
        
      case "call-ended":
        webrtcServiceRef.current.removePeerConnection(from);
        setRemotePeers(prev => prev.filter(p => p.userId !== from));
        break;
    }
  };

  const sendSignal = async (type: string, targetUserId?: string, signal?: unknown) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`/api/student_page/study-rooms/${roomId}/call-signal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          type,
          targetUserId,
          signal,
        }),
      });
    } catch (error) {
      console.error("Error sending signal:", error);
    }
  };

  const fetchRoomDetails = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        // Ensure messages are sorted oldest -> newest so latest conversations are at the bottom
        if (data.room?.messages && Array.isArray(data.room.messages)) {
          data.room.messages.sort((a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
        setRoom(data.room);
        
        // Extract current user ID from token payload
        if (token && !currentUserId) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.userId || payload.sub || payload.id) {
              setCurrentUserId(payload.userId || payload.sub || payload.id);
            }
          } catch (e) {
            console.error("Error parsing token:", e);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching room details:", error);
    } finally {
      setLoading(false);
    }
  };

  const startVideoCall = async () => {
    try {
      // Initialize WebRTC service
      webrtcServiceRef.current = new WebRTCService(
        (userId, userName, stream) => {
          setRemotePeers(prev => {
            const existing = prev.find(p => p.userId === userId);
            if (existing) {
              return prev.map(p => p.userId === userId ? { userId, userName, stream } : p);
            }
            return [...prev, { userId, userName, stream }];
          });
        },
        (userId) => {
          setRemotePeers(prev => prev.filter(p => p.userId !== userId));
        }
      );

      // Get local stream
      const stream = await webrtcServiceRef.current.getLocalStream(true, true);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setCallViewMode("modal");
      setIsCameraOn(true);
      setIsMicOn(true);
      
      // Notify other members
      await sendSignal("call-initiated");
      
      // Create offers for all room members
      if (room) {
        for (const member of room.members) {
          if (member._id !== session?.user?.id) {
            const peerConnection = await webrtcServiceRef.current.createPeerConnection(
              member._id,
              `${member.firstName} ${member.lastName}`,
              true,
              (candidate) => sendSignal("ice-candidate", member._id, candidate),
              (offer) => sendSignal("offer", member._id, offer)
            );
          }
        }
      }
    } catch (error) {
      console.error("Error starting video call:", error);
      showError("Could not access camera/microphone. Please check permissions.");
    }
  };

  const acceptCall = async () => {
    setIncomingCall(null);
    await startVideoCall();
  };

  const declineCall = () => {
    setIncomingCall(null);
  };

  const endVideoCall = async () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.closeAllConnections();
      webrtcServiceRef.current = null;
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    setCallViewMode("hidden");
    setIsCameraOn(false);
    setIsMicOn(false);
    setIsScreenSharing(false);
    setRemotePeers([]);
    
    await sendSignal("call-ended");
  };

  const toggleCamera = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleVideo(!isCameraOn);
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleMicrophone = () => {
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.toggleAudio(!isMicOn);
      setIsMicOn(!isMicOn);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        // Restore camera
        if (webrtcServiceRef.current) {
          const stream = await webrtcServiceRef.current.getLocalStream(true, true);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
        setIsScreenSharing(false);
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        screenStreamRef.current = screenStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        if (webrtcServiceRef.current) {
          await webrtcServiceRef.current.replaceVideoTrack(screenStream);
        }
        
        setIsScreenSharing(true);
        
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
      }
    } catch (error) {
      console.error("Error with screen sharing:", error);
      showError("Could not start screen sharing.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() && !selectedFile) return;

    try {
      let res: Response;
      const token = localStorage.getItem('accessToken');
      // If there's a selected file, send multipart/form-data
      if (selectedFile) {
        const MAX_BYTES = 10 * 1024 * 1024;
        if (selectedFile.size > MAX_BYTES) {
          showError("File too large (max 10 MB)");
          return;
        }

        const fd = new FormData();
        fd.append("message", messageInput);
        fd.append("file", selectedFile, selectedFile.name);

        res = await fetch(`/api/student_page/study-rooms/${roomId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: fd,
        });
      } else {
        res = await fetch(`/api/student_page/study-rooms/${roomId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: messageInput }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (room) {
          setRoom({
            ...room,
            messages: [...room.messages, data.message],
          });
        }
        setMessageInput("");
        setSelectedFile(null);
      } else {
        // Attempt to parse error details from server
        let errText = "Failed to send message. Please try again.";
        try {
          const body = await res.json();
          if (body?.error) errText = body.error + (body.details ? `: ${String(body.details).slice(0, 500)}` : "");
        } catch {
          try {
            const t = await res.text();
            if (t) errText = t.slice(0, 500);
          } catch {
            /* ignore */
          }
        }
        showError(errText);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      showError("Failed to send message. Please try again.");
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('accessToken');
      if (editingNoteId) {
        const res = await fetch(`/api/student_page/study-rooms/${roomId}/notes/${editingNoteId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ title: noteTitle, content: noteContent }),
        });

        if (res.ok) {
          setShowNoteModal(false);
          setNoteTitle("");
          setNoteContent("");
          setEditingNoteId(null);
          showSuccess("Note updated successfully!");
          // Fetch updated room data immediately
          await fetchRoomDetails();
        } else {
          showError("Failed to update note. Please try again.");
        }
      } else {
        const res = await fetch(`/api/student_page/study-rooms/${roomId}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ title: noteTitle, content: noteContent }),
        });

        if (res.ok) {
          setShowNoteModal(false);
          setNoteTitle("");
          setNoteContent("");
          showSuccess("Note created successfully!");
          // Fetch updated room data immediately
          await fetchRoomDetails();
        } else {
          showError("Failed to create note. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error creating/updating note:", error);
      showError("An error occurred. Please try again.");
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note._id);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setShowNoteModal(true);
    setShowNoteMenu(null);
  };

  const handleDeleteNote = (noteId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Note",
      message: "Are you sure you want to delete this note?",
      isDangerous: true,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/student_page/study-rooms/${roomId}/notes/${noteId}`, {
            method: "DELETE",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
          });

          if (res.ok) {
            setShowNoteMenu(null);
            showSuccess("Note deleted successfully!");
            await fetchRoomDetails();
          } else {
            showError("Failed to delete note. Please try again.");
          }
        } catch (error) {
          console.error("Error deleting note:", error);
          showError("An error occurred. Please try again.");
        }
      },
    });
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(newChallenge),
      });

      if (res.ok) {
        setShowChallengeModal(false);
        setNewChallenge({
          question: "",
          options: ["", "", "", ""],
          correctAnswer: 0,
          explanation: "",
        });
        showSuccess("Challenge created successfully!");
        // Fetch updated room data immediately
        await fetchRoomDetails();
      } else {
        showError("Failed to create challenge. Please try again.");
      }
    } catch (error) {
      console.error("Error creating challenge:", error);
      showError("An error occurred. Please try again.");
    }
  };

  const handleAnswerChallenge = async (challengeId: string, selectedOption: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/challenges/${challengeId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ selectedOption }),
      });

      if (res.ok) {
        fetchRoomDetails();
      }
    } catch (error) {
      console.error("Error answering challenge:", error);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editingMessageText.trim()) return;

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/messages/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ message: editingMessageText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (room) {
          setRoom({
            ...room,
            messages: room.messages.map((msg) => {
              if (msg._id === messageId) {
                // Merge the response with updated editHistory
                const updatedEditHistory = [
                  ...(msg.editHistory || []),
                  { message: msg.message, editedAt: new Date().toISOString() }
                ];
                return {
                  ...data.message,
                  editHistory: updatedEditHistory,
                  isEdited: true,
                };
              }
              return msg;
            }),
          });
        }
        setEditingMessageId(null);
        setEditingMessageText("");
        setShowMessageMenu(null);
      }
    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setUnsendModal({ isOpen: true, messageId });
    setShowMessageMenu(null);
  };

  const handleUnsendMessage = async (mode: "everyone" | "me") => {
    if (!unsendModal.messageId) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        `/api/student_page/study-rooms/${roomId}/messages/${unsendModal.messageId}?mode=${mode}`,
        {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
        }
      );

      if (res.ok) {
        if (room) {
          setRoom({
            ...room,
            messages: room.messages.map((msg) =>
              msg._id === unsendModal.messageId
                ? mode === "everyone"
                  ? { ...msg, deletedForEveryone: true }
                  : { ...msg, deletedFor: [...(msg.deletedFor || []), currentUserId!] }
                : msg
            ),
          });
        }
      }
    } catch (error) {
      console.error("Error unsending message:", error);
    } finally {
      setUnsendModal({ isOpen: false, messageId: null });
    }
  };

  const startEditingMessage = (msg: Message) => {
    setEditingMessageId(msg._id);
    setEditingMessageText(msg.message);
    setShowMessageMenu(null);
    // Auto-show edit history when editing a message that has been edited before
    if (msg.isEdited && msg.editHistory && msg.editHistory.length > 0) {
      setShowEditHistory(prev => new Set(prev).add(msg._id));
    }
  };

  const handleDeleteChallenge = (challengeId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Challenge",
      message: "Are you sure you want to delete this challenge?",
      isDangerous: true,
      confirmText: "Delete",
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/student_page/study-rooms/${roomId}/challenges/${challengeId}`, {
            method: "DELETE",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
          });

          if (res.ok) {
            setShowChallengeMenu(null);
            showSuccess("Challenge deleted successfully!");
            await fetchRoomDetails();
          } else {
            showError("Failed to delete challenge. Please try again.");
          }
        } catch (error) {
          console.error("Error deleting challenge:", error);
          showError("An error occurred. Please try again.");
        }
      },
    });
  };

  const handleTabChange = (tab: "chat" | "notes" | "challenges") => {
    // Save current scroll position if leaving chat tab
    if (activeTab === "chat" && messagesContainerRef.current) {
      chatScrollPositionRef.current = messagesContainerRef.current.scrollTop;
    }
    
    setActiveTab(tab);
    
    // Restore scroll position if returning to chat tab
    if (tab === "chat") {
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = chatScrollPositionRef.current;
        }
      }, 0);
    }
  };

  // Fetch suggested users when modal opens
  const fetchSuggestedUsers = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/search-students?q=`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedUsers(data.students || []);
      }
    } catch (error) {
      console.error("Error fetching suggested users:", error);
    }
  };

  // Search for students to invite
  const handleSearchStudents = async (query: string) => {
    setStudentSearch(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/search-students?q=${encodeURIComponent(query)}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.students || []);
      }
    } catch (error) {
      console.error("Error searching students:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Send invite to a student
  const handleSendInvite = async (studentEmail: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ inviteeEmail: studentEmail }),
      });

      if (res.ok) {
        const data = await res.json();
        showSuccess(`Invite sent to ${data.invitee.firstName} ${data.invitee.lastName}!`);
        setStudentSearch("");
        setSearchResults([]);
        await fetchRoomDetails(); // Refresh to show pending invites
        await fetchSuggestedUsers(); // Refresh suggested users to update their status
      } else {
        const errorData = await res.json();
        showError(errorData.error || "Failed to send invite");
      }
    } catch (error) {
      console.error("Error sending invite:", error);
      showError("Failed to send invite. Please try again.");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1C2B1C]"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Room not found</h3>
      </div>
    );
  }

  const renderVideoCallInterface = () => {
    if (callViewMode === "hidden") return null;

    const isMinimized = callViewMode === "minimized";
    const isFullscreen = callViewMode === "fullscreen";

    return (
      <div
        className={`
          ${isMinimized 
            ? "fixed bottom-4 right-4 w-80 h-60 z-50" 
            : isFullscreen
            ? "fixed inset-0 z-50 bg-black"
            : "fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          }
        `}
      >
        <div
          className={`
            ${isMinimized 
              ? "w-full h-full" 
              : isFullscreen
              ? "w-full h-full"
              : "w-[90vw] h-[85vh] max-w-7xl"
            }
            bg-slate-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col
          `}
        >
          {/* Header */}
          <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white font-medium">
                {isMinimized ? "Call Active" : `${room.name} - Video Call`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isFullscreen && (
                <button
                  onClick={() => setCallViewMode("fullscreen")}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
                  title="Fullscreen"
                >
                  <Maximize size={18} />
                </button>
              )}
              {(isFullscreen || !isMinimized) && (
                <button
                  onClick={() => setCallViewMode("minimized")}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
                  title="Minimize"
                >
                  <Minimize size={18} />
                </button>
              )}
              {isMinimized && (
                <button
                  onClick={() => setCallViewMode("modal")}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-white"
                  title="Expand"
                >
                  <Maximize size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 bg-slate-800 p-4 overflow-auto">
            <div className={`
              grid gap-4 h-full
              ${remotePeers.length === 0 ? "grid-cols-1" : 
                remotePeers.length === 1 ? "grid-cols-2" :
                remotePeers.length <= 4 ? "grid-cols-2 grid-rows-2" :
                "grid-cols-3 auto-rows-fr"}
            `}>
              {/* Local Video */}
              <div className="relative bg-slate-900 rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isCameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-3 bg-slate-700 rounded-full flex items-center justify-center">
                        <Users size={32} className="text-slate-400" />
                      </div>
                      <p className="text-slate-300 text-sm">Camera is off</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg">
                  <p className="text-white text-sm font-medium">
                    You {isScreenSharing && "(Sharing Screen)"}
                  </p>
                </div>
              </div>

              {/* Remote Videos */}
              {remotePeers.map((peer) => (
                <div key={peer.userId} className="relative bg-slate-900 rounded-lg overflow-hidden">
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (el && peer.stream) {
                        el.srcObject = peer.stream;
                      }
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg">
                    <p className="text-white text-sm font-medium">{peer.userName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-center gap-3">
            <button
              onClick={toggleCamera}
              className={`p-4 rounded-full transition-all ${
                isCameraOn
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              title={isCameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {isCameraOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
            
            <button
              onClick={toggleMicrophone}
              className={`p-4 rounded-full transition-all ${
                isMicOn
                  ? "bg-slate-700 hover:bg-slate-600 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
              title={isMicOn ? "Mute microphone" : "Unmute microphone"}
            >
              {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            
            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full transition-all ${
                isScreenSharing
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
              title={isScreenSharing ? "Stop sharing" : "Share screen"}
            >
              {isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
            </button>

            <button
              onClick={endVideoCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all ml-4"
              title="End call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-container flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>
        {/* Incoming Call Notification */}
        {incomingCall && (
          <div className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 border-2 border-blue-500 animate-bounce">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <PhoneIncoming size={28} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  Incoming Call
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  {incomingCall.fromName} is calling...
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={acceptCall}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <Phone size={18} /> Accept
                  </button>
                  <button
                    onClick={declineCall}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <PhoneOff size={18} /> Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Video Call Interface */}
        {renderVideoCallInterface()}

        {/* Header (stacked: back arrow above title) */}
        <div className="mb-6 flex flex-col items-start gap-2 flex-shrink-0">
          <div>
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
          <header className="greet-block" aria-label={room.name}>
            <h1 className="greet-title">
              {room.name}
            </h1>
            <p className="greet-sub">{room.description}</p>
          </header>
        </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl border-x border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between px-4">
          <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => handleTabChange("chat")}
            className={`flex items-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "chat"
                ? "text-[#2E7D32] dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-[#2E7D32] dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]"
                : "text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] dark:hover:text-white"
            }`}
          >
            <MessageSquare size={18} /> Chat
          </button>
          <button
            onClick={() => handleTabChange("notes")}
            className={`flex items-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "notes"
                ? "text-[#2E7D32] dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-[#2E7D32] dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]"
                : "text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] dark:hover:text-white"
            }`}
          >
            <FileText size={18} /> Shared Notes
          </button>
          <button
            onClick={() => handleTabChange("challenges")}
            className={`flex items-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "challenges"
                ? "text-[#2E7D32] dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-[#2E7D32] dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]"
                : "text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] dark:hover:text-white"
            }`}
          >
            <Award size={18} /> Peer Challenges
          </button>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Members Count (clickable to view members) */}
            <button
              onClick={() => { setModalView('members'); setShowInviteModal(true); }}
              title="View members"
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Users size={18} />
              <span>{room.members.length}</span>
            </button>
            
            {/* Invite Button (only for private rooms and members) */}
            {room.isPrivate && (
              <button
                onClick={() => {
                  setModalView('invite');
                  setShowInviteModal(true);
                  fetchSuggestedUsers();
                }}
                title="Invite Students"
                className="p-2 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <UserPlus size={20} />
              </button>
            )}
            
            {/* Video Call Button */}
            {callViewMode === "hidden" ? (
              <button
                onClick={startVideoCall}
                title="Start Video Call"
                className="p-2 rounded-lg transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Video size={20} />
              </button>
            ) : callViewMode === "minimized" ? (
              <button
                onClick={() => setCallViewMode("modal")}
                title="Call Active - Click to Expand"
                className="p-2 rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 animate-pulse"
              >
                <Video size={20} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-800 rounded-b-2xl border border-slate-200 dark:border-slate-700 p-4 flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-full min-h-0">
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto mb-3 space-y-4 min-h-0"
            >
              {room.messages.length === 0 ? (
                <div className="flex flex-col items-center text-center pt-8">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-full flex items-center justify-center shadow-lg">
                      <MessageSquare className="text-white" size={48} />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-[#E8F5E9] dark:bg-[#1C2B1C] rounded-full flex items-center justify-center border-4 border-white dark:border-slate-800">
                      <Users className="text-[#2E7D32] dark:text-[#04C40A]" size={20} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Welcome to {room.name}!
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md">
                    This is the beginning of your study session. Start the conversation and collaborate with your peers.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500">
                    <Users size={16} />
                    <span>{room.members.length} {room.members.length === 1 ? 'member' : 'members'} in this room</span>
                  </div>
                </div>
              ) : (
                <>
                  {room.messages.map((msg, i) => {
                    const isOwnMessage = msg.userId._id === (currentUserId || session?.user?.id);
                    const isDeletedForMe = msg.deletedFor?.includes(currentUserId || session?.user?.id || '');
                    const isDeletedForEveryone = msg.deletedForEveryone;
                    
                    // Skip messages deleted only for current user
                    if (isDeletedForMe && !isDeletedForEveryone) return null;
                    
                    return msg.type === "system" ? (
                      <div key={msg._id ?? `system-${i}-${msg.timestamp}`} className="w-full flex justify-center">
                        <div className="inline-block px-3 py-1 rounded-full text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 italic">
                          {msg.message}
                        </div>
                      </div>
                    ) : isDeletedForEveryone ? (
                      // Show deleted message placeholder
                      <div
                        key={msg._id ?? `msg-${i}-${msg.timestamp}`}
                        className={`flex items-center gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 border border-dashed ${
                            isOwnMessage
                              ? "border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800"
                              : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                          }`}
                        >
                          <p className="text-sm italic text-slate-500 dark:text-slate-400">
                            {isOwnMessage ? "You deleted this message" : "This message was deleted"}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={msg._id ?? `msg-${i}-${msg.timestamp}`}
                        className={`flex items-center gap-2 group ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                  {isOwnMessage && editingMessageId !== msg._id && (
                    <div className="message-menu relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMessageMenu(showMessageMenu === msg._id ? null : msg._id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-all text-slate-600 dark:text-slate-300"
                      >
                        <MoreVertical size={18} />
                      </button>
                      {showMessageMenu === msg._id && (
                        <div className="absolute right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 z-10">
                          <button
                            onClick={() => startEditingMessage(msg)}
                            className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2 text-slate-800 dark:text-white"
                          >
                            <Edit2 size={16} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg._id)}
                            className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2 text-red-600 dark:text-red-400"
                          >
                            <Trash2 size={16} /> Unsend
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                        <div
                          className={`max-w-[70%] rounded-lg p-3 relative ${
                            isOwnMessage
                              ? "bg-[#2E7D32] text-white"
                              : "bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100 border border-transparent dark:border-slate-500"
                          }`}
                        >
                    {!isOwnMessage && (
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {msg.userId.firstName} {msg.userId.lastName}
                      </p>
                    )}
                    <div>
                        {/* Edit history toggle */}
                        {msg.isEdited && msg.editHistory && msg.editHistory.length > 0 && (
                          <button
                            onClick={() => {
                              setShowEditHistory(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(msg._id)) {
                                  newSet.delete(msg._id);
                                } else {
                                  newSet.add(msg._id);
                                }
                                return newSet;
                              });
                            }}
                            className={`text-xs mb-1 ${
                              isOwnMessage 
                                ? "text-green-200 hover:text-white" 
                                : "text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                            }`}
                          >
                            {showEditHistory.has(msg._id) ? "Hide edits" : "Show edits"}
                          </button>
                        )}
                        {/* Edit history (shown when toggle is active) */}
                        {msg.isEdited && msg.editHistory && msg.editHistory.length > 0 && showEditHistory.has(msg._id) && (
                          <div className="mb-2 space-y-1">
                            {msg.editHistory.map((edit, idx) => (
                              <div
                                key={idx}
                                className={`p-2 rounded border ${
                                  isOwnMessage
                                    ? "border-green-400/50 bg-green-800/30"
                                    : "border-slate-400/50 dark:border-slate-500/50 bg-slate-200/50 dark:bg-slate-700/50"
                                }`}
                              >
                                <p className="text-xs opacity-70">{edit.message}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.message && <p className="text-sm">{msg.message}</p>}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((att, idx) => (
                              <div key={att.public_id ?? `${idx}-${att.url}`}>
                                {att.resource_type && att.resource_type.startsWith('image') ? (
                                  <Image src={att.url} alt={att.filename || 'attachment'} width={300} height={200} className="rounded-md object-cover" />
                                ) : (
                                  <a href={att.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
                                    {att.filename || att.url}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                          <p className="text-xs opacity-60 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {msg.isEdited && <span className="ml-1">(edited)</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            {/* Edit mode header */}
            {editingMessageId && (
              <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 rounded-t-lg">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Edit message</span>
                <button
                  onClick={() => {
                    setEditingMessageId(null);
                    setEditingMessageText("");
                  }}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X size={16} className="text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            )}
            <form
              ref={messageFormRef}
              onSubmit={editingMessageId ? (e) => { e.preventDefault(); if (editingMessageText.trim()) handleEditMessage(editingMessageId); } : handleSendMessage}
              className="flex gap-2 flex-shrink-0 w-full items-center"
            >
              {!editingMessageId && (
                <label className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (f) {
                        const MAX_BYTES = 10 * 1024 * 1024;
                        if (f.size > MAX_BYTES) {
                          showError('File too large (max 10 MB)');
                          e.currentTarget.value = '';
                          return;
                        }
                        setSelectedFile(f);
                      } else {
                        setSelectedFile(null);
                      }
                    }}
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    id="file-upload"
                  />
                  <button type="button" onClick={() => document.getElementById('file-upload')?.click()} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                    <Paperclip size={18} />
                  </button>
                </label>
              )}
              <div className="relative flex-1">
                <input
                  type="text"
                  value={editingMessageId ? editingMessageText : messageInput}
                  onChange={(e) => editingMessageId ? setEditingMessageText(e.target.value) : setMessageInput(e.target.value)}
                  placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
                  className="w-full pl-4 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                  autoFocus={!!editingMessageId}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && editingMessageId) {
                      setEditingMessageId(null);
                      setEditingMessageText("");
                    }
                  }}
                />
                {!editingMessageId && selectedFile && (
                  <div className="absolute -top-9 left-0 flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1 max-w-full">
                    <FileText size={16} className="text-slate-700 dark:text-slate-300" />
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[260px]">
                      {selectedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        const el = document.getElementById('file-upload') as HTMLInputElement | null;
                        if (el) el.value = '';
                      }}
                      className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label="Remove attachment"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={editingMessageId ? !editingMessageText.trim() : false}
                className={`px-6 py-2 font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  editingMessageId
                    ? editingMessageText.trim()
                      ? "bg-[#2E7D32] hover:brightness-110 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-[#2E7D32] hover:brightness-110 text-white"
                }`}
              >
                {editingMessageId ? <Check size={20} /> : <><Send size={20} /> Send</>}
              </button>
            </form>
          </div>
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Shared Notes
              </h2>
              <button
                onClick={() => setShowNoteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
              >
                <Plus size={20} /> Add Note
              </button>
            </div>
            {room.notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <FileText className="text-slate-400 dark:text-slate-500" size={40} />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  No shared notes yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  Start collaborating by creating the first note. Share your study materials, summaries, or important points with your peers.
                </p>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                >
                  <Plus size={20} /> Create First Note
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto flex-1 auto-rows-min items-start">
                {room.notes.map((note) => (
                  <div
                    key={note._id}
                    onClick={() => setViewingNote(note)}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 relative group h-fit cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-1.5 pr-8">
                      {note.title}
                    </h3>
                    <div 
                      className="text-slate-600 dark:text-slate-400 text-xs mb-2 line-clamp-3 prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      By {note.userId.firstName} {note.userId.lastName} •{" "}
                      {new Date(note.createdAt).toLocaleDateString()}
                    </p>
                    {note.userId._id === session?.user?.id && (
                      <div className="message-menu absolute top-2 right-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNoteMenu(showNoteMenu === note._id ? null : note._id);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-all text-slate-600 dark:text-slate-300"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {showNoteMenu === note._id && (
                          <div className="absolute right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 z-10 min-w-[120px]">
                            <button
                              onClick={() => handleEditNote(note)}
                              className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2 text-slate-800 dark:text-white"
                            >
                              <Edit2 size={16} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note._id)}
                              className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2 text-red-600 dark:text-red-400"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === "challenges" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                Peer Challenges
              </h2>
              <button
                onClick={() => setShowChallengeModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
              >
                <Plus size={20} /> Create Challenge
              </button>
            </div>
            {room.challenges.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                  <Award className="text-slate-400 dark:text-slate-500" size={40} />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  No challenges yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                  Test your knowledge and challenge your peers! Create quiz questions to help everyone learn together.
                </p>
                <button
                  onClick={() => setShowChallengeModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                >
                  <Plus size={20} /> Create First Challenge
                </button>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1">
                {room.challenges.map((challenge) => {
                  const userResponse = challenge.responses.find(
                    (r) => r.userId === session?.user?.id
                  );
                  return (
                    <div
                      key={challenge._id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 relative group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                            {challenge.question}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            By {challenge.createdBy.firstName} {challenge.createdBy.lastName} •{" "}
                            {new Date(challenge.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {challenge.createdBy._id === session?.user?.id && (
                          <div className="message-menu relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowChallengeMenu(showChallengeMenu === challenge._id ? null : challenge._id);
                              }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-all text-slate-600 dark:text-slate-300"
                            >
                              <MoreVertical size={18} />
                            </button>
                            {showChallengeMenu === challenge._id && (
                              <div className="absolute right-0 mt-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 py-1 z-10">
                                <button
                                  onClick={() => handleDeleteChallenge(challenge._id)}
                                  className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center gap-2 text-red-600 dark:text-red-400"
                                >
                                  <Trash2 size={16} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {challenge.options.map((option, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              !userResponse && handleAnswerChallenge(challenge._id, index)
                            }
                            disabled={!!userResponse}
                            className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                              userResponse
                                ? userResponse.selectedOption === index
                                  ? userResponse.isCorrect
                                    ? "bg-green-100 dark:bg-green-900 border-2 border-green-500"
                                    : "bg-red-100 dark:bg-red-900 border-2 border-red-500"
                                  : index === challenge.correctAnswer
                                  ? "bg-green-100 dark:bg-green-900 border-2 border-green-500"
                                  : "bg-slate-100 dark:bg-slate-700"
                                : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                            }`}
                          >
                            {option}
                            {userResponse && index === challenge.correctAnswer && " ✓"}
                          </button>
                        ))}
                      </div>
                      {userResponse && (
                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            <strong>Explanation:</strong> {challenge.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {editingNoteId ? "Edit Note" : "New Note"}
              </h2>
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setEditingNoteId(null);
                  setNoteTitle("");
                  setNoteContent("");
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleCreateNote} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {/* Title Input - Notion Style */}
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Untitled"
                  className="w-full text-3xl font-bold text-slate-800 dark:text-slate-100 bg-transparent border-none outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />

                {/* Rich Text Editor */}
                <RichTextEditor
                  content={noteContent}
                  onChange={setNoteContent}
                  placeholder="Start writing..."
                />
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteModal(false);
                    setEditingNoteId(null);
                    setNoteTitle("");
                    setNoteContent("");
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} /> Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                >
                  {editingNoteId ? <><Save size={18} /> Update Note</> : <><Plus size={18} /> Save Note</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Note Modal */}
      {viewingNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <style jsx global>{`
            .tiptap-content-view h1 {
              font-size: 2em;
              font-weight: bold;
              margin-top: 0.5em;
              margin-bottom: 0.5em;
              line-height: 1.2;
            }
            .tiptap-content-view h2 {
              font-size: 1.5em;
              font-weight: bold;
              margin-top: 0.5em;
              margin-bottom: 0.5em;
              line-height: 1.3;
            }
            .tiptap-content-view h3 {
              font-size: 1.25em;
              font-weight: bold;
              margin-top: 0.5em;
              margin-bottom: 0.5em;
              line-height: 1.4;
            }
            .tiptap-content-view ul {
              list-style-type: disc;
              padding-left: 1.5em;
              margin: 0.5em 0;
            }
            .tiptap-content-view ol {
              list-style-type: decimal;
              padding-left: 1.5em;
              margin: 0.5em 0;
            }
            .tiptap-content-view li {
              margin: 0.25em 0;
            }
            .tiptap-content-view blockquote {
              border-left: 4px solid #2E7D32;
              padding-left: 1em;
              margin: 1em 0;
              font-style: italic;
              color: #64748b;
            }
            .dark .tiptap-content-view blockquote {
              color: #94a3b8;
            }
            .tiptap-content-view p {
              margin: 0.5em 0;
            }
            .tiptap-content-view strong {
              font-weight: bold;
            }
            .tiptap-content-view em {
              font-style: italic;
            }
            .tiptap-content-view u {
              text-decoration: underline;
            }
            .tiptap-content-view s {
              text-decoration: line-through;
            }
            .tiptap-content-view code {
              background-color: #f1f5f9;
              padding: 0.2em 0.4em;
              border-radius: 0.25em;
              font-family: monospace;
              font-size: 0.9em;
            }
            .dark .tiptap-content-view code {
              background-color: #334155;
            }
            .tiptap-content-view pre {
              background-color: #f1f5f9;
              border: 1px solid #e2e8f0;
              border-radius: 0.5em;
              padding: 1em;
              margin: 1em 0;
              overflow-x: auto;
            }
            .dark .tiptap-content-view pre {
              background-color: #1e293b;
              border-color: #334155;
            }
            .tiptap-content-view pre code {
              background-color: transparent;
              padding: 0;
              border-radius: 0;
              font-family: 'Courier New', Courier, monospace;
              font-size: 0.875em;
              line-height: 1.5;
              color: #334155;
            }
            .dark .tiptap-content-view pre code {
              color: #e2e8f0;
            }
            .tiptap-content-view a {
              color: #2E7D32;
              text-decoration: underline;
            }
          `}</style>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                View Note
              </h2>
              <button
                onClick={() => setViewingNote(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                {/* Title - Notion Style */}
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {viewingNote.title}
                </h1>

                {/* Content - Read-only with same styling as editor */}
                <div 
                  className="text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none tiptap-content-view min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: viewingNote.content }}
                />

                {/* Author Info */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500 dark:text-slate-500">
                    By {viewingNote.userId.firstName} {viewingNote.userId.lastName} •{" "}
                    {new Date(viewingNote.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            {viewingNote.userId._id === session?.user?.id && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    handleEditNote(viewingNote);
                    setViewingNote(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors"
                >
                  <Edit2 size={16} /> Edit
                </button>
                <button
                  onClick={() => {
                    handleDeleteNote(viewingNote._id);
                    setViewingNote(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {modalView === 'members' ? `Members (${room.members.length})` : 'Invite Students'}
              </h2>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setStudentSearch("");
                  setSearchResults([]);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
              >
                <X size={20} />
              </button>
            </div>

            {modalView === 'members' ? (
              <div className="space-y-3 mb-4">
                {room.members.map((member) => (
                  <div
                    key={member._id}
                    className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {member.firstName} {member.lastName}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                      Member
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Search Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Search for students by name or email
                  </label>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => handleSearchStudents(e.target.value)}
                    placeholder="Type to search..."
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                  />
                </div>

                {/* Search Results or Suggested Users */}
                {searchLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E7D32] mx-auto"></div>
                  </div>
                )}

                {!searchLoading && (searchResults.length > 0 || (studentSearch.length === 0 && suggestedUsers.length > 0)) && (
                  <div className="space-y-2 mb-6">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {studentSearch.length > 0 ? "Search Results" : "Suggested Students"}
                    </p>
                    {(studentSearch.length > 0 ? searchResults : suggestedUsers).map((student) => {
                      const isAlreadyMember = room.members.some(m => m._id === student._id);
                      const isAlreadyInvited = room.pendingInvites?.some(inv => inv.userId._id === student._id);
                      const isDisabled = isAlreadyMember || isAlreadyInvited;
                      
                      return (
                        <div
                          key={student._id}
                          className={`flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors ${
                            isDisabled ? 'opacity-60 bg-slate-50 dark:bg-slate-900' : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{student.email}</p>
                          </div>
                          {isAlreadyMember ? (
                            <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                              Member
                            </span>
                          ) : isAlreadyInvited ? (
                            <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                              Invited
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSendInvite(student.email)}
                              className="flex items-center gap-2 px-4 py-2 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                            >
                              <Mail size={16} /> Invite
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!searchLoading && studentSearch.length >= 2 && searchResults.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={48} />
                    <p className="text-slate-600 dark:text-slate-400">No students found</p>
                  </div>
                )}

                {/* Pending Invites */}
                {room.pendingInvites && room.pendingInvites.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Pending Invites ({room.pendingInvites.length})
                    </p>
                    <div className="space-y-2">
                      {room.pendingInvites.map((invite) => (
                        <div
                          key={invite.userId._id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              {invite.userId.firstName} {invite.userId.lastName}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Invited by {invite.invitedBy.firstName} {invite.invitedBy.lastName} •{" "}
                              {new Date(invite.invitedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                            Pending
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Challenge Modal */}
      {showChallengeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
              Create Peer Challenge
            </h2>
            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Question
                </label>
                <input
                  type="text"
                  required
                  value={newChallenge.question}
                  onChange={(e) => setNewChallenge({ ...newChallenge, question: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                />
              </div>
              {newChallenge.options.map((option, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Option {index + 1}
                  </label>
                  <input
                    type="text"
                    required
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...newChallenge.options];
                      newOptions[index] = e.target.value;
                      setNewChallenge({ ...newChallenge, options: newOptions });
                    }}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Correct Answer
                </label>
                <select
                  value={newChallenge.correctAnswer}
                  onChange={(e) => setNewChallenge({ ...newChallenge, correctAnswer: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                >
                  {newChallenge.options.map((_, index) => (
                    <option key={index} value={index}>Option {index + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Explanation
                </label>
                <textarea
                  required
                  value={newChallenge.explanation}
                  onChange={(e) => setNewChallenge({ ...newChallenge, explanation: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowChallengeModal(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={18} /> Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                >
                  <Plus size={18} /> Create Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        isDangerous={confirmModal.isDangerous}
      />

      {/* Unsend Message Modal */}
      {unsendModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setUnsendModal({ isOpen: false, messageId: null })}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl transform transition-all">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Unsend Message</h2>
              </div>
              <div className="p-4 space-y-2">
                <button
                  onClick={() => handleUnsendMessage("everyone")}
                  className="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white">Unsend for everyone</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This message will be removed for all members
                  </p>
                </button>
                <button
                  onClick={() => handleUnsendMessage("me")}
                  className="w-full px-4 py-3 text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <p className="font-medium text-gray-900 dark:text-white">Unsend for you</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This message will only be hidden from your view
                  </p>
                </button>
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setUnsendModal({ isOpen: false, messageId: null })}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
