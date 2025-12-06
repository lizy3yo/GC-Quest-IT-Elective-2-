import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function PATCH(
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

    if (!title || !title.trim() || !content || !content.trim()) {
      return NextResponse.json(
        { error: "Title and content cannot be empty" },
        { status: 400 }
      );
    }

    const room = await StudyRoom.findById(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const noteToEdit = room.notes.find(
      (note: any) => note._id?.toString() === params.noteId
    );
    if (!noteToEdit) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Check if user is the note author
    if (noteToEdit.userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    noteToEdit.title = title.trim();
    noteToEdit.content = content.trim();
    await room.save();

    const populatedNote = await StudyRoom.populate(noteToEdit, {
      path: "userId",
      select: "firstName lastName",
    });

    return NextResponse.json({ note: populatedNote }, { status: 200 });
  } catch (error: any) {
    console.error("Error editing note:", error);
    return NextResponse.json(
      { error: "Failed to edit note" },
      { status: 500 }
    );
  }
}

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

    const noteIndex = room.notes.findIndex(
      (note: any) => note._id?.toString() === params.noteId
    );
    if (noteIndex === -1) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Check if user is the note author
    if (room.notes[noteIndex].userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    room.notes.splice(noteIndex, 1);
    await room.save();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
