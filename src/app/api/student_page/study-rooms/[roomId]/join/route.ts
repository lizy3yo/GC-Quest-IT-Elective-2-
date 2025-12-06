import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  context: any
) {
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

    // Check if user is already a member
    if (room.members.some((m: any) => m.toString() === user._id.toString())) {
      return NextResponse.json({ message: "Already a member" });
    }

    // Check if room is private and user doesn't have an invite
    if (room.isPrivate) {
      const hasInvite = room.pendingInvites.some(
        (inv: any) => inv.userId.toString() === user._id.toString()
      );
      if (!hasInvite) {
        return NextResponse.json({ error: "This is a private room. You need an invite to join." }, { status: 403 });
      }
      
      // Remove the invite after joining
      room.pendingInvites = room.pendingInvites.filter(
        (inv: any) => inv.userId.toString() !== user._id.toString()
      );
    }

    // Check if room is full
    if (room.members.length >= room.maxMembers) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    room.members.push(user._id);

    // Add system message to the conversation indicating that the user joined
    room.messages.push({
      userId: user._id,
      message: `${user.firstName} ${user.lastName} joined the room`,
      timestamp: new Date(),
      type: 'system',
    } as any);

    await room.save();

    // Populate the last message to include firstName/lastName for client consumption
    const newMessage = room.messages[room.messages.length - 1];
    const populatedMessage = await StudyRoom.populate(newMessage, {
      path: 'userId',
      select: 'firstName lastName',
    });

    return NextResponse.json({ message: "Successfully joined room", newMessage: populatedMessage });
  } catch (error: unknown) {
    console.error("Error joining study room:", error);
    return NextResponse.json(
      { error: "Failed to join study room" },
      { status: 500 }
    );
  }
}
