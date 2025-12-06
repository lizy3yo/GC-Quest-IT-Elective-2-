import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import Class from "@/models/class";
import User from "@/models/user";
import { extractLinkMetadata, moderateContent } from "@/lib/ai/resource-discovery";
import { logger } from "@/lib/winston";
import { cache } from "@/lib/cache";

/**
 * POST /api/student_page/resources/upload
 * Upload a link to the resource library based on user's classes
 */
export async function POST(req: NextRequest) {
  try {
    console.log("=== UPLOAD RESOURCE START ===");
    
    const session = await auth();
    console.log("Session:", session?.user?.id);
    
    if (!session?.user?.id) {
      console.log("Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    console.log("Database connected");

    const body = await req.json();
    const { url, classId } = body;
    console.log("Request body:", { url, classId });

    if (!url || !classId) {
      console.log("Missing URL or classId");
      return NextResponse.json(
        { error: "URL and class ID are required" },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
      console.log("URL validation passed");
    } catch (e) {
      console.log("Invalid URL format:", e);
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Moderate content before processing
    console.log("Starting content moderation...");
    const moderation = await moderateContent(url);
    console.log("Moderation result:", moderation);
    
    if (!moderation.isAppropriate) {
      console.log("Content moderation failed:", moderation.reason);
      logger.warn("Inappropriate content blocked", {
        url,
        userId: session.user.id,
        reason: moderation.reason,
      });
      return NextResponse.json(
        { error: `This content cannot be uploaded: ${moderation.reason}` },
        { status: 400 }
      );
    }

    console.log("Content moderation passed");

    // Get user details
    const user = await User.findById(session.user.id);
    console.log("User found:", user?.name);
    
    if (!user) {
      console.log("User not found in database");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify user has access to this class
    const classDoc = await Class.findById(classId);
    console.log("Class found:", classDoc?.name, classDoc?.subject);
    
    if (!classDoc) {
      console.log("Class not found");
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Check if user is teacher or enrolled student
    const isTeacher = classDoc.teacherId === session.user.id;
    const isStudent = classDoc.students.some(
      (s: any) => s.studentId === session.user?.id && s.status === "active"
    );
    console.log("Access check:", { isTeacher, isStudent });

    if (!isTeacher && !isStudent) {
      console.log("User doesn't have access to class");
      return NextResponse.json(
        { error: "You don't have access to this class" },
        { status: 403 }
      );
    }

    // Check if resource already exists
    const existingResource = await Resource.findOne({ url });
    if (existingResource) {
      console.log("Resource already exists");
      return NextResponse.json(
        { error: "This resource already exists in the library" },
        { status: 409 }
      );
    }

    console.log("Starting AI metadata extraction...");
    logger.info("Extracting metadata from URL", {
      url,
      userId: session.user.id,
      classId,
      subject: classDoc.subject,
    });

    // Use AI to extract metadata from the link
    const metadata = await extractLinkMetadata(url, classDoc.subject);
    console.log("Metadata extracted:", metadata);

    // Create the resource
    console.log("Creating resource in database...");
    const newResource = await Resource.create({
      title: metadata.title,
      description: metadata.description,
      type: metadata.type,
      category: metadata.category,
      subject: classDoc.subject,
      url: url,
      thumbnailUrl: metadata.thumbnailUrl,
      author: metadata.author,
      source: metadata.source,
      tags: metadata.tags || [],
      uploadedBy: session.user.id,
      classId: classId,
      isVerified: false, // Manual uploads need verification
      downloads: 0,
      views: 0,
      bookmarkedBy: [],
    });

    console.log("Resource created successfully:", newResource._id);
    logger.info("Resource uploaded successfully", {
      resourceId: newResource._id,
      title: newResource.title,
      subject: newResource.subject,
      uploadedBy: user.name,
    });

    // Invalidate the user's resources cache
    const cacheKey = `resources:${session.user.id}`;
    cache.delete(cacheKey);

    // Serialize ObjectIds for frontend compatibility
    const serializedResource = {
      ...newResource.toObject(),
      _id: newResource._id?.toString(),
      bookmarkedBy: newResource.bookmarkedBy?.map((id: any) => id?.toString()) || [],
      uploadedBy: newResource.uploadedBy?.toString() || null,
      classId: newResource.classId?.toString() || null,
    };

    return NextResponse.json({
      message: "Resource uploaded successfully",
      resource: serializedResource,
    });
  } catch (error: any) {
    console.error("=== UPLOAD ERROR ===");
    console.error("Error details:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    logger.error("Error uploading resource:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload resource" },
      { status: 500 }
    );
  }
}
