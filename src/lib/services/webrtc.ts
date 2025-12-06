// WebRTC Configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export interface PeerConnection {
  userId: string;
  userName: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  pendingIceCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
}

export class WebRTCService {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStreamCallback?: (userId: string, userName: string, stream: MediaStream) => void;
  private onPeerDisconnectedCallback?: (userId: string) => void;

  constructor(
    onRemoteStream?: (userId: string, userName: string, stream: MediaStream) => void,
    onPeerDisconnected?: (userId: string) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerDisconnectedCallback = onPeerDisconnected;
  }

  async getLocalStream(audio: boolean = true, video: boolean = true): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: video ? { width: 1280, height: 720 } : false,
      });
      return this.localStream;
    } catch (error) {
      console.error("Error getting local stream:", error);
      throw error;
    }
  }

  async createPeerConnection(
    userId: string,
    userName: string,
    isInitiator: boolean,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onOffer?: (offer: RTCSessionDescriptionInit) => void,
    onAnswer?: (answer: RTCSessionDescriptionInit) => void
  ): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local stream to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(userId, userName, remoteStream);
      }

      // Store the stream in the peer connection
      const peer = this.peerConnections.get(userId);
      if (peer) {
        peer.stream = remoteStream;
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${userName}:`, peerConnection.connectionState);
      if (
        peerConnection.connectionState === "disconnected" ||
        peerConnection.connectionState === "failed" ||
        peerConnection.connectionState === "closed"
      ) {
        this.removePeerConnection(userId);
        if (this.onPeerDisconnectedCallback) {
          this.onPeerDisconnectedCallback(userId);
        }
      }
    };

    // Store peer connection
    this.peerConnections.set(userId, {
      userId,
      userName,
      connection: peerConnection,
      pendingIceCandidates: [],
      hasRemoteDescription: false,
    });

    // If initiator, create and send offer
    if (isInitiator) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      if (onOffer) {
        onOffer(offer);
      }
    }

    return peerConnection;
  }

  async handleOffer(
    userId: string,
    offer: RTCSessionDescriptionInit,
    onAnswer: (answer: RTCSessionDescriptionInit) => void
  ) {
    const peer = this.peerConnections.get(userId);
    if (!peer) {
      console.error("Peer connection not found for user:", userId);
      return;
    }

    await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));
    peer.hasRemoteDescription = true;
    
    // Process any pending ICE candidates
    await this.processPendingIceCandidates(userId);
    
    const answer = await peer.connection.createAnswer();
    await peer.connection.setLocalDescription(answer);
    onAnswer(answer);
  }

  async handleAnswer(userId: string, answer: RTCSessionDescriptionInit) {
    const peer = this.peerConnections.get(userId);
    if (!peer) {
      console.error("Peer connection not found for user:", userId);
      return;
    }

    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    peer.hasRemoteDescription = true;
    
    // Process any pending ICE candidates
    await this.processPendingIceCandidates(userId);
  }

  private async processPendingIceCandidates(userId: string) {
    const peer = this.peerConnections.get(userId);
    if (!peer) return;

    // Process all pending ICE candidates
    while (peer.pendingIceCandidates.length > 0) {
      const candidate = peer.pendingIceCandidates.shift();
      if (candidate) {
        try {
          await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding queued ICE candidate:", error);
        }
      }
    }
  }

  async handleIceCandidate(userId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peerConnections.get(userId);
    if (!peer) {
      console.error("Peer connection not found for user:", userId);
      return;
    }

    // If remote description is not set yet, queue the candidate
    if (!peer.hasRemoteDescription) {
      console.log("Queuing ICE candidate - remote description not set yet");
      peer.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  }

  removePeerConnection(userId: string) {
    const peer = this.peerConnections.get(userId);
    if (peer) {
      peer.connection.close();
      this.peerConnections.delete(userId);
    }
  }

  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  async replaceVideoTrack(newStream: MediaStream) {
    const videoTrack = newStream.getVideoTracks()[0];
    
    this.peerConnections.forEach((peer) => {
      const sender = peer.connection
        .getSenders()
        .find((s) => s.track?.kind === "video");
      
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    });

    // Update local stream
    if (this.localStream) {
      const oldVideoTrack = this.localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }
      if (videoTrack) {
        this.localStream.addTrack(videoTrack);
      }
    }
  }

  closeAllConnections() {
    this.peerConnections.forEach((peer) => {
      peer.connection.close();
    });
    this.peerConnections.clear();
    this.stopLocalStream();
  }

  getActivePeers(): PeerConnection[] {
    return Array.from(this.peerConnections.values());
  }
}
