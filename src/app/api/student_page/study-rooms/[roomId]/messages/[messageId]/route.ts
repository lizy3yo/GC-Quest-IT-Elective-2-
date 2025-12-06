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
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    const room = await StudyRoom.findById(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const messageToEdit = room.messages.find(
      (msg: any) => msg._id?.toString() === params.messageId
    );
    if (!messageToEdit) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user is the message author
    if (messageToEdit.userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Add current message to edit history before updating
    if (!messageToEdit.editHistory) {
      messageToEdit.editHistory = [];
    }
    messageToEdit.editHistory.push({
      message: messageToEdit.message,
      editedAt: new Date(),
    });
    
    messageToEdit.message = message.trim();
    messageToEdit.isEdited = true;
    
    room.markModified('messages');
    await room.save();

    const populatedMessage = await StudyRoom.populate(messageToEdit, {
      path: "userId",
      select: "firstName lastName",
    });

    return NextResponse.json({ message: populatedMessage }, { status: 200 });
  } catch (error: any) {
    console.error("Error editing message:", error);
    return NextResponse.json(
      { error: "Failed to edit message" },
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

    // Get unsend mode from query params: "everyone" or "me"
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "everyone";

    const room = await StudyRoom.findById(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const messageIndex = room.messages.findIndex(
      (msg: any) => msg._id?.toString() === params.messageId
    );
    if (messageIndex === -1) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Check if user is the message author
    if (room.messages[messageIndex].userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (mode === "everyone") {
      // Mark as deleted for everyone
      room.messages[messageIndex].deletedForEveryone = true;
    } else {
      // Mark as deleted only for the current user
      if (!room.messages[messageIndex].deletedFor) {
        room.messages[messageIndex].deletedFor = [];
      }
      if (!room.messages[messageIndex].deletedFor.includes(user._id)) {
        room.messages[messageIndex].deletedFor.push(user._id);
      }
    }

    // Mark the messages array as modified so Mongoose saves the changes
    room.markModified('messages');
    await room.save();

    return NextResponse.json({ success: true, mode }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
