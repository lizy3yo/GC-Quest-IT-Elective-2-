import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";

/**
 * DEBUG ENDPOINT - Delete all resources
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Delete ALL resources
    const result = await Resource.deleteMany({});

    console.log("=== DELETED ALL RESOURCES ===");
    console.log("Total resources deleted:", result.deletedCount);

    return NextResponse.json({
      message: "All resources deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error: any) {
    console.error("Error deleting all resources:", error);
    return NextResponse.json(
      { error: "Failed to delete resources" },
      { status: 500 }
    );
  }
}

/**
 * DEBUG ENDPOINT - Get all resources without filters
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get ALL resources to debug
    const allResources = await Resource.find({})
      .sort({ createdAt: -1 })
      .lean();

    console.log("=== DEBUG ALL RESOURCES ===");
    console.log("Total resources in DB:", allResources.length);
    allResources.forEach((r, i) => {
      console.log(`Resource ${i + 1}:`, {
        title: r.title,
        url: r.url,
        classId: r.classId,
        isVerified: r.isVerified,
        uploadedBy: r.uploadedBy,
      });
    });

    return NextResponse.json({
      total: allResources.length,
      resources: allResources.map(r => ({
        _id: r._id,
        title: r.title,
        url: r.url,
        subject: r.subject,
        classId: r.classId,
        isVerified: r.isVerified,
        uploadedBy: r.uploadedBy,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching debug resources:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}
