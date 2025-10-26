"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function OAuthCallback() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/auth/login");
      return;
    }

    // Persist tokens + user to localStorage so existing code that reads localStorage works
    try {
      const s = session as any;
      if (s.accessToken) localStorage.setItem("accessToken", s.accessToken);
      if (s.refreshToken) localStorage.setItem("refreshToken", s.refreshToken);
      if (session.user) localStorage.setItem("user", JSON.stringify(session.user));
      if ((session.user as any)?.id) localStorage.setItem("userId", (session.user as any).id);
    } catch (err) {
      console.warn("oauth-callback: failed to persist tokens", err);
    }

    // Redirect to the place you want after login (adjust as needed)
    router.replace("/student_page/dashboard");
  }, [session, status, router]);

  return null;
}