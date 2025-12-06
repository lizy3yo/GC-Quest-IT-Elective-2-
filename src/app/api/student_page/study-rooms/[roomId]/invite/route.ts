import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import User from "@/models/user";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// Send invite to a user
export async function POST(req: NextRequest, context: any) {
  const { params } = await context;
  const resolvedParams = await params;
  
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteeEmail } = await req.json();
    if (!inviteeEmail) {
      return NextResponse.json({ error: "Invitee email is required" }, { status: 400 });
    }

    const room = await StudyRoom.findById(resolvedParams.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Initialize pendingInvites if it doesn't exist (for backward compatibility)
    if (!room.pendingInvites) {
      room.pendingInvites = [];
    }

    // Check if user is a member of the room
    const isMember = room.members.some((m: any) => m.toString() === user._id.toString());
    if (!isMember) {
      return NextResponse.json({ error: "Only members can invite others" }, { status: 403 });
    }

    // Find the invitee
    const invitee = await User.findOne({ email: inviteeEmail });
    if (!invitee) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if invitee is already a member
    if (room.members.some((m: any) => m.toString() === invitee._id.toString())) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Check if invite already exists
    if (room.pendingInvites && room.pendingInvites.some((inv: any) => inv.userId.toString() === invitee._id.toString())) {
      return NextResponse.json({ error: "Invite already sent" }, { status: 400 });
    }

    // Check if room is full
    if (room.members.length >= room.maxMembers) {
      return NextResponse.json({ error: "Room is full" }, { status: 400 });
    }

    // Add invite
    room.pendingInvites.push({
      userId: invitee._id,
      invitedBy: user._id,
      invitedAt: new Date(),
    } as any);

    await room.save();

    return NextResponse.json({ 
      message: "Invite sent successfully",
      invitee: {
        firstName: invitee.firstName,
        lastName: invitee.lastName,
        email: invitee.email,
      }
    });
  } catch (error: any) {
    console.error("Error sending invite:", error);
    console.error("Error details:", error.message, error.stack);
    return NextResponse.json(
      { error: "Failed to send invite", details: error.message },
      { status: 500 }
    );
  }
}

// Get pending invites for current user
export async function GET(req: NextRequest, context: any) {
  try {
    await connectToDatabase();

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
  } catch (error: unknown) {
    console.error("Error fetching invites:", error);
    return NextResponse.json(
      { error: "Failed to fetch invites" },
      { status: 500 }
    );
  }
}
