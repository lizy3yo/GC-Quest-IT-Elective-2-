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
    }).select("name subject courseYear").lean();

    const studentClasses = await Class.find({
      students: {
        $elemMatch: {
          studentId: user._id.toString(),
          status: "active",
        },
      },
      isActive: true,
    }).select("name subject courseYear").lean();

    // Combine classes with role information
    const classes = [
      ...teacherClasses.map(c => ({ ...c, role: "teacher" as const })),
      ...studentClasses.map(c => ({ ...c, role: "student" as const })),
    ];

    return NextResponse.json({ classes });
  } catch (error) {
    console.error("Error fetching user classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch user classes" },
      { status: 500 }
    );
  }
}
