import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import Resource from "@/models/resource";

export async function POST(req: NextRequest, context: any) {
  const { params } = await context;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await req.json();
    const { action } = body;

    if (!action || !["download", "view"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const resource = await Resource.findById(params.id);
    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    if (action === "download") {
      resource.downloads += 1;
    } else if (action === "view") {
      resource.views += 1;
    }

    await resource.save();

    return NextResponse.json({ message: "Tracked successfully" });
  } catch (error: any) {
    console.error("Error tracking resource action:", error);
    return NextResponse.json(
      { error: "Failed to track action" },
      { status: 500 }
    );
  }
}
