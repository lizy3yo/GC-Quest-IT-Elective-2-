"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryActionButton from "@/components/ui/buttons/PrimaryActionButton";

interface CardItem {
  question: string;
  answer: string;
}

export default function FlashcardsCreateCardsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Step 1 values (read-only here)
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Step 2 (cards)
  const [cards, setCards] = useState<CardItem[]>([
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);

  useEffect(() => {
    // Ensure step 1 exists
    try {
      const raw = localStorage.getItem("flashcards:create:draft");
      if (!raw) {
        router.replace("/student_page/flashcards/create/set");
        return;
      }
      const data = JSON.parse(raw);
      if (!data?.title) {
        router.replace("/student_page/flashcards/create/set");
        return;
      }
      setTitle(data.title || "");
      setDescription(data.description || "");
      setCategory(data.category || "");
      setIsPublic(!!data.isPublic);

      if (Array.isArray(data.cards) && data.cards.length >= 2) {
        setCards(
          data.cards.map((c: Partial<CardItem>) => ({
            question: (c && typeof c.question === "string" ? c.question : "") || "",
            answer: (c && typeof c.answer === "string" ? c.answer : "") || "",
          }))
        );
      }
    } catch {
      router.replace("/student_page/flashcards/create/set");
    }
  }, [router]);

  useEffect(() => {
    // Keep draft updated with cards
    try {
      const raw = localStorage.getItem("flashcards:create:draft");
      const base = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        "flashcards:create:draft",
        JSON.stringify({ ...base, cards })
      );
    } catch {}
  }, [cards]);

  const addCard = () => setCards((prev) => [...prev, { question: "", answer: "" }]);
  const removeCard = (i: number) => {
    setCards((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));
  };
  const updateCard = (i: number, field: "question" | "answer", value: string) => {
    setCards((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const validCards = useMemo(
    () => cards.filter((c) => c.question.trim() && c.answer.trim()),
    [cards]
  );

  const handleCreate = async () => {
    if (!title.trim()) {
      router.replace("/student_page/flashcards/create/set");
      return;
    }
    if (validCards.length < 2) return;

    setLoading(true);
    try {
      const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      if (!userId || !token) throw new Error("You are not authenticated. Please login again.");

      const normalizedDescription = (description || "").trim();
      const payload = {
        title: title.trim(),
        description: normalizedDescription.length ? normalizedDescription : undefined,
        cards: validCards.map((c) => ({ question: c.question.trim(), answer: c.answer.trim() })),
        accessType: isPublic ? "public" : "private",
        tags: [...(category ? [category] : [])],
      };

      const res = await fetch(`/api/student_page/flashcard?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed to create flashcard set (status ${res.status})`);
      }

      // clear draft after successful creation
      try { localStorage.removeItem("flashcards:create:draft"); } catch {}

      router.push(isPublic ? "/student_page/public_library" : "/student_page/private_library");
    } catch (e) {
      console.error(e);
      alert("Failed to create deck. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <button
              onClick={() => router.push("/student_page/flashcards/create/set")}
              className="mr-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Flashcards • Cards</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">Step 2 of 2 · Add your terms and definitions</p>

          <div className="mt-4 text-slate-500 dark:text-slate-400 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Set:</span> {title}
            {category ? <span className="ml-2">• {category}</span> : null}
            {isPublic ? <span className="ml-2">• Public</span> : <span className="ml-2">• Private</span>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cards ({cards.length})</h2>
            <button
              type="button"
              onClick={addCard}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Card</span>
            </button>
          </div>

          <div className="space-y-6">
            {cards.map((card, index) => (
              <div key={index} className="border border-slate-200 dark:border-slate-600 rounded-lg p-6 bg-slate-50 dark:bg-slate-700/50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Card {index + 1}</span>
                  {cards.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeCard(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Term</label>
                    <textarea
                      value={card.question}
                      onChange={(e) => updateCard(index, "question", e.target.value)}
                      className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter term"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Definition</label>
                    <textarea
                      value={card.answer}
                      onChange={(e) => updateCard(index, "answer", e.target.value)}
                      className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter definition"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center mt-8">
          <button
            type="button"
            onClick={() => router.push("/student_page/flashcards/create/set")}
            className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Back
          </button>
          <PrimaryActionButton onClick={handleCreate} disabled={loading || validCards.length < 2}>
            {loading ? "Creating..." : `Create ${isPublic ? "Public" : "Private"} Set`}
          </PrimaryActionButton>
        </div>
    </div>
  );
}
