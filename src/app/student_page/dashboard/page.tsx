"use client";

import { useDashboard } from "@/hooks/useDashboard";
import LoadingTemplate2 from "@/components/atoms/loading_template_2/loading2";
import Greeting from "@/components/molecules/Greeting";
import SummaryMetrics from "@/components/organisms/SummaryMetrics";
import Charts from "@/components/organisms/Charts";
import NextDue from "@/components/organisms/NextDue";
import QuickActions from "@/components/organisms/QuickActions";
import MyFlashcardSets from "@/components/organisms/MyFlashcardSets";
import { useRef, useState } from "react";
import useAuth from "@/hooks/useAuth";
import { useSession } from "next-auth/react";

const getDeckImage = (title: string): string => {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("computer") && titleLower.includes("servicing")) {
    return "/flashcards_image/computersystemservicing.jpg";
  }
  if (titleLower.includes("networking")) {
    return "/flashcards_image/networking.png";
  }
  if (
    titleLower.includes("data structure") ||
    titleLower.includes("algorithm")
  ) {
    return "/flashcards_image/datastructure.jpg";
  }
  if (titleLower.includes("web development")) {
    return "/flashcards_image/Web-Development.jpg";
  }
  if (titleLower.includes("database")) {
    return "/flashcards_image/database.jpg";
  }
  if (titleLower.includes("software engineering")) {
    return "/flashcards_image/software_eng.jpeg";
  }

  return "/flashcards_image/datastructure.jpg";
};

export default function UserDashboard() {
  const { data, isLoading, isError } = useDashboard();
  const decksScrollerRef = useRef<HTMLDivElement | null>(null);
  const [deckFilter, setDeckFilter] = useState<
    "All" | "On-Going" | "Completed"
  >("All");
  const { user, isLoading: authLoading } = useAuth();
  const { data: session } = useSession();

  const scrollDecks = (dir: "left" | "right") => {
    const el = decksScrollerRef.current;
    if (!el) return;
    const amount = Math.min(
      600,
      Math.max(320, Math.floor(el.clientWidth * 0.9))
    );
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = decksScrollerRef.current;
    if (!el) return;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = decksScrollerRef.current;
    if (!el) return;
    if (e.buttons !== 1) return;
    el.scrollLeft -= e.movementX;
  };

  const handleMouseUpOrLeave = () => {
    const el = decksScrollerRef.current;
    if (!el) return;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  };

  if (authLoading) return <LoadingTemplate2 title="Loading your dashboard..." />;
  if (isLoading) return <LoadingTemplate2 title="Loading your dashboard..." />;
  if (isError) return <div>Error loading dashboard data.</div>;
  if (!data) return <div>No dashboard data available.</div>;

  const {
    summary,
    studyDecks,
    subjectBreakdown,
    assessmentsBySubject,
    assessmentsByType,
    upcomingByDay,
    dueItems,
  } = data;

  const nextDueItems = [...dueItems].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  const resumeAssignment = nextDueItems[0];

  const getUrgency = (iso: string) => {
    const due = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = due - now;
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin <= 60) {
      return {
        level: "critical" as const,
        label: diffMin <= 0 ? "Due now" : `Due in ${diffMin}m`,
        isUrgent: true,
      };
    }
    if (diffHours <= 3) {
      return {
        level: "soon" as const,
        label: `Due in ${diffHours}h`,
        isUrgent: true,
      };
    }
    return {
      level: "normal" as const,
      label: new Date(iso).toLocaleString(),
      isUrgent: false,
    };
  };

  const fromAuth =
    (user?.firstName?.trim?.() ? user.firstName!.trim() : null) ||
    (user?.name?.trim?.() ? user.name!.trim().split(" ")[0] : null) ||
    (user?.username?.trim?.() ? user.username!.trim() : null);

  const sessionName =
    typeof session?.user?.name === "string"
      ? session.user.name
      : null;
  const fromSession =
    sessionName && sessionName.trim()
      ? sessionName.trim().split(" ")[0]
      : null;

  let fromLocal: string | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        fromLocal =
          (parsed?.firstName && String(parsed.firstName).trim()) ||
          (parsed?.name &&
            String(parsed.name).trim().split(" ")[0]) ||
          (parsed?.username && String(parsed.username).trim()) ||
          null;
      }
    } catch {
    }
  }

  const firstName = fromAuth || fromSession || fromLocal || "Student";

  const filteredDecks = studyDecks.filter((deck) => {
    if (deckFilter === "All") return true;
    if (deckFilter === "On-Going") return deck.progress < 100;
    if (deckFilter === "Completed") return deck.progress === 100;
    return true;
  });

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        <Greeting firstName={firstName} />
        <SummaryMetrics summary={summary} />
        <Charts
          upcomingByDay={upcomingByDay}
          assessmentsByType={assessmentsByType}
          assessmentsBySubject={assessmentsBySubject}
          subjectBreakdown={subjectBreakdown}
        />
        <div className="dashboard-grid">
          <NextDue nextDueItems={nextDueItems} getUrgency={getUrgency} />
          <QuickActions resumeAssignmentLink={resumeAssignment ? resumeAssignment.link : null} />
        </div>
        <MyFlashcardSets
          filteredDecks={filteredDecks}
          deckFilter={deckFilter}
          setDeckFilter={setDeckFilter}
          getDeckImage={getDeckImage}
          scrollDecks={scrollDecks}
          decksScrollerRef={decksScrollerRef}
          handleMouseDown={handleMouseDown}
          handleMouseMove={handleMouseMove}
          handleMouseUpOrLeave={handleMouseUpOrLeave}
        />
      </div>
    </div>
  );
}