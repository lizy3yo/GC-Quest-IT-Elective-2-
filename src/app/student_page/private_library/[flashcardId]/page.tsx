"use client";

import React, { useEffect, useState } from "react";
import {
  useRouter,
  useParams,
  useSearchParams,
  usePathname,
} from "next/navigation";
import api from "@/lib/api";
import {
  Share2,
  Settings,
  FileStack,
  Lightbulb,
  ArrowLeftRight,
  NotebookPen,
  RotateCcw,
  MoreHorizontal,
  Star,
  Edit2,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import LoadingTemplate2 from "@/components/atoms/loading_template_2/loading2"; // added import
import PrimaryActionButton from "@/components/atoms/buttons/PrimaryActionButton";
import { Chip } from "@/components/atoms/Chip";

type FlashcardCard = {
  _id: string;
  question: string;
  answer: string;
  image?: string;
};

type SharedUser = {
  user?: string;
  email?: string;
  role: "viewer" | "editor";
  addedAt?: string;
  status?: "pending" | "accepted";
};

type Flashcard = {
  _id: string;
  title: string;
  description?: string;
  cards: FlashcardCard[];
  tags?: string[];
  image?: string;
  difficulty?: "easy" | "medium" | "hard";
  accessType: "private" | "public";
  sharingMode?: "restricted" | "anyone_with_link";
  password?: string;
  linkRole?: "viewer" | "editor";
  publicRole?: "viewer" | "editor";
  sharedUsers?: SharedUser[];
  shareableLink?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function FlashcardDetailPage() {
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState<boolean>(false);
  const [showSharingModal, setShowSharingModal] = useState<boolean>(false);
  const [viewerIndex, setViewerIndex] = useState<number>(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState<boolean>(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [trackProgress, setTrackProgress] = useState<boolean>(false);
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const flashcardId = params.flashcardId as string;

  // Color-coded icon classes for each tab
  const tabIconColor = (label: string, isActive: boolean) => {
    const dim = isActive ? "" : " opacity-80";
    switch (label) {
      case "Flashcards":
        return `text-sky-600 dark:text-sky-400${dim}`;
      case "Learn":
        return `text-violet-600 dark:text-violet-400${dim}`;
      case "Match":
        return `text-emerald-600 dark:text-emerald-400${dim}`;
      case "Test":
        return `text-cyan-600 dark:text-cyan-400${dim}`;
      default:
        return dim.trim();
    }
  };

  useEffect(() => {
    const openShare = searchParams?.get("openShare");
    if (openShare) setShowSharingModal(true);
  }, [searchParams]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openMenuCardId && !target.closest("[data-menu-container]")) {
        setOpenMenuCardId(null);
      }
    };

    if (openMenuCardId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuCardId]);

  // Form state for editing flashcard
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    tags: [] as string[],
    difficulty: "easy" as "easy" | "medium" | "hard",
    accessType: "private" as "private" | "public",
    sharingMode: undefined as "restricted" | "anyone_with_link" | undefined,
    password: "",
    linkRole: "viewer" as "viewer" | "editor",
    publicRole: "viewer" as "viewer" | "editor",
  });

  // Form state for editing/adding cards
  const [cardForm, setCardForm] = useState({
    question: "",
    answer: "",
    image: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadFlashcard() {
      setIsLoading(true);
      setError(null);
      try {
        // Get current user
        const current = await api.get(`/users/current`);
        const uid = (current as { user?: { _id?: string } } | null)?.user?._id;
        if (!uid) throw new Error("Unable to determine current user.");
        if (!isMounted) return;
        setUserId(uid);

        // Fetch the specific flashcard
        const res = await fetch(
          `/api/student_page/flashcard/${flashcardId}?userId=${uid}`,
          {
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          const maybe: unknown = await res.json().catch(() => null);
          const message =
            maybe &&
            typeof maybe === "object" &&
            "message" in maybe &&
            typeof (maybe as { message?: unknown }).message === "string"
              ? String((maybe as { message?: unknown }).message)
              : `Failed to load flashcard (${res.status})`;
          throw new Error(message);
        }

        const data = (await res.json()) as { flashcard: Flashcard };
        if (!isMounted) return;

        setFlashcard(data.flashcard);
        setEditForm({
          title: data.flashcard.title,
          description: data.flashcard.description || "",
          tags: data.flashcard.tags || [],
          difficulty: data.flashcard.difficulty || "easy",
          accessType: data.flashcard.accessType || "private",
          sharingMode: data.flashcard.sharingMode,
          password: "",
          linkRole: data.flashcard.linkRole || "viewer",
          publicRole: data.flashcard.publicRole || "viewer",
        });
      } catch (e: unknown) {
        if (!isMounted) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Something went wrong loading the flashcard.";
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (flashcardId) {
      loadFlashcard();
    }

    return () => {
      isMounted = false;
    };
  }, [flashcardId]);

  const currentCard =
    flashcard?.cards?.[
      Math.min(viewerIndex, Math.max((flashcard?.cards?.length || 1) - 1, 0))
    ];
  const goPrev = () => {
    setViewerIndex((i) => Math.max(i - 1, 0));
    setIsShowingAnswer(false);
  };
  const goNext = () => {
    setViewerIndex((i) =>
      Math.min(i + 1, Math.max((flashcard?.cards?.length || 1) - 1, 0))
    );
    setIsShowingAnswer(false);
  };
  const toggleStar = (id?: string) => {
    if (!id) return;
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = async () => {
    if (!flashcard || !userId) return;

    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}?userId=${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: editForm.title,
            description: editForm.description,
            tags: editForm.tags,
            difficulty: editForm.difficulty,
            cards: flashcard.cards, // Keep existing cards
            accessType: editForm.accessType,
            sharingMode: editForm.sharingMode,
            password: editForm.password || undefined,
            linkRole: editForm.linkRole,
            publicRole: editForm.publicRole,
          }),
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to update flashcard (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { flashcard: Flashcard };
      setFlashcard(data.flashcard);
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update flashcard.");
    }
  };

  const handleDelete = async () => {
    if (!flashcard || !userId) return;

    if (
      !confirm(
        "Are you sure you want to delete this flashcard? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}?userId=${userId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to delete flashcard (${res.status})`;
        throw new Error(message);
      }

      // Redirect back to private library
      router.push("/student_page/private_library");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete flashcard.");
      setIsDeleting(false);
    }
  };

  const handleTagChange = (value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setEditForm((prev) => ({ ...prev, tags }));
  };

  const handleAddCard = async () => {
    if (!flashcard || !userId || !cardForm.question || !cardForm.answer) return;

    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}?userId=${userId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: cardForm.question,
            answer: cardForm.answer,
            image: cardForm.image || undefined,
          }),
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to add card (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { flashcard: Flashcard };
      setFlashcard(data.flashcard);
      setCardForm({ question: "", answer: "", image: "" });
      setIsAddingCard(false);
      setEditingCardId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add card.");
    }
  };

  const handleEditCard = async (cardId: string) => {
    if (!flashcard || !userId || !cardForm.question || !cardForm.answer) return;

    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}/card/${cardId}?userId=${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: cardForm.question,
            answer: cardForm.answer,
            image: cardForm.image || undefined,
          }),
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to update card (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { flashcard: Flashcard };
      setFlashcard(data.flashcard);
      setCardForm({ question: "", answer: "", image: "" });
      setEditingCardId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update card.");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!flashcard || !userId) return;

    if (!confirm("Are you sure you want to delete this card?")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}/card/${cardId}?userId=${userId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to delete card (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { flashcard: Flashcard };
      setFlashcard(data.flashcard);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete card.");
    }
  };

  const startEditingCard = (card: FlashcardCard) => {
    setCardForm({
      question: card.question,
      answer: card.answer,
      image: card.image || "",
    });
    setEditingCardId(card._id);
    setIsAddingCard(false);
  };

  const startAddingCard = () => {
    setCardForm({ question: "", answer: "", image: "" });
    setIsAddingCard(true);
    setEditingCardId(null);
  };

  const cancelCardEdit = () => {
    setCardForm({ question: "", answer: "", image: "" });
    setIsAddingCard(false);
    setEditingCardId(null);
  };

  const generateShareableLink = () => {
    if (!flashcard) return;

    // Generate a unique link (in a real app, this would be a proper UUID)
    const linkId =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Update the flashcard with the shareable link
    handleUpdateShareableLink(linkId);
  };

  const handleUpdateShareableLink = async (linkId: string) => {
    if (!flashcard || !userId) return;

    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}?userId=${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...editForm,
            cards: flashcard.cards,
            shareableLink: linkId,
          }),
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to update shareable link (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { flashcard: Flashcard };
      setFlashcard(data.flashcard);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to generate shareable link."
      );
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // You could add a toast notification here
        alert("Link copied to clipboard!");
      })
      .catch(() => {
        alert("Failed to copy link");
      });
  };

  // (Add shared user flow removed – no UI hook currently uses it)

  const removeSharedUser = async (index: number) => {
    if (!flashcard || !userId) return;

    const updatedSharedUsers =
      flashcard.sharedUsers?.filter((_, i) => i !== index) || [];

    try {
      const res = await fetch(
        `/api/student_page/flashcard/${flashcardId}?userId=${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...editForm,
            cards: flashcard.cards,
            sharedUsers: updatedSharedUsers,
          }),
        }
      );

      if (!res.ok) {
        const maybe: unknown = await res.json().catch(() => null);
        const message =
          maybe &&
          typeof maybe === "object" &&
          "message" in maybe &&
          typeof (maybe as { message?: unknown }).message === "string"
            ? String((maybe as { message?: unknown }).message)
            : `Failed to remove shared user (${res.status})`;
        throw new Error(message);
      }

      const data = (await res.json()) as { flashcard: Flashcard };
      setFlashcard(data.flashcard);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to remove shared user."
      );
    }
  };

  // Cancel edit set and revert form values to currently loaded flashcard
  const cancelEditSet = () => {
    if (flashcard) {
      setEditForm({
        title: flashcard.title,
        description: flashcard.description || "",
        tags: flashcard.tags || [],
        difficulty: flashcard.difficulty || "easy",
        accessType: flashcard.accessType || "private",
        sharingMode: flashcard.sharingMode,
        password: "",
        linkRole: flashcard.linkRole || "viewer",
        publicRole: flashcard.publicRole || "viewer",
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <LoadingTemplate2
        title="Loading flashcard"
        subtitle="Fetching flashcard data…"
        compact={false}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="text-red-600 dark:text-red-400">{error}</div>
          <button
            onClick={() => router.push("/student_page/private_library")}
            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  if (!flashcard) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="text-slate-500 dark:text-slate-400">
            Flashcard not found
          </div>
          <button
            onClick={() => router.push("/student_page/private_library")}
            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/student_page/private_library")}
              className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#1C2B1C] transition-colors"
              aria-label="Back to Library"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span className="font-medium">Library</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSharingModal(true)}
              aria-label="Share"
              className="p-2 bg-[#1C2B1C] text-white rounded-xl hover:brightness-110 transition-all shadow-sm"
            >
              <Share2 size={18} />
            </button>
            <button
              onClick={() => setIsEditing(true)}
              aria-label="Settings"
              className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:border-[#1C2B1C]/30 hover:text-[#1C2B1C] transition-all shadow-sm"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Title and Description */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {flashcard.title}
          </h1>
          {flashcard.description && (
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              {flashcard.description}
            </p>
          )}
        </div>

        {/* Study Mode Tabs */}
        <nav className="mb-8">
          <div className="flex items-end justify-between">
            <div className="flex gap-6 overflow-x-auto">
              {(() => {
                const base = `/student_page/private_library/${flashcardId}`;
                const tabs = [
                  {
                    label: "Flashcards",
                    href: `${base}/flashcard`,
                    Icon: FileStack,
                  },
                  { label: "Learn", href: `${base}/learn`, Icon: Lightbulb },
                  {
                    label: "Match",
                    href: `${base}/match`,
                    Icon: ArrowLeftRight,
                  },
                  { label: "Test", href: `${base}/test`, Icon: NotebookPen },
                ];
                return tabs.map(({ label, href, Icon }) => {
                  const isActive = pathname?.startsWith(href);
                  return (
                    <button
                      key={label}
                      onClick={() => router.push(href)}
                      className={`relative pb-3 text-sm md:text-base whitespace-nowrap inline-flex items-center gap-2 transition-colors ${
                        isActive
                          ? "text-slate-900 dark:text-slate-100 font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 ${tabIconColor(label, !!isActive)}`}
                      />
                      <span>{label}</span>
                      {label === "Flashcards" && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] leading-none ${
                            isActive
                              ? "bg-violet-600 text-white"
                              : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                          }`}
                        >
                          {flashcard.cards.length}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-gradient-to-r from-violet-500 to-violet-600 rounded-full" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          <div className="mt-2 h-px w-full bg-slate-200 dark:bg-slate-700" />
        </nav>

        {/* Main Content Grid */}
        <div className="max-w-4xl mx-auto">
          {/* Set Preview Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Set Preview
                </h2>
                {flashcard.difficulty && (
                  <Chip variant="badge" className="capitalize">
                    {flashcard.difficulty}
                  </Chip>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {Math.min(viewerIndex + 1, flashcard.cards.length)} /{" "}
                  {flashcard.cards.length}
                </span>
                <button
                  onClick={() => {
                    setViewerIndex(0);
                    setIsShowingAnswer(false);
                  }}
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:border-[#1C2B1C]/30 dark:hover:border-[#8B9D8B]/30 hover:text-[#1C2B1C] dark:hover:text-[#8B9D8B] transition-all"
                  aria-label="Reset Viewer"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Preview Card */}
            <div className="relative mb-6">
              <button
                type="button"
                onClick={() => setIsShowingAnswer((s) => !s)}
                aria-label={isShowingAnswer ? "Show question" : "Show answer"}
                className="w-full h-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] dark:focus:ring-[#8B9D8B] focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <div className="relative h-full overflow-hidden rounded-2xl">
                  {/* Star control inside card at top right - use a non-button element to avoid nested button inside the large clickable card button */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(currentCard?._id);
                    }}
                    onKeyDown={(e) => {
                      // support Enter and Space
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleStar(currentCard?._id);
                      }
                    }}
                    className={`absolute top-4 right-4 z-10 p-2 rounded-lg transition-all cursor-pointer ${
                      starredIds.has(currentCard?._id || "")
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-yellow-500 dark:hover:text-yellow-400"
                    }`}
                    aria-pressed={starredIds.has(currentCard?._id || "")}
                    aria-label={
                      starredIds.has(currentCard?._id || "")
                        ? "Unfavorite"
                        : "Favorite"
                    }
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M11.48 3.499a.75.75 0 011.04.0l2.185 2.22a.75.75 0 00.424.212l3.043.442a.75.75 0 01.416 1.279l-2.203 2.147a.75.75 0 00-.216.663l.52 3.03a.75.75 0 01-1.088.791l-2.724-1.43a.75.75 0 00-.698 0l-2.724 1.43a.75.75 0 01-1.088-.791l.52-3.03a.75.75 0 00-.216-.663L5.412 8.652a.75.75 0 01.416-1.279l3.043-.442a.75.75 0 00.424-.212l2.185-2.22z" />
                    </svg>
                  </div>

                  <div
                    className={`absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-300 ${
                      isShowingAnswer ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl font-medium text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">
                        {currentCard?.question || "No question"}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Click to reveal answer
                      </div>
                    </div>
                  </div>
                  <div
                    className={`absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-300 ${
                      isShowingAnswer ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl font-medium text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">
                        {currentCard?.answer || "No answer"}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Click to show question
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Navigation Controls - Centered */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={goPrev}
                className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-[#1C2B1C]/30 dark:hover:border-[#8B9D8B]/30 hover:bg-[#1C2B1C]/5 dark:hover:bg-[#8B9D8B]/10 transition-all shadow-sm"
              >
                <svg
                  className="w-5 h-5 text-slate-600 dark:text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <PrimaryActionButton
                onClick={() => setIsShowingAnswer((s) => !s)}
              >
                {isShowingAnswer ? "Show Question" : "Show Answer"}
              </PrimaryActionButton>
              <button
                onClick={goNext}
                className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-[#1C2B1C]/30 dark:hover:border-[#8B9D8B]/30 hover:bg-[#1C2B1C]/5 dark:hover:bg-[#8B9D8B]/10 transition-all shadow-sm"
              >
                <svg
                  className="w-5 h-5 text-slate-600 dark:text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              Cards
            </h2>
            <PrimaryActionButton onClick={startAddingCard}>
              + Add Card
            </PrimaryActionButton>
          </div>

          {flashcard.cards.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400 dark:text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                No cards yet
              </h3>
              <p className="text-gray-500 dark:text-slate-400 mb-4">
                Add your first card to get started
              </p>
              <PrimaryActionButton onClick={startAddingCard}>
                Add Your First Card
              </PrimaryActionButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flashcard.cards.map((card, index) => (
                <div
                  key={card._id}
                  className="relative group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:border-[#1C2B1C]/30 dark:hover:border-[#04C40A]/30 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex items-center justify-center">
                      <Chip
                        variant="badge"
                        className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                      >
                        {index + 1}
                      </Chip>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-900 dark:text-slate-100 font-medium mb-2 line-clamp-2">
                        {card.question}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                        {card.answer}
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-4 right-4" data-menu-container>
                    <button
                      onClick={() =>
                        setOpenMenuCardId(
                          openMenuCardId === card._id ? null : card._id
                        )
                      }
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                      aria-label="Card options"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {openMenuCardId === card._id && (
                      <div
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden"
                        data-menu-container
                      >
                        <button
                          onClick={() => {
                            toggleStar(card._id);
                            setOpenMenuCardId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Star
                            size={16}
                            className={
                              starredIds.has(card._id)
                                ? "fill-yellow-400 text-yellow-400"
                                : ""
                            }
                          />
                          <span>
                            {starredIds.has(card._id)
                              ? "Unfavorite"
                              : "Favorite"}
                          </span>
                        </button>
                        <button
                          onClick={() => {
                            startEditingCard(card);
                            setOpenMenuCardId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Edit2 size={16} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteCard(card._id);
                            setOpenMenuCardId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Edit Drawer (modern, right-side) */}
      {(isAddingCard || editingCardId) && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={cancelCardEdit} />
          <div className="w-full sm:w-[520px] bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isAddingCard ? "Add Card" : "Edit Card"}
              </h3>
              <button
                onClick={cancelCardEdit}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Question
                </div>
                <textarea
                  value={cardForm.question}
                  onChange={(e) =>
                    setCardForm((prev) => ({
                      ...prev,
                      question: e.target.value,
                    }))
                  }
                  rows={4}
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="Enter question (can be long, supports formatting)"
                ></textarea>
              </label>

              <label className="block">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Answer
                </div>
                <textarea
                  value={cardForm.answer}
                  onChange={(e) =>
                    setCardForm((prev) => ({ ...prev, answer: e.target.value }))
                  }
                  rows={4}
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="Enter answer"
                ></textarea>
              </label>

              <label className="block">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Image URL (optional)
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={cardForm.image}
                    onChange={(e) =>
                      setCardForm((prev) => ({
                        ...prev,
                        image: e.target.value,
                      }))
                    }
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 p-2 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                  {cardForm.image && (
                    <Image
                      src={cardForm.image}
                      alt="preview"
                      width={80}
                      height={80}
                      className="w-20 h-20 object-cover rounded-md border border-slate-200 dark:border-slate-700"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                      }}
                    />
                  )}
                </div>
              </label>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={cancelCardEdit}
                  className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                {isAddingCard ? (
                  <button
                    onClick={handleAddCard}
                    disabled={!cardForm.question || !cardForm.answer}
                    className="px-4 py-2 rounded-md bg-[#1C2B1C] text-white disabled:opacity-50"
                  >
                    Add Card
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      editingCardId && handleEditCard(editingCardId)
                    }
                    disabled={!cardForm.question || !cardForm.answer}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Set Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cancelEditSet}
          />
          <div className="relative z-50 max-w-3xl w-full mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Flashcard Set Settings
                </h2>
                <button
                  onClick={cancelEditSet}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Title
                  </div>
                  <input
                    value={editForm.title}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Description
                  </div>
                  <textarea
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Tags (comma separated)
                  </div>
                  <input
                    value={editForm.tags.join(", ")}
                    onChange={(e) => handleTagChange(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1 dark:text-slate-100">
                      Difficulty
                    </label>
                    <select
                      value={editForm.difficulty}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          difficulty: e.target.value as
                            | "easy"
                            | "medium"
                            | "hard",
                        }))
                      }
                      className="w-full p-2 rounded-md bg-slate-50 dark:text-slate-100 dark:bg-slate-800"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1 dark:text-slate-100">
                      Access
                    </label>
                    <select
                      value={editForm.accessType}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          accessType: e.target.value as "private" | "public",
                        }))
                      }
                      className="w-full p-2 rounded-md dark:text-slate-100 bg-slate-50 dark:bg-slate-800"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1 dark:text-slate-100">
                      Sharing Mode
                    </label>
                    <select
                      value={editForm.sharingMode ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || undefined;
                        setEditForm((prev) => ({
                          ...prev,
                          sharingMode: val as
                            | "restricted"
                            | "anyone_with_link"
                            | undefined,
                        }));
                      }}
                      className="w-full p-2 rounded-md bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">None</option>
                      <option value="restricted">Restricted</option>
                      <option value="anyone_with_link">Anyone with link</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1 dark:text-slate-100">
                      Password (optional)
                    </label>
                    <input
                      value={editForm.password}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className="w-full p-2 rounded-md bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <input
                    type="checkbox"
                    checked={trackProgress}
                    onChange={() => setTrackProgress((v) => !v)}
                    className="w-4 h-4 text-[#1C2B1C] bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded focus:ring-[#1C2B1C] focus:ring-2"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    Enable progress tracking
                  </span>
                </label>

                {/* Collaborators Section */}
                {flashcard.sharedUsers && flashcard.sharedUsers.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                      Collaborators
                    </h3>
                    <div className="space-y-2">
                      {flashcard.sharedUsers.map((u, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                              {u.email}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                              {u.role} • {u.status}
                            </div>
                          </div>
                          <button
                            onClick={() => removeSharedUser(i)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {isDeleting ? "Deleting..." : "Delete Flashcard Set"}
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelEditSet}
                      className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        await handleEdit();
                      }}
                      disabled={!editForm.title.trim()}
                      className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sharing Modal (kept but styled) */}
      {showSharingModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSharingModal(false)}
          />
          <div className="relative z-50 max-w-3xl w-full mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Share &quot;{flashcard.title}&quot;
                </h2>
                <button
                  onClick={() => setShowSharingModal(false)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              {/* (Re-using existing share UI with modern spacing) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm mb-1">Access</label>
                  <select
                    value={editForm.accessType}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        accessType: e.target.value as "private" | "public",
                      }))
                    }
                    className="w-full p-2 rounded-md bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1">Sharing Mode</label>
                  <select
                    value={editForm.sharingMode || ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        sharingMode: e.target.value as
                          | "restricted"
                          | "anyone_with_link"
                          | undefined,
                      }))
                    }
                    className="w-full p-2 rounded-md bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">None</option>
                    <option value="restricted">Restricted</option>
                    <option value="anyone_with_link">Anyone with link</option>
                  </select>
                </div>
              </div>

              {/* Link option */}
              {editForm.accessType === "public" &&
                editForm.sharingMode === "anyone_with_link" && (
                  <div className="mt-4">
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={
                          flashcard?.shareableLink
                            ? `${window.location.origin}/student_page/public_library/${flashcardId}?token=${flashcard.shareableLink}`
                            : "No link generated"
                        }
                        className="flex-1 p-2 rounded-md bg-slate-50 dark:bg-slate-800"
                      />
                      <button
                        onClick={() => {
                          if (flashcard?.shareableLink)
                            copyToClipboard(
                              `${window.location.origin}/student_page/public_library/${flashcardId}?token=${flashcard.shareableLink}`
                            );
                          else generateShareableLink();
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md"
                      >
                        {flashcard?.shareableLink ? "Copy" : "Generate"}
                      </button>
                    </div>
                  </div>
                )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSharingModal(false)}
                  className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleEdit();
                    setShowSharingModal(false);
                  }}
                  className="px-4 py-2 rounded-md bg-indigo-600 text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
