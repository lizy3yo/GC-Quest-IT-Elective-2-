import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function DELETE(
  req: NextRequest,
  context: any
) {
  const { params } = await context;
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const room = await StudyRoom.findById(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const challengeIndex = room.challenges.findIndex(
      (challenge: any) => challenge._id?.toString() === params.challengeId
    );
    if (challengeIndex === -1) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Check if user is the challenge creator
    if (room.challenges[challengeIndex].createdBy.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    room.challenges.splice(challengeIndex, 1);
    await room.save();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting challenge:", error);
    return NextResponse.json(
      { error: "Failed to delete challenge" },
      { status: 500 }
    );
  }
}
