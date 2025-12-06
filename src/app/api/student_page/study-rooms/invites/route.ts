import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// Get all pending invites for the current user
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all rooms where user has pending invites
    const rooms = await StudyRoom.find({
      "pendingInvites.userId": user._id,
    })
      .populate("createdBy", "firstName lastName")
      .populate("pendingInvites.invitedBy", "firstName lastName")
      .lean();

    const invites = rooms.map((room: any) => {
      const invite = room.pendingInvites.find(
        (inv: any) => inv.userId.toString() === user._id.toString()
      );
      return {
        roomId: room._id,
        roomName: room.name,
        roomDescription: room.description,
        roomSubject: room.subject,
        invitedBy: invite.invitedBy,
        invitedAt: invite.invitedAt,
        memberCount: room.members.length,
        maxMembers: room.maxMembers,
      };
    });

    return NextResponse.json({ invites });
  } catch (error: any) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}
