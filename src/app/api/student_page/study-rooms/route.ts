import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import StudyRoom from "@/models/study-room";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { cache, CACHE_TTL, cacheTags } from "@/lib/cache";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check cache first
    const cacheKey = `study-rooms:${user._id}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ rooms: cachedData, cached: true });
    }

    await connectToDatabase();

    // Get all public rooms and private rooms where user is a member
    const rooms = await StudyRoom.find({
      $or: [
        { isPrivate: false },
        { isPrivate: true, members: user._id }
      ]
    })
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    // Cache for 2 minutes
    cache.set(cacheKey, rooms, {
      ttl: CACHE_TTL.SHORT * 4,
      tags: [cacheTags.user(user._id.toString())]
    });

    return NextResponse.json({ rooms, cached: false });
  } catch (error: any) {
    console.error("Error fetching study rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch study rooms" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, subject, isPrivate, maxMembers } = body;

    if (!name || !description || !subject) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const room = await StudyRoom.create({
      name,
      description,
      subject,
      isPrivate: isPrivate || false,
      maxMembers: maxMembers || 10,
      createdBy: user._id,
      members: [user._id],
    });

    const populatedRoom = await StudyRoom.findById(room._id)
      .populate("createdBy", "firstName lastName")
      .lean();

    // Invalidate study rooms cache
    cache.invalidateByTag(cacheTags.user(user._id.toString()));

    return NextResponse.json({ room: populatedRoom }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating study room:", error);
    return NextResponse.json(
      { error: "Failed to create study room" },
      { status: 500 }
    );
  }
}
