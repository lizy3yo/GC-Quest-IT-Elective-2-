import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { connectToDatabase } from "@/lib/mongoose";
import User from "@/models/user";
import { verifyAccessToken } from "@/lib/jwt";

/**
 * Get authenticated user from either NextAuth session or JWT token
 * Supports both Google OAuth (NextAuth) and manual authentication (JWT)
 */
export async function getAuthenticatedUser(req: NextRequest) {
  // Try NextAuth session first
  const session = await auth();
  if (session?.user?.email) {
    await connectToDatabase();
    const user = await User.findOne({ email: session.user.email });
    return user;
  }

  // Try JWT token from Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyAccessToken(token) as { userId: string };
      await connectToDatabase();
      const user = await User.findById(decoded.userId);
      return user;
    } catch (error) {
      console.error("JWT verification failed:", error);
      return null;
    }
  }

  return null;
}
