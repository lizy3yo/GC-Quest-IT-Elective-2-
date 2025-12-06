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

    // Remove invite
    room.pendingInvites.splice(inviteIndex, 1);
    await room.save();

    return NextResponse.json({ message: "Invite declined" });
  } catch (error: unknown) {
    console.error("Error declining invite:", error);
    return NextResponse.json(
      { error: "Failed to decline invite" },
      { status: 500 }
    );
  }
}
