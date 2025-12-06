import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import User from "@/models/user";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    let students;

    if (query.length === 0) {
      // Return suggested users (recent or random students)
      students = await User.find({
        role: "student",
        email: { $ne: user.email }, // Exclude current user
      })
        .select("firstName lastName email")
        .limit(10)
        .lean();
    } else if (query.length < 2) {
      return NextResponse.json({ students: [] });
    } else {
      // Search for students by name or email
      students = await User.find({
        role: "student",
        email: { $ne: user.email }, // Exclude current user
        $or: [
          { firstName: { $regex: query, $options: "i" } },
          { lastName: { $regex: query, $options: "i" } },
          { email: { $regex: query, $options: "i" } },
        ],
      })
        .select("firstName lastName email")
        .limit(10)
        .lean();
    }

    return NextResponse.json({ students });
  } catch (error: unknown) {
    console.error("Error searching students:", error);
    return NextResponse.json(
      { error: "Failed to search students" },
      { status: 500 }
    );
  }
}
