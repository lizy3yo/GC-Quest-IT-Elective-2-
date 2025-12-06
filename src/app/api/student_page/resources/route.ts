import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import Class from "@/models/class";
import User from "@/models/user";
import { cache, CACHE_TTL, cacheTags } from "@/lib/cache";

export async function GET(req: NextRequest) {
  try {
    console.log("=== FETCHING RESOURCES START ===");
    
    // Use the auth helper that supports both NextAuth and JWT
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      console.log("No valid authentication found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = user._id.toString();
    console.log("Authenticated user ID:", userId);

    // Check cache first
    const cacheKey = `resources:${userId}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json({ resources: cachedData, cached: true });
    }

    await connectToDatabase();

    // Get all classes where user is either teacher or student
    const teacherClasses = await Class.find({
      teacherId: userId,
      isActive: true,
    }).select("_id");
    console.log("Teacher classes:", teacherClasses.length);

    const studentClasses = await Class.find({
      students: {
        $elemMatch: {
          studentId: userId,
          status: "active",
        },
      },
      isActive: true,
    }).select("_id");
    console.log("Student classes:", studentClasses.length);

    const classIds = [
      ...teacherClasses.map((c) => c._id),
      ...studentClasses.map((c) => c._id),
    ];
    console.log("Total class IDs:", classIds.length, classIds);

    // Fetch ALL resources first to debug
    const allResources = await Resource.find({}).lean();
    console.log("ALL resources in DB:", allResources.length);
    console.log("Sample of all resources:", allResources.slice(0, 3).map(r => ({
      title: r.title,
      classId: r.classId,
      classIdType: typeof r.classId,
      isVerified: r.isVerified
    })));

    // Fetch resources that are either:
    // 1. Verified (public resources from auto-discovery)
    // 2. Belong to user's classes (shared within class)
    const query = {
      $or: [
        { isVerified: true, classId: { $exists: false } }, // Public verified resources
        { classId: { $in: classIds } }, // Resources from user's classes
      ],
    };
    console.log("Query:", JSON.stringify(query, null, 2));
    
    const resources = await Resource.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    console.log("Resources found by query:", resources.length);
    console.log("Sample filtered resources:", resources.slice(0, 2).map(r => ({
      title: r.title,
      classId: r.classId,
      isVerified: r.isVerified
    })));

    // Convert ObjectIds to strings for frontend compatibility
    const serializedResources = resources.map(resource => ({
      ...resource,
      _id: resource._id?.toString(),
      bookmarkedBy: resource.bookmarkedBy?.map((id: any) => id?.toString()) || [],
      uploadedBy: resource.uploadedBy?.toString() || null,
      classId: resource.classId?.toString() || null,
    }));

    // Cache for 5 minutes
    cache.set(cacheKey, serializedResources, {
      ttl: CACHE_TTL.MEDIUM,
      tags: [cacheTags.user(userId)]
    });

    return NextResponse.json({ resources: serializedResources, cached: false, userId });
  } catch (error: any) {
    console.error("Error fetching resources:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      title,
      description,
      type,
      category,
      subject,
      url,
      thumbnailUrl,
      author,
      source,
      tags,
    } = body;

    if (!title || !description || !type || !category || !subject || !url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const resource = await Resource.create({
      title,
      description,
      type,
      category,
      subject,
      url,
      thumbnailUrl,
      author,
      source,
      tags: tags || [],
      uploadedBy: user._id,
      isVerified: false, // Admin needs to verify
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating resource:", error);
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 }
    );
  }
}
