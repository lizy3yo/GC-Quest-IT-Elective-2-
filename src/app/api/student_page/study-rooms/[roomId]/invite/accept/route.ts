import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest, context: any) {
  const { params } = await context;
  const resolvedParams = await params;
  
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const room = await StudyRoom.findById(resolvedParams.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Initialize pendingInvites if it doesn't exist
    if (!room.pendingInvites) {
      room.pendingInvites = [];
    }

    // Check if user has a pending invite
    const inviteIndex = room.pendingInvites.findIndex(
      (inv: any) => inv.userId.toString() === user._id.toString()
    );

    if (inviteIndex === -1) {
      return NextResponse.json({ error: "No pending invite found" }, { status: 404 });
    }

    // Check if room is full
    if (room.members.length >= room.maxMembers) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    // Remove invite and add user to members
    room.pendingInvites.splice(inviteIndex, 1);
    room.members.push(user._id);

    // Add system message to the conversation indicating that the user joined
    room.messages.push({
      userId: user._id,
      message: `${user.firstName} ${user.lastName} joined the room`,
      timestamp: new Date(),
      type: 'system',
    } as any);

    await room.save();

    const newMessage = room.messages[room.messages.length - 1];
    const populatedMessage = await StudyRoom.populate(newMessage, {
      path: 'userId',
      select: 'firstName lastName',
    });

    return NextResponse.json({ 
      message: "Successfully joined room",
      room: {
        _id: room._id,
        name: room.name,
      },
      newMessage: populatedMessage,
    });
  } catch (error: unknown) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 }
    );
  }
}
