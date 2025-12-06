import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest, context: any) {
  const { params } = await context;
  const resolvedParams = await params;
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let room: any = await StudyRoom.findById(resolvedParams.roomId)
      .populate("createdBy", "firstName lastName")
      .populate("members", "firstName lastName")
      .populate("messages.userId", "firstName lastName")
      .populate("notes.userId", "firstName lastName")
      .populate("challenges.createdBy", "firstName lastName")
      .lean();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Ensure pendingInvites exists (for backward compatibility with existing rooms)
    if (!room.pendingInvites) {
      room.pendingInvites = [];
    }

    // Try to populate pending invites if they exist
    try {
      if (room.pendingInvites.length > 0) {
        const populatedRoom = await StudyRoom.findById(resolvedParams.roomId)
          .populate("createdBy", "firstName lastName")
          .populate("members", "firstName lastName")
          .populate("pendingInvites.userId", "firstName lastName email")
          .populate("pendingInvites.invitedBy", "firstName lastName")
          .populate("messages.userId", "firstName lastName")
          .populate("notes.userId", "firstName lastName")
          .populate("challenges.createdBy", "firstName lastName")
          .lean();
        
        if (populatedRoom) {
          room = populatedRoom;
        }
      }
    } catch (populateError) {
      console.log("Could not populate pending invites:", populateError);
      // Continue with unpopulated invites
    }

    // Check if user is a member or if room is public
    const isMember = room.members.some((m: any) => m._id.toString() === user._id.toString());
    if (room.isPrivate && !isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ room });
  } catch (error: unknown) {
    console.error("Error fetching study room:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", errorMessage, errorStack);
    return NextResponse.json(
      { error: "Failed to fetch study room", details: errorMessage },
      { status: 500 }
    );
  }
}
