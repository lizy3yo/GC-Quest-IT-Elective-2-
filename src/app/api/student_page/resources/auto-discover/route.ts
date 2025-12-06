import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import User from "@/models/user";
import Class from "@/models/class";
import { generateResourcesForMultipleSubjects } from "@/lib/ai/resource-discovery";
import { logger } from "@/lib/winston";
import { cache } from "@/lib/cache";

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

    // Get all classes the student is enrolled in (matching student_class API structure)
    const classes = await Class.find({
      students: {
        $elemMatch: {
          studentId: user._id.toString(),
          status: 'active'
        }
      },
      isActive: true
    }).select("subject");

    if (classes.length === 0) {
      return NextResponse.json({
        message: "No classes found. Resources will be discovered from general subjects.",
        resources: [],
      });
    }

    // Extract unique subjects
    const subjects = Array.from(new Set(classes.map(c => c.subject).filter(Boolean)));

    if (subjects.length === 0) {
      return NextResponse.json({
        message: "No subjects found in your classes",
        resources: [],
      });
    }

    // Discover resources for all subjects
    const discoveredResources = await generateResourcesForMultipleSubjects(subjects);

    logger.info('Auto-discovered resources', {
      subjects,
      totalResources: discoveredResources.length,
      withThumbnails: discoveredResources.filter(r => r.thumbnailUrl).length
    });

    if (discoveredResources.length === 0) {
      return NextResponse.json({
        message: "No accessible resources found. The AI may have generated invalid URLs. Please try again.",
        subjects,
        count: 0,
        resources: [],
      });
    }

    // Save to database
    const savedResources = [];
    for (const resource of discoveredResources) {
      try {
        const existing = await Resource.findOne({ url: resource.url });
        
        if (!existing) {
          logger.info('Auto-creating resource', {
            title: resource.title,
            hasThumbnail: !!resource.thumbnailUrl,
            thumbnailUrl: resource.thumbnailUrl
          });

          const newResource = await Resource.create({
            ...resource,
            isVerified: true,
            downloads: 0,
            views: 0,
            bookmarkedBy: [],
          });
          savedResources.push(newResource);
        } else {
          savedResources.push(existing);
        }
      } catch (error) {
        logger.error("Error saving auto-discovered resource:", error);
      }
    }

    // Invalidate the user's resources cache
    const cacheKey = `resources:${user._id.toString()}`;
    cache.delete(cacheKey);

    // Serialize ObjectIds for frontend compatibility
    const serializedResources = savedResources.map(resource => {
      const obj = resource.toObject ? resource.toObject() : resource;
      return {
        ...obj,
        _id: obj._id?.toString(),
        bookmarkedBy: obj.bookmarkedBy?.map((id: any) => id?.toString()) || [],
        uploadedBy: obj.uploadedBy?.toString() || null,
        classId: obj.classId?.toString() || null,
      };
    });

    return NextResponse.json({
      message: `Discovered resources for ${subjects.length} subjects`,
      subjects,
      count: serializedResources.length,
      resources: serializedResources,
    });
  } catch (error: any) {
    logger.error("Error auto-discovering resources:", error);
    return NextResponse.json(
      { error: error.message || "Failed to auto-discover resources" },
      { status: 500 }
    );
  }
}
