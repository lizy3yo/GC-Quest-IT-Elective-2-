import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function POST(req: NextRequest, context: any) {
  const { params } = await context;
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let message: string | undefined = undefined;
    let attachment: any = undefined;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      // Use Web FormData parsing (supported in Next.js route handlers)
      try {
        const form = await req.formData();
        const msg = form.get("message");
        const file = form.get("file") as any;
        if (msg && typeof msg === "string") message = msg;

        if (file && file.size) {
          // Log file metadata for debugging
          try {
            console.log("Uploading file metadata:", {
              name: (file as any).name ?? null,
              size: (file as any).size ?? null,
              type: (file as any).type ?? null,
            });
          } catch (logErr) {
            console.error("Could not log file metadata", logErr);
          }
          // Enforce 10 MB limit
          const MAX_BYTES = 10 * 1024 * 1024;
          if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
          }

          // Upload to Cloudinary using the same unsigned preset pattern
          // used elsewhere in the app (e.g. assessment creation).
          const cloudName = process.env.CLOUD_NAME || "dqvhbvqnw";
          const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "ml_default";

          if (!cloudName || !uploadPreset) {
            console.error("Cloudinary unsigned upload config missing", { cloudName, uploadPreset });
            return NextResponse.json({ error: "Cloudinary not configured for uploads" }, { status: 500 });
          }

          const uploadForm = new FormData();
          uploadForm.append("file", file as any, (file as any).name || "upload");
          uploadForm.append("upload_preset", uploadPreset);

          const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: "POST",
            body: uploadForm as any,
          });

          const text = await uploadRes.text();
          if (!uploadRes.ok) {
            console.error("Cloudinary upload failed:", { status: uploadRes.status, body: text });
            // Return the response text to help debugging (non-sensitive)
            return NextResponse.json({ error: "File upload failed", details: text }, { status: 500 });
          }

          // Try parse JSON; if parsing fails, include raw text
          let uploadJson: any;
          try {
            uploadJson = JSON.parse(text);
          } catch (err) {
            console.error("Failed to parse Cloudinary response as JSON", { err, text });
            return NextResponse.json({ error: "Invalid response from file upload provider", details: text }, { status: 500 });
          }

          attachment = {
            url: uploadJson.secure_url,
            public_id: uploadJson.public_id,
            resource_type: uploadJson.resource_type,
            filename: uploadJson.original_filename || (file as any).name,
          };
        }
      } catch (err) {
        console.error("Error handling multipart/form-data upload:", err);
        return NextResponse.json({ error: "Failed to process file upload", details: String(err) }, { status: 500 });
      }
    } else {
      const body = await req.json();
      message = body.message;
    }

    if (!message || !message.trim()) {
      if (!attachment) {
        return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
      }
    }

    const room = await StudyRoom.findById(params.roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Check if user is a member
    if (!room.members.includes(user._id)) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    const msgDoc: any = {
      userId: user._id,
      message: message ? message.trim() : "",
      timestamp: new Date(),
      type: 'message',
    };
    if (attachment) {
      msgDoc.attachments = [attachment];
    }

    room.messages.push(msgDoc as any);

    await room.save();

    const newMessage = room.messages[room.messages.length - 1];
    const populatedMessage = await StudyRoom.populate(newMessage, {
      path: "userId",
      select: "firstName lastName",
    });

    return NextResponse.json({ message: populatedMessage }, { status: 201 });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
