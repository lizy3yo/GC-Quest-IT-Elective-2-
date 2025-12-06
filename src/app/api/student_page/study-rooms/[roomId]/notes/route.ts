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
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
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

    room.notes.push({
      userId: user._id,
      title,
      content,
      createdAt: new Date(),
    });

    await room.save();

    const newNote = room.notes[room.notes.length - 1];
    const populatedNote = await StudyRoom.populate(newNote, {
      path: "userId",
      select: "firstName lastName",
    });

    return NextResponse.json({ note: populatedNote }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
