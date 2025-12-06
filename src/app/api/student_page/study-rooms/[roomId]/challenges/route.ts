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
    const { question, options, correctAnswer, explanation } = body;

    if (!question || !options || correctAnswer === undefined || !explanation) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (options.length !== 4) {
      return NextResponse.json(
        { error: "Must provide exactly 4 options" },
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

    room.challenges.push({
      createdBy: user._id,
      question,
      options,
      correctAnswer,
      explanation,
      responses: [],
      createdAt: new Date(),
    });

    await room.save();

    const newChallenge = room.challenges[room.challenges.length - 1];
    const populatedChallenge = await StudyRoom.populate(newChallenge, {
      path: "createdBy",
      select: "firstName lastName",
    });

    return NextResponse.json({ challenge: populatedChallenge }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating challenge:", error);
    return NextResponse.json(
      { error: "Failed to create challenge" },
      { status: 500 }
    );
  }
}
