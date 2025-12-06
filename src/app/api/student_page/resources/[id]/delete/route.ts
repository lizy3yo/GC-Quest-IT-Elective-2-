import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";
import { logger } from "@/lib/winston";

/**
 * DELETE /api/student_page/resources/[id]/delete
 * Delete a resource (only if user uploaded it)
 */
export async function DELETE(req: NextRequest, context: any) {
  const { params } = await context;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const resource = await Resource.findById(params.id);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Check if user is the uploader
    if (resource.uploadedBy?.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "You can only delete resources you uploaded" },
        { status: 403 }
      );
    }

    // Delete the resource
    await Resource.findByIdAndDelete(params.id);

    logger.info("Resource deleted", {
      resourceId: params.id,
      title: resource.title,
      deletedBy: session.user.id,
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
