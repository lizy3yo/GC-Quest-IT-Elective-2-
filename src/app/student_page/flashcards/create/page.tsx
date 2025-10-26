"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This route now simply redirects to the first step of the manual creation wizard (Set Information)
export default function CreateFlashcardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student_page/flashcards/create/set");
  }, [router]);

  return null;
}