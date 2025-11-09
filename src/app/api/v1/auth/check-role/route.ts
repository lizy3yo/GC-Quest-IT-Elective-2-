import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongoose";
import User from "@/models/user";
import { validateEmail } from "@/lib/middleware/validation";
import { logger } from "@/lib/winston";

function normalizeRole(role?: string) {
  if (!role) return role;
  if (role === "teacher") return "instructor";
  return role;
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json().catch(() => ({}));
    const { email, role } = body as { email?: string; role?: string };

    if (!email) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: "Email is required" },
        { status: 400 }
      );
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", message: emailError.message },
        { status: 400 }
      );
    }

    // ensure we have a single document and give it a narrow type so TS knows `role` exists
    let found = await User.findOne({ email }).select("role email").lean().exec();
    // guard: sometimes typing/inference produces an array shape — normalize to single doc or null
    if (Array.isArray(found)) {
      found = found.length > 0 ? found[0] : null;
    }
    const user = found as { role?: string; email?: string } | null;

    if (!user) {
      // no existing user with that email → no conflict
      return NextResponse.json({ conflict: false });
    }

    const existingRole = normalizeRole(user.role);
    const requestedRole = normalizeRole(role);

    const conflict = !!(existingRole && requestedRole && existingRole !== requestedRole);

    return NextResponse.json({
      conflict,
      existingRole: existingRole || user.role,
    });
  } catch (err) {
    logger.error("Error in /api/v1/auth/check-role:", err);
    return NextResponse.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred while checking role",
      },
      { status: 500 }
    );
  }
}