import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import { logger } from "@/lib/winston";
import { cache } from "@/lib/cache";

/**
 * PUT /api/student_page/resources/[id]
 * Edit a resource (only if user uploaded it)
 */
export async function PUT(req: NextRequest, context: any) {
  try {
    const { params } = await context;
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIdStr = user._id.toString();
    await connectToDatabase();

    const resource = await Resource.findById(params.id);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Check if user is the uploader
    if (resource.uploadedBy?.toString() !== userIdStr) {
      return NextResponse.json(
        { error: "You can only edit resources you uploaded" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, description, category, tags } = body;

    // Update only allowed fields
    if (title) resource.title = title;
    if (description) resource.description = description;
    if (category) resource.category = category;
    if (tags) resource.tags = tags;

    await resource.save();

    // Invalidate the user's resources cache
    const cacheKey = `resources:${userIdStr}`;
    cache.delete(cacheKey);

    logger.info("Resource updated", {
      resourceId: params.id,
      title: resource.title,
      updatedBy: userIdStr,
    });

    const resourceObj = resource.toObject();
    return NextResponse.json({ 
      message: "Resource updated successfully",
      resource: {
        ...resourceObj,
        _id: (resourceObj._id as any).toString(),
        bookmarkedBy: resource.bookmarkedBy?.map((id: any) => id?.toString()) || [],
        uploadedBy: resource.uploadedBy?.toString() || null,
        classId: resource.classId?.toString() || null,
      }
    });
  } catch (error: any) {
    logger.error("Error updating resource:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update resource" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/student_page/resources/[id]
 * Delete a resource (only if user uploaded it)
 */
export async function DELETE(req: NextRequest, context: any) {
  try {
    const { params } = await context;
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIdStr = user._id.toString();
    await connectToDatabase();

    const resource = await Resource.findById(params.id);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Check if user is the uploader or discoverer
    if (resource.uploadedBy?.toString() !== userIdStr) {
      return NextResponse.json(
        { error: "You can only delete resources you uploaded or discovered" },
        { status: 403 }
      );
    }

    // Delete the resource
    await Resource.findByIdAndDelete(params.id);

    // Invalidate the user's resources cache
    const cacheKey = `resources:${userIdStr}`;
    cache.delete(cacheKey);

    logger.info("Resource deleted", {
      resourceId: params.id,
      title: resource.title,
      deletedBy: userIdStr,
    });

    return NextResponse.json({ message: "Resource deleted successfully" });
  } catch (error: any) {
    logger.error("Error deleting resource:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete resource" },
      { status: 500 }
    );
  }
}
