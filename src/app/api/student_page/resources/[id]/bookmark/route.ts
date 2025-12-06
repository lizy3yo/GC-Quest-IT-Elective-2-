import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import { logger } from "@/lib/winston";
import { cache } from "@/lib/cache";

export async function POST(req: NextRequest, context: any) {
  try {
    const { params } = await context;
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resource = await Resource.findById(params.id);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const userIdStr = user._id.toString();
    const isBookmarked = resource.bookmarkedBy.some(
      (id: any) => id?.toString() === userIdStr
    );

    if (isBookmarked) {
      // Remove bookmark
      resource.bookmarkedBy = resource.bookmarkedBy.filter(
        (id: any) => id?.toString() !== userIdStr
      );
    } else {
      // Add bookmark
      resource.bookmarkedBy.push(user._id);
    }

    await resource.save();

    // Invalidate the user's resources cache so they see the updated bookmark status
    const cacheKey = `resources:${userIdStr}`;
    cache.delete(cacheKey);

    logger.info("Resource bookmark toggled", {
      resourceId: params.id,
      userId: userIdStr,
      bookmarked: !isBookmarked,
    });

    return NextResponse.json({
      bookmarked: !isBookmarked,
      message: isBookmarked ? "Bookmark removed" : "Bookmark added",
    });
  } catch (error: any) {
    logger.error("Error bookmarking resource:", error);
    return NextResponse.json(
      { error: "Failed to bookmark resource" },
      { status: 500 }
    );
  }
}
