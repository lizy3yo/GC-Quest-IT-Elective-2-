"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Deck {
  _id: string;
  title: string;
  cardCount: number;
  lastStudied: string;
  progress: number;
  dueCount?: number;
}

interface MyFlashcardSetsProps {
  filteredDecks: Deck[];
  deckFilter: "All" | "On-Going" | "Completed";
  setDeckFilter: (filter: "All" | "On-Going" | "Completed") => void;
  getDeckImage: (title: string) => string;
  scrollDecks: (direction: "left" | "right") => void;
  decksScrollerRef: React.RefObject<HTMLDivElement | null>;
  handleMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleMouseUpOrLeave: () => void;
}

export default function MyFlashcardSets({
  filteredDecks,
  deckFilter,
  setDeckFilter,
  getDeckImage,
  scrollDecks,
  decksScrollerRef,
  handleMouseDown,
  handleMouseMove,
  handleMouseUpOrLeave,
}: MyFlashcardSetsProps) {
  return (
    <section aria-labelledby="flashcard-sets-title" className="w-full">
      <div className="sd-header">
        <div className="sd-title-row">
          <h2 id="flashcard-sets-title" className="sd-title">
            My Flashcard Sets
          </h2>
          <div className="sd-tabs">
            <button
              className={`sd-tab ${
                deckFilter === "All" ? "sd-tab--active" : ""
              }`}
              onClick={() => setDeckFilter("All")}
            >
              All
            </button>
            <button
              className={`sd-tab ${
                deckFilter === "On-Going" ? "sd-tab--active" : ""
              }`}
              onClick={() => setDeckFilter("On-Going")}
            >
              On-Going
            </button>
            <button
              className={`sd-tab ${
                deckFilter === "Completed" ? "sd-tab--active" : ""
              }`}
              onClick={() => setDeckFilter("Completed")}
            >
              Completed
            </button>
          </div>
        </div>
        <div className="sd-nav" aria-label="Study deck navigation">
          <button
            aria-label="Previous decks"
            className="sd-nav-btn"
            onClick={() => scrollDecks("left")}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            aria-label="Next decks"
            className="sd-nav-btn"
            onClick={() => scrollDecks("right")}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      {filteredDecks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <p className="empty-title">No flashcard sets yet</p>
          <p className="empty-desc">
            Create or upload a flashcard set to get started.
          </p>
          <Link
            href="/student_page/flashcards"
            className="pill-button mt-3"
          >
            Create Flashcard Set
          </Link>
        </div>
      ) : (
        <div
          className="sd-row"
          ref={decksScrollerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {filteredDecks.map((deck) => (
            <Link
              key={deck._id}
              href={`/student_page/private_library/${deck._id}`}
              className="sd-card"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            >
              <div className="sd-cover">
                <Image
                  src={getDeckImage(deck.title)}
                  alt={deck.title}
                  width={400}
                  height={192}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  priority={false}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                />
              </div>
              <div className="sd-body">
                <h3 className="sd-card-title">{deck.title}</h3>
                <p className="sd-card-desc">
                  {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
                </p>
                <div className="sd-meta">
                  <span>{deck.cardCount} Cards</span>
                  <span className="inline-flex items-center gap-1">
                    {deck.progress}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
