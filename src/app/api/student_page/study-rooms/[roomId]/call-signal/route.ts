import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { pusherServer } from "@/lib/pusher";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user._id.toString();
    const { roomId } = await params;
    const body = await req.json();
    const { type, signal, targetUserId } = body;

    // Verify user is a member of the room
    const room = await StudyRoom.findById(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const isMember = room.members.some(
      (member: any) => member.toString() === userId
    );
    if (!isMember) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    // Prepare signal data
    const signalData = {
      type,
      signal,
      from: userId,
      fromName: `${user.firstName} ${user.lastName}` || "Unknown User",
      timestamp: Date.now(),
    };

    // Use Pusher to broadcast the signal
    const channelName = `study-room-${roomId}`;
    
    if (targetUserId) {
      // Send to specific user via private channel
      await pusherServer.trigger(`private-user-${targetUserId}`, "call-signal", signalData);
    } else {
      // Broadcast to all room members (they'll filter out their own signals client-side)
      await pusherServer.trigger(channelName, "call-signal", signalData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling call signal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint kept for backward compatibility / fallback
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // With Pusher, we don't need polling - return empty array
    return NextResponse.json({ signals: [] });
  } catch (error) {
    console.error("Error fetching signals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
