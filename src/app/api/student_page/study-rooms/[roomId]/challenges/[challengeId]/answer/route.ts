import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function POST(
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

    const body = await req.json();
    const { selectedOption } = body;

    if (selectedOption === undefined) {
      return NextResponse.json(
        { error: "Selected option is required" },
        { status: 400 }
      );
    }

    const room = await StudyRoom.findById(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if user is a member
    if (!room.members.includes(user._id)) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const challenge = room.challenges.find((c: any) => c._id.toString() === params.challengeId);
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Check if user has already answered
    const existingResponse = challenge.responses.find(
      (r: any) => r.userId.toString() === user._id.toString()
    );

    if (existingResponse) {
      return NextResponse.json(
        { error: "Already answered this challenge" },
        { status: 400 }
      );
    }

    const isCorrect = selectedOption === challenge.correctAnswer;

    challenge.responses.push({
      userId: user._id,
      selectedOption,
      isCorrect,
      answeredAt: new Date(),
    });

    await room.save();

    return NextResponse.json({ isCorrect });
  } catch (error: any) {
    console.error("Error answering challenge:", error);
    return NextResponse.json(
      { error: "Failed to answer challenge" },
      { status: 500 }
    );
  }
}
