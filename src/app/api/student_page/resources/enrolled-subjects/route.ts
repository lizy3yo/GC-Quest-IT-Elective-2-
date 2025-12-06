import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { connectToDatabase } from "@/lib/mongoose";
import Class from "@/models/class";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // Get classes where user is either teacher or student
    const teacherClasses = await Class.find({
      teacherId: user._id.toString(),
      isActive: true,
    }).select("subject").lean();

    const studentClasses = await Class.find({
      students: {
        $elemMatch: {
          studentId: user._id.toString(),
          status: "active",
        },
      },
      isActive: true,
    }).select("subject").lean();

    // Combine and get unique subjects
    const allClasses = [...teacherClasses, ...studentClasses];
    const subjects = Array.from(new Set(allClasses.map(c => c.subject).filter(Boolean)));

    return NextResponse.json({ subjects });
  } catch (error) {
    console.error("Error fetching enrolled subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrolled subjects" },
      { status: 500 }
    );
  }
}
