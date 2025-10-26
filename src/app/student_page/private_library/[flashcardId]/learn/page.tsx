"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

import LoadingTemplate2 from "@/components/ui/loading_template_2/loading2"; // added import
import { Settings } from "lucide-react";

type FlashcardCard = {
  _id: string;
  question: string;
  answer: string;
  options?: string[]; // For multiple-choice questions
};

type LearnProgress = {
  mastered: Set<string>;
  incorrect: Set<string>;
  currentIndex: number;
};

export default function LearnMode() {
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [trackProgress, setTrackProgress] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [studyStarredOnly, setStudyStarredOnly] = useState(false);
  const [soundEffects, setSoundEffects] = useState(false);
  const [textToSpeech, setTextToSpeech] = useState(false);

  // Question type toggles: multiple-choice and written
  const [allowMultipleChoice, setAllowMultipleChoice] = useState(true);
  const [allowWritten, setAllowWritten] = useState(true);
  // Current card presentation type (determined when card changes)
  const [currentQuestionType, setCurrentQuestionType] = useState<"mcq" | "written">("mcq");
  // written answer input
  const [writtenAnswer, setWrittenAnswer] = useState("");

  const [progress, setProgress] = useState<LearnProgress>({
    mastered: new Set(),
    incorrect: new Set(),
    currentIndex: 0,
  });
  const [flashcardTitle, setFlashcardTitle] = useState<string>("Learn Mode");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<"correct" | "incorrect" | null>(null);
  // hint state: reveal 1 then 2 letters of the answer
  const [hint, setHint] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);

  // current user id for progress API
  const [uid, setUid] = useState<string | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false); // prevent init overwrite of loaded server state
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false); // prevent saving while loading
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false); // track if we've loaded preferences at least once

  const router = useRouter();
  const params = useParams();
  const flashcardId = params.flashcardId as string;

  useEffect(() => {
    let mounted = true;
    async function loadFlashcards() {
      setIsLoading(true);
      setError(null);
      try {
        // Try multiple authentication methods
        let finalUid: string | null = null;

        // Method 1: Try authenticated API call with token
        try {
          const token = localStorage.getItem('accessToken');
          if (token) {
            const currentRes = await fetch('/api/v1/users/current', {
              credentials: 'include',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            if (currentRes.ok) {
              const currentJson = await currentRes.json().catch(() => ({} as any));
              finalUid = currentJson?.user?._id;
              console.log("✅ Authenticated via JWT token, user ID:", finalUid);
            }
          }
        } catch (err) {
          console.warn("JWT authentication failed:", err);
        }

        // Method 2: Fallback to localStorage userId
        if (!finalUid) {
          finalUid = localStorage.getItem('userId');
          if (finalUid) {
            console.log("✅ Using localStorage userId:", finalUid);
          }
        }

        // Method 3: Generate a temporary user ID for demo purposes
        if (!finalUid) {
          finalUid = `temp-user-${Date.now()}`;
          localStorage.setItem('userId', finalUid);
          console.log("⚠️ Generated temporary user ID:", finalUid);
        }

        console.log("=== FINAL USER AUTHENTICATION ===");
        console.log("Final user ID:", finalUid);
        if (!mounted) return;
        setUid(finalUid); // store uid for progress API

        const res = await fetch(`/api/student_page/flashcard/${flashcardId}?userId=${finalUid}`, {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          const maybe = await res.json().catch(() => ({} as any));
          throw new Error(maybe?.message || `Failed to load flashcards (${res.status})`);
        }
        const data = (await res.json()) as { flashcard: { cards: FlashcardCard[] } };
        if (!mounted) return;
        // capture optional title from backend if present
        if ((data as any)?.flashcard?.title) setFlashcardTitle((data as any).flashcard.title);

        // Try to load saved progress (which may include saved cardOptions)
        let savedProgress: any = null;
        try {
          console.log("=== LOADING SAVED PROGRESS ===");
          console.log("Loading progress for user:", finalUid, "flashcard:", flashcardId);
          const pRes = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${finalUid}`, { cache: "no-store" });
          if (pRes.ok) {
            const pData = await pRes.json();
            savedProgress = pData?.progress || null;
            console.log("✅ Loaded saved progress:", savedProgress);
          } else {
            console.error("❌ Failed to load progress - Response not OK:", pRes.status);
            const errorText = await pRes.text().catch(() => "Unknown error");
            console.error("Error details:", errorText);
          }
        } catch (err) {
          console.warn("❌ Failed to load saved progress, continuing without it.", err);
        }

        // build a map of saved options (cardId -> string[]), if any
        const savedCardOptions: Record<string, string[]> = {};
        if (savedProgress && savedProgress.learn && savedProgress.learn.cardOptions) {
          const raw = savedProgress.learn.cardOptions;
          console.log("=== PROCESSING SAVED CARD OPTIONS ===");
          console.log("Raw cardOptions from server:", raw);
          console.log("Type of raw:", typeof raw);
          console.log("Is Map:", raw instanceof Map);
          
          // Handle both Map and Object formats
          const entries = raw instanceof Map ? Array.from(raw.entries()) : Object.entries(raw);
          
          for (const [k, v] of entries) {
            try {
              console.log(`Processing cardOption ${k}:`, v, typeof v);
              if (Array.isArray(v)) {
                savedCardOptions[k] = v as string[];
              } else if (typeof v === "string") {
                // stored as JSON string or plain CSV; try JSON.parse
                try {
                  const parsed = JSON.parse(v);
                  if (Array.isArray(parsed)) savedCardOptions[k] = parsed;
                  else savedCardOptions[k] = [String(parsed)];
                } catch {
                  // not JSON; fallback to single-string option
                  savedCardOptions[k] = [String(v)];
                }
              } else {
                savedCardOptions[k] = [String(v)];
              }
            } catch (err) {
              console.warn(`Failed to process cardOption ${k}:`, err);
            }
          }
          console.log("Final savedCardOptions:", savedCardOptions);
        }

        // Apply persisted learn-mode UI prefs and lightweight hint now so load respects saved session.
        // Note: we also capture the persisted shuffle flag and pass it to option generation (below)

        // Check both old and new locations for backward compatibility
        const persistedShuffle = Boolean(savedProgress?.learn?.pref?.shuffle || savedProgress?.learn?.shuffle);
        if (savedProgress && savedProgress.learn) {
          const lp = savedProgress.learn;
          // Try new pref structure first, fallback to old structure for backward compatibility
          const prefs = lp.pref || lp; // If no pref object, use the learn object directly (old structure)
          console.log("=== LOADING SAVED PREFERENCES ===");
          console.log("Full savedProgress.learn:", lp);
          console.log("Has pref object:", !!lp.pref);
          console.log("Preferences from pref:", prefs);
          console.log("allowMultipleChoice in prefs:", prefs.allowMultipleChoice);
          console.log("allowMultipleChoice type:", typeof prefs.allowMultipleChoice);
          
          // Set loading flag to prevent saves during preference loading
          setIsLoadingPreferences(true);
          
          try {
            // Apply learn mode preferences from the new pref structure
            // Apply preferences immediately and synchronously
            if (typeof prefs.trackProgress === "boolean") {
              console.log("Loading trackProgress:", prefs.trackProgress);
              setTrackProgress(prefs.trackProgress);
            }
            if (typeof prefs.showOptions === "boolean") {
              console.log("Loading showOptions:", prefs.showOptions);
              setShowOptions(prefs.showOptions);
            }
            if (typeof prefs.shuffle === "boolean") {
              console.log("Loading shuffle:", prefs.shuffle);
              setShuffle(prefs.shuffle);
            }
            if (typeof prefs.studyStarredOnly === "boolean") {
              console.log("Loading studyStarredOnly:", prefs.studyStarredOnly);
              setStudyStarredOnly(prefs.studyStarredOnly);
            }
            if (typeof prefs.soundEffects === "boolean") {
              console.log("Loading soundEffects:", prefs.soundEffects);
              setSoundEffects(prefs.soundEffects);
            }
            if (typeof prefs.textToSpeech === "boolean") {
              console.log("Loading textToSpeech:", prefs.textToSpeech);
              setTextToSpeech(prefs.textToSpeech);
            }
            if (typeof prefs.allowMultipleChoice === "boolean") {
              console.log("Loading allowMultipleChoice:", prefs.allowMultipleChoice);
              setAllowMultipleChoice(prefs.allowMultipleChoice);
            } else if (typeof lp.allowMultipleChoice === "boolean") {
              console.log("Loading allowMultipleChoice from old location:", lp.allowMultipleChoice);
              setAllowMultipleChoice(lp.allowMultipleChoice);
            }
            if (typeof prefs.allowWritten === "boolean") {
              console.log("Loading allowWritten:", prefs.allowWritten);
              setAllowWritten(prefs.allowWritten);
            }

            // Load progress-related fields (not preferences)
            if (typeof lp.hintLevel === "number") {
              console.log("Loading hintLevel:", lp.hintLevel);
              setHintLevel(lp.hintLevel);
            }
            if (typeof lp.hint === "string") {
              console.log("Loading hint:", lp.hint);
              setHint(lp.hint);
            }
          } catch (err) {
            console.warn("Failed to apply persisted learn prefs/hint:", err);
          } finally {
            // Clear loading flag after a longer delay to ensure all state updates are processed
            // and to prevent immediate saving of preferences
            setTimeout(() => {
              console.log("=== PREFERENCES LOADING COMPLETE ===");
              console.log("Final preference values after loading:", {
                trackProgress,
                showOptions,
                shuffle,
                studyStarredOnly,
                soundEffects,
                textToSpeech,
                allowMultipleChoice,
                allowWritten
              });
              setIsLoadingPreferences(false);
              setHasLoadedOnce(true);
            }, 500);
          }
        }

        // Generate AI-powered options for each card, but reuse saved options when available.
        // Pass persistedShuffle so option reuse honors the saved shuffle immediately.
        const cardsWithOptions = await generateAIOptionsForCards(data.flashcard.cards, finalUid, savedCardOptions, persistedShuffle);
        if (!mounted) return;
        setCards(cardsWithOptions);

        // Apply saved learn progress into component state so UI reflects persisted progress
        if (savedProgress && savedProgress.learn) {
          try {
            console.log("=== APPLYING SAVED PROGRESS ===");
            const masteredSet = new Set<string>(savedProgress.learn.masteredIds || []);
            const incorrectSet = new Set<string>(savedProgress.learn.incorrectIds || []);
            let startIndex = typeof savedProgress.learn.currentIndex === "number"
              ? savedProgress.learn.currentIndex
              : findFirstUnmasteredIndex(0, masteredSet);

            if (startIndex < 0 || startIndex >= cardsWithOptions.length) {
              const fallback = findFirstUnmasteredIndex(0, masteredSet);
              startIndex = fallback === -1 ? 0 : fallback;
            }

            console.log("Applying progress:", { masteredSet, incorrectSet, startIndex });
            updateProgress({ mastered: masteredSet, incorrect: incorrectSet, currentIndex: startIndex });
          } catch (err) {
            console.warn("Failed to apply saved learn progress:", err);
          }
        } else {
          console.log("No saved progress found");
        }

        // Mark progress as loaded AFTER applying it to prevent race conditions
        console.log("=== MARKING PROGRESS AS LOADED ===");
        setProgressLoaded(true);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load flashcards.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    if (flashcardId) loadFlashcards();
    return () => { mounted = false; };
  }, [flashcardId]);

  // ensure currentIndex starts at the first unmastered card after cards load
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    // if progress was loaded from server, do not overwrite the persisted currentIndex
    if (progressLoaded) return;
    updateProgress(prev => {
      const first = findFirstUnmasteredIndex(0, prev.mastered);
      return { ...prev, currentIndex: first === -1 ? 0 : first };
    });
  }, [cards, progressLoaded]);

  const generateAIOptionsForCards = async (
    cards: FlashcardCard[],
    userId: string,
    savedCardOptions: Record<string, string[]> = {}
    , shuffleFlag?: boolean
  ): Promise<FlashcardCard[]> => {
    const cardsWithOptions: FlashcardCard[] = [];
    // collect to persist once
    const toPersist: Record<string, string[]> = { ...savedCardOptions };

    // If every card already has saved wrong-options, reuse them and skip AI entirely.
    const needGeneration = cards.some(card => !(savedCardOptions[card._id] && savedCardOptions[card._id].length > 0));
    if (!needGeneration) {
      // Build cards with options using persisted wrong options + correct answer (apply shuffleFlag)
      for (const card of cards) {
        const wrongs = savedCardOptions[card._id] || [];
        const opts = (shuffleFlag ?? shuffle) ? shuffleArray([...wrongs, card.answer]) : [...wrongs, card.answer];
        cardsWithOptions.push({ ...card, options: opts });
      }
      return cardsWithOptions;
    }

    for (const card of cards) {
      try {
        // if saved options exist for this card, reuse them (avoid AI)
        if (savedCardOptions[card._id] && savedCardOptions[card._id].length > 0) {
          cardsWithOptions.push({
            ...card,
            // use provided shuffleFlag first; fallback to component shuffle state
            options: (shuffleFlag ?? shuffle) ? shuffleArray([...savedCardOptions[card._id], card.answer]) : [...savedCardOptions[card._id], card.answer]
          });
          continue;
        }

        const options = await generateAIOptions(card.question, card.answer, userId);
        // store as array (without shuffling the persistent value)
        const savedOptionsOnlyWrong = options.filter(opt => opt !== card.answer).slice(0, 3);
        toPersist[card._id] = savedOptionsOnlyWrong;
        cardsWithOptions.push({
          ...card,
          options
        });
      } catch (error) {
        console.error(`Failed to generate AI options for card ${card._id}:`, error);
        const fallback = generateSimpleFallback(card.answer);
        // fallback includes correct answer already shuffled; we persist only wrong answers
        const wrongs = fallback.filter(opt => opt !== card.answer).slice(0, 3);
        toPersist[card._id] = wrongs;
        cardsWithOptions.push({
          ...card,
          options: fallback
        });
      }
    }

    // attempt to persist generated wrong options (store as JSON array strings on server-side map)
    try {
      // Only persist entries that are new (not present in savedCardOptions)
      const entriesToSave: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(toPersist)) {
        if (!savedCardOptions[k] || (Array.isArray(savedCardOptions[k]) && savedCardOptions[k].length === 0)) {
          entriesToSave[k] = v;
        }
      }
      if (Object.keys(entriesToSave).length > 0) {
        // saveCardOptionsToProgress will stringify values for safe storage
        await saveCardOptionsToProgress(userId, entriesToSave);
      }
    } catch (err) {
      console.warn("Failed to persist card options to progress:", err);
    }

    return cardsWithOptions;
  };

  const generateAIOptions = async (question: string, correctAnswer: string, userId: string): Promise<string[]> => {
    try {
      // Enhanced prompt for semantic distractors
      const prompt = `
Generate 3 plausible but incorrect answers for this flashcard question that would semantically make sense as wrong answers.

Question: "${question}"
Correct Answer: "${correctAnswer}""

Requirements:
- Create 3 wrong answers that are contextually related and believable
- They should be the same type/category as the correct answer
- Make them specific and realistic (not generic phrases)
- Each should be 1-5 words maximum
- Do NOT include the correct answer
- Output only the 3 wrong answers, one per line, no formatting

Examples:
If Q: "Capital of France?" A: "Paris" → Output distractors like major French cities
If Q: "2+2=?" A: "4" → Output other single digits  
If Q: "Author of Romeo and Juliet?" A: "Shakespeare" → Output other famous authors

Wrong answers:`;

      const formData = new FormData();
      formData.append('text', prompt);
      formData.append('analysisType', 'semantic_distractors');

      const response = await fetch(`/api/student_page/flashcard/analyze?userId=${userId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate AI options');
      }

      const data = await response.json();
      console.log('AI Response for semantic distractors:', data);

      let aiOptions: string[] = [];
      if (data.result?.content) {
        const content = String(data.result.content || "").trim();

        // Parse AI response more intelligently
        const lines = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => {
            // Keep only valid answer-like lines
            return line.length > 0 &&
              line.length < 50 && // Reasonable length for answers
              line.toLowerCase() !== correctAnswer.toLowerCase() &&
              // Remove meta-text and formatting
              !/^(wrong|answer|distractor|option|example|output|requirement|generate|create)[\s:]/i.test(line) &&
              !/^\d+[\.\)\-]\s*/.test(line) && // Remove "1.", "1)", "1-", etc.
              !/^[-*•]\s*/.test(line) && // Remove bullet points
              !/question|correct|wrong|answer|requirement|output|generate|create|example/i.test(line) &&
              // Remove instructional phrases
              !line.toLowerCase().includes('would be') &&
              !line.toLowerCase().includes('could be') &&
              !line.toLowerCase().includes('might be') &&
              !line.toLowerCase().includes('such as') &&
              !line.toLowerCase().includes('like') &&
              !line.toLowerCase().includes('for example');
          })
          .map(line => {
            // Clean up the lines
            return line
              .replace(/^["""''`]/g, '') // Remove quotes at start
              .replace(/["""''`]$/g, '') // Remove quotes at end
              .replace(/^\s*[-*•]\s*/, '') // Remove bullets
              .replace(/^\d+[\.\)]\s*/, '') // Remove numbering
              .trim();
          })
          .filter(line => line.length > 0 && line.length < 50); // Final filter

        // Take the first 3 valid options
        aiOptions = lines.slice(0, 3);
      }

      console.log('Parsed AI semantic options:', aiOptions);

      // If AI didn't provide enough semantic options, try a second AI call with different approach
      if (aiOptions.length < 3) {
        console.log(`Only got ${aiOptions.length} semantic options, trying alternative AI approach`);

        const alternativeOptions = await generateAlternativeAIOptions(question, correctAnswer, userId, aiOptions);

        // Combine existing options with alternative options
        const combinedOptions = [...aiOptions];
        for (const option of alternativeOptions) {
          if (combinedOptions.length >= 3) break;
          if (!combinedOptions.some(existing => existing.toLowerCase() === option.toLowerCase()) &&
            option.toLowerCase() !== correctAnswer.toLowerCase()) {
            combinedOptions.push(option);
          }
        }

        aiOptions = combinedOptions;
      }

      // Only fall back to simple options if AI completely fails
      if (aiOptions.length === 0) {
        console.log('AI failed to generate any semantic options, using simple fallback');
        return generateSimpleFallback(correctAnswer);
      }

      // Fill remaining slots with simple variations if needed
      while (aiOptions.length < 3) {
        const simpleOption = generateSimpleVariation(correctAnswer, aiOptions.length);
        if (!aiOptions.some(opt => opt.toLowerCase() === simpleOption.toLowerCase())) {
          aiOptions.push(simpleOption);
        } else {
          break; // Avoid infinite loop
        }
      }

      // Ensure we have exactly 3 wrong options, then add correct answer and shuffle
      const wrongOptions = aiOptions.slice(0, 3);
      const allOptions = [...wrongOptions, correctAnswer];
      return shuffleArray(allOptions);

    } catch (error) {
      console.error('Error generating AI options:', error);
      // Simple fallback only when everything fails
      return generateSimpleFallback(correctAnswer);
    }
  };

  const generateAlternativeAIOptions = async (
    question: string,
    correctAnswer: string,
    userId: string,
    existingOptions: string[]
  ): Promise<string[]> => {
    try {
      // Different approach - ask AI to think about the category/domain
      const categoryPrompt = `
Look at this question and answer, then provide 3 related but incorrect alternatives:

Question: "${question}"
Correct Answer: "${correctAnswer}""

Think about what category or domain this belongs to, then suggest 3 realistic alternatives from the same category that would be wrong but believable answers.

Just output the 3 alternatives, one per line:`;

      const formData = new FormData();
      formData.append('text', categoryPrompt);
      formData.append('analysisType', 'category_alternatives');

      const response = await fetch(`/api/student_page/flashcard/analyze?userId=${userId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate alternative AI options');
      }

      const data = await response.json();

      if (data.result?.content) {
        const content = String(data.result.content).trim();
        const alternatives = content
          .split('\n')
          .map(line => line.trim())
          .filter(line =>
            line.length > 0 &&
            line.length < 50 &&
            line.toLowerCase() !== correctAnswer.toLowerCase() &&
            !existingOptions.some(existing => existing.toLowerCase() === line.toLowerCase()) &&
            !/^(think|look|category|domain|question|answer|correct|wrong|alternative|output|provide)/i.test(line)
          )
          .map(line => line.replace(/^["""''`\-*•\d\.\)]\s*/, '').trim())
          .filter(line => line.length > 0)
          .slice(0, 3);

        return alternatives;
      }
    } catch (error) {
      console.error('Error generating alternative AI options:', error);
    }

    return [];
  };

  const generateSimpleVariation = (correctAnswer: string, index: number): string => {
    // Generate simple variations as last resort
    const variations = [
      `Not ${correctAnswer}`,
      `${correctAnswer} (wrong)`,
      `Similar to ${correctAnswer}`
    ];

    return variations[index] || `Option ${index + 1}`;
  };

  const generateSimpleFallback = (correctAnswer: string): string[] => {
    // Very simple fallback when AI completely fails
    const fallbackOptions = [
      `Not ${correctAnswer}`,
      `${correctAnswer} (incorrect)`,
      `Alternative answer`
    ];

    // Return shuffled options including the correct answer
    return shuffleArray([...fallbackOptions, correctAnswer]);
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // --- new helpers to skip mastered cards in the queue ---
  const findFirstUnmasteredIndex = (start = 0, mastered: Set<string>) => {
    if (!cards || cards.length === 0) return -1;
    for (let i = 0; i < cards.length; i++) {
      const idx = (start + i) % cards.length;
      if (!mastered.has(cards[idx]._id)) return idx;
    }
    return -1; // all mastered
  };

  const findNextUnmasteredIndex = (currentIndex: number, mastered: Set<string>) => {
    if (!cards || cards.length === 0) return -1;
    for (let i = 1; i <= cards.length; i++) {
      const idx = (currentIndex + i) % cards.length;
      if (!mastered.has(cards[idx]._id)) return idx;
    }
    return -1; // all mastered
  };

  const saveCardOptionsToProgress = async (userId: string, cardOptions: Record<string, string[]>) => {
    if (!userId) return;
    try {
      console.log("=== SAVING CARD OPTIONS ===");
      console.log("Card options to save:", cardOptions);

      // Send arrays directly so the backend stores them as arrays on the Map values.
      // The server-side logic accepts either arrays or JSON-stringified arrays,
      // but sending arrays avoids extra parsing and ensures values are usable next load.
      // Pass the userId explicitly to avoid relying on state that may not have updated yet.
      await saveProgress({ learn: { cardOptions } }, userId);
    } catch (err) {
      console.warn("saveCardOptionsToProgress error", err);
      throw err;
    }
  };

  // Progress saving system (similar to flashcard page)
  async function saveProgress(payload: any, overrideUserId?: string) {
    const targetUid = overrideUserId ?? uid;
    if (!targetUid || !flashcardId) {
      console.warn("Cannot save progress: missing uid or flashcardId", { uid: targetUid ?? null, flashcardId });
      return;
    }
    try {
      console.log("=== SAVING PROGRESS ===");
      console.log("Payload being sent:", JSON.stringify(payload, null, 2));
      console.log("UID:", targetUid);
      console.log("FlashcardId:", flashcardId);

      const response = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${targetUid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log("✅ Save successful");
        const result = await response.json();
        console.log("Server response:", result);
      } else {
        console.error("❌ Save failed:", response.status, response.statusText);
        const errorText = await response.text().catch(() => "Unknown error");
        console.error("Error details:", errorText);
      }
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  }

  // Save learn preferences when they change (debounced) - like flashcard page
  const prefSaveTimer = React.useRef<number | null>(null);
  useEffect(() => {
    // Don't save if we're still loading preferences or if progress hasn't been loaded yet
    if (!uid || !progressLoaded || isLoadingPreferences || !hasLoadedOnce) {
      console.log("Skipping preference save:", { uid: !!uid, progressLoaded, isLoadingPreferences, hasLoadedOnce })
      return;
    }
    
    if (prefSaveTimer.current) window.clearTimeout(prefSaveTimer.current);
    prefSaveTimer.current = window.setTimeout(() => {
      console.log("=== SAVING PREFERENCES ===");
      console.log("Current preference values:", {
        trackProgress,
        showOptions,
        shuffle,
        studyStarredOnly,
        soundEffects,
        textToSpeech,
        allowMultipleChoice,
        allowWritten
      });
      
      const prefPayload = {
        learn: {
          pref: {
            trackProgress,
            showOptions,
            shuffle,
            studyStarredOnly,
            soundEffects,
            textToSpeech,
            allowMultipleChoice,
            allowWritten
          }
        }
      };
      
      console.log("About to save preferences payload:", JSON.stringify(prefPayload, null, 2));
      saveProgress(prefPayload);
      prefSaveTimer.current = null;
    }, 700);
    return () => { if (prefSaveTimer.current) window.clearTimeout(prefSaveTimer.current); };
  }, [trackProgress, showOptions, shuffle, studyStarredOnly, soundEffects, textToSpeech, allowMultipleChoice, allowWritten, uid, progressLoaded, isLoadingPreferences]);

  // Save learn progress when it changes (debounced) - separate timer to avoid conflicts
  const progressSaveTimer = React.useRef<number | null>(null);
  useEffect(() => {
    if (!uid || !progressLoaded) return;
    if (progressSaveTimer.current) window.clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = window.setTimeout(() => {
      console.log("=== SAVING PROGRESS STATE ===");
      saveProgress({
        learn: {
          masteredIds: trackProgress ? Array.from(progress.mastered) : [],
          incorrectIds: trackProgress ? Array.from(progress.incorrect) : [],
          currentIndex: trackProgress ? progress.currentIndex : 0,
          hintLevel: trackProgress ? hintLevel : 0,
          hint: trackProgress ? (hint ?? null) : null
        }
      });
      progressSaveTimer.current = null;
    }, 700);
    return () => { if (progressSaveTimer.current) window.clearTimeout(progressSaveTimer.current); };
  }, [progress, hintLevel, hint, trackProgress, uid, progressLoaded]);

  // Helper to update progress
  const updateProgress = (updater: React.SetStateAction<LearnProgress>) => {
    setProgress(updater);
  };

  // Debug function to test save/load cycle (accessible from browser console)
  React.useEffect(() => {
    (window as any).testPreferenceSave = () => {
      console.log("=== MANUAL PREFERENCE TEST ===");
      console.log("Current preferences:", {
        trackProgress,
        showOptions,
        shuffle,
        studyStarredOnly,
        soundEffects,
        textToSpeech,
        allowMultipleChoice,
        allowWritten
      });
      
      // Force save preferences
      saveProgress({
        learn: {
          pref: {
            trackProgress,
            showOptions,
            shuffle,
            studyStarredOnly,
            soundEffects,
            textToSpeech,
            allowMultipleChoice,
            allowWritten
          }
        }
      });
    };
    
    (window as any).testPreferenceLoad = async () => {
      console.log("=== MANUAL PREFERENCE LOAD TEST ===");
      try {
        const res = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          console.log("Loaded data:", data);
          console.log("Learn preferences:", data?.progress?.learn?.pref);
        }
      } catch (err) {
        console.error("Load test failed:", err);
      }
    };
  }, [trackProgress, showOptions, shuffle, studyStarredOnly, soundEffects, textToSpeech, allowMultipleChoice, allowWritten, uid, flashcardId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (prefSaveTimer.current) {
        window.clearTimeout(prefSaveTimer.current);
        prefSaveTimer.current = null;
      }
      if (progressSaveTimer.current) {
        window.clearTimeout(progressSaveTimer.current);
        progressSaveTimer.current = null;
      }
    };
  }, []);

  // determine question type each time current card changes (so type is stable for that card)
  useEffect(() => {
    if (!cards || cards.length === 0) return;
    const card = cards[progress.currentIndex];
    if (!card) return;

    // If both enabled, choose randomly for variety
    if (allowMultipleChoice && allowWritten) {
      // Prefer MCQ only if card has options; otherwise fallback to written
      if (card.options && card.options.length >= 2) {
        setCurrentQuestionType(Math.random() < 0.5 ? "mcq" : "written");
      } else {
        setCurrentQuestionType("written");
      }
    } else if (allowWritten) {
      setCurrentQuestionType("written");
    } else {
      // default to MCQ if allowed or if written disabled
      setCurrentQuestionType("mcq");
    }
    // clear written input whenever the card or type changes
    setWrittenAnswer("");
    // clear any hint when card/type changes
    setHint(null);
    setHintLevel(0);

    // Progress will be saved automatically by the debounced effect
  }, [progress.currentIndex, cards, allowMultipleChoice, allowWritten, uid, progressLoaded]);

  const handleWrittenSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCard) return;
    // trim and compare case-insensitively
    const answer = writtenAnswer.trim();
    if (answer.length === 0) return;
    handleAnswer(answer);
  };

  const handleAnswer = (selectedAnswer: string) => {
    if (selectedAnswer === "skip") {
      // move to next unmastered card without marking as correct/incorrect
      setProgress((prev) => {
        const nextIndex = findNextUnmasteredIndex(prev.currentIndex, prev.mastered);
        return { ...prev, currentIndex: nextIndex === -1 ? prev.currentIndex : nextIndex };
      });
      return;
    }

    const isCorrect = selectedAnswer === currentCard.answer;
    setShowFeedback(isCorrect ? "correct" : "incorrect");

    setTimeout(() => {
      updateProgress((prev) => {
        const mastered = new Set(prev.mastered);
        const incorrect = new Set(prev.incorrect);

        if (isCorrect) {
          mastered.add(currentCard._id);
          incorrect.delete(currentCard._id);
        } else {
          incorrect.add(currentCard._id);
        }

        // find next unmastered index using the updated mastered set
        const nextIndex = findNextUnmasteredIndex(prev.currentIndex, mastered);
        return { mastered, incorrect, currentIndex: nextIndex === -1 ? prev.currentIndex : nextIndex };
      });
      setShowFeedback(null);
    }, 1500);
  };



  // reveal incremental hint (1 then 2 letters) — guard for missing card/answer
  const showHint = () => {
    if (!currentCard || !currentCard.answer) return;
    const maxReveal = Math.min(2, currentCard.answer.length);
    const next = Math.min(hintLevel + 1, maxReveal);
    if (next === hintLevel) return;
    const newHint = currentCard.answer.slice(0, next);
    setHint(newHint);
    setHintLevel(next);
  };

  // goRandom must live inside the component so it can access state/setters
  const goRandom = React.useCallback(() => {
    if (!cards || cards.length === 0) return;
    // Only pick from unmastered cards
    const unmasteredIndices = cards
      .map((card, idx) => (!progress.mastered.has(card._id) ? idx : -1))
      .filter(idx => idx !== -1) as number[];
    if (unmasteredIndices.length === 0) return;
    const randomIdx = unmasteredIndices[Math.floor(Math.random() * unmasteredIndices.length)];

    updateProgress(prev => ({ ...prev, currentIndex: randomIdx }));
    setShowFeedback(null);
    setHint(null);
    setHintLevel(0);
  }, [cards, progress]);

  const progressPercentage = Math.round((progress.mastered.size / cards.length) * 100);
  const currentCard = cards[progress.currentIndex];

  if (isLoading) {
    return <LoadingTemplate2 title="Loading flashcards" subtitle="Generating AI semantic options…" compact={false} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex items-center justify-center">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold mb-4">Learn Mode</h1>
          <p className="text-lg text-red-500">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 flex items-center justify-center">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold mb-4">Learn Mode</h1>
          <p className="text-lg">No flashcards available to learn.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 text-black dark:text-white p-6 flex flex-col items-center">
      {/* Header (photo-style progress bar) */}
      <div className="w-full max-w-4xl mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-semibold truncate">{flashcardTitle}</h1>
            <div className="text-sm text-gray-500 dark:text-slate-500 mt-0.5">Learn · <span className="font-medium">{cards.length}</span></div>
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setShowOptions(true)}
              className="px-3 py-1 rounded-full bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:shadow transition inline-flex items-center"
              aria-label="Options"
            >
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* photo-style progress bar below header */}
        <div className="bg-gray-300 dark:bg-slate-700/30 h-3 rounded-full overflow-hidden">
          <div
            className="h-3 bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
          {progress.mastered.size} of {cards.length} mastered ({progressPercentage}%)
        </p>
      </div>

      {/* Options modal (already has good dark mode support; minor tweaks for consistency) */}
      {showOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowOptions(false)} />
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-800 text-black dark:text-slate-100 rounded-xl shadow-2xl overflow-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Options</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Session settings for Learn mode</p>
              </div>
              <button onClick={() => setShowOptions(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">✕</button>
            </div>

            {/* Question types group */}
            <div className="mb-4">
              <div className="font-medium mb-2">Question types</div>
              <div className="grid gap-3 md:grid-cols-2">
                <SettingRow
                  title="Multiple Choice"
                  desc="Present multiple-choice options for the question"
                  checked={allowMultipleChoice}
                  onToggle={() => setAllowMultipleChoice(!allowMultipleChoice)}
                  accent="green"
                />

                <SettingRow
                  title="Written"
                  desc="Ask user to type the answer"
                  checked={allowWritten}
                  onToggle={() => setAllowWritten(!allowWritten)}
                  accent="green"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">If both are enabled, the presentation will be chosen at random per card.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SettingRow
                title="Shuffle"
                desc="Shuffle choices order when generating options"
                checked={shuffle}
                onToggle={() => setShuffle(!shuffle)}
                accent="green"
              />
              {/* Shuffle Now removed per request */}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SettingRow
                title="Track Progress"
                desc="Save your learning progress and preferences"
                checked={trackProgress}
                onToggle={() => setTrackProgress(!trackProgress)}
                accent="green"
              />
              <ToggleRow
                label="Text to speech"
                desc="Read question/answer aloud"
                checked={textToSpeech}
                onChange={() => setTextToSpeech(!textToSpeech)}
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => {
                  // restart learn session: reset progress and close modal
                  updateProgress({ mastered: new Set(), incorrect: new Set(), currentIndex: 0 });
                  setHint(null);
                  setHintLevel(0);
                  setShowOptions(false);
                }}
                className="px-4 py-2 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              >
                Restart Learn mode
              </button>

              <button
                onClick={() => {
                  console.log("=== DEBUG INFO ===");
                  console.log("Current uid:", uid);
                  console.log("Current flashcardId:", flashcardId);
                  console.log("localStorage userId:", localStorage.getItem('userId'));
                  console.log("Current allowMultipleChoice:", allowMultipleChoice);
                  console.log("Current allowWritten:", allowWritten);
                  console.log("Current shuffle:", shuffle);
                  console.log("Current trackProgress:", trackProgress);

                  // Test save
                  const testPayload = { learn: { pref: { allowMultipleChoice: !allowMultipleChoice } } };
                  console.log("Testing save with payload:", testPayload);
                  saveProgress(testPayload);
                }}
                className="px-3 py-1 rounded bg-blue-500 text-white text-xs"
              >
                Debug Save
              </button>

              <button
                onClick={() => {
                  // Try to set a user ID manually for testing
                  const testUserId = "test-user-id-123";
                  localStorage.setItem('userId', testUserId);
                  setUid(testUserId);
                  console.log("Set test user ID:", testUserId);
                }}
                className="px-3 py-1 rounded bg-green-500 text-white text-xs"
              >
                Set Test User
              </button>

              <div className="ml-auto text-xs text-slate-400">Changes apply immediately</div>
            </div>
          </div>
        </div>
      )}

      {/* Flashcard Content */}
      <div className="bg-gray-100 dark:bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-4xl">
        <div className="text-center mb-8">
          <p className="text-2xl font-medium mb-4 text-black dark:text-white">{currentCard.question}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Card {progress.currentIndex + 1} of {cards.length}
          </p>
        </div>

        {/* Answer Options / Written input */}
        <div className="mb-6">
          {currentQuestionType === "mcq" && (currentCard.options && currentCard.options.length > 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentCard.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  disabled={showFeedback !== null}
                  className={`px-6 py-4 rounded-lg font-medium text-lg transition-all duration-300 text-left ${showFeedback === "correct" && option === currentCard.answer
                    ? "bg-green-600 text-white"
                    : showFeedback === "incorrect" && option !== currentCard.answer
                      ? "bg-red-600 text-white"
                      : showFeedback === "incorrect" && option === currentCard.answer
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-black dark:text-white"
                    } ${showFeedback !== null ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : (
            // written input fallback (or explicit written mode)
            <form onSubmit={handleWrittenSubmit} className="flex flex-col items-stretch gap-3">
              <input
                value={writtenAnswer}
                onChange={(e) => setWrittenAnswer(e.target.value)}
                disabled={showFeedback !== null}
                placeholder="Type your answer here"
                className="px-4 py-3 rounded-lg bg-gray-200 dark:bg-slate-700 text-black dark:text-white placeholder:text-gray-500 dark:placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  disabled={showFeedback !== null}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white disabled:opacity-50"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => { setWrittenAnswer(""); setShowFeedback(null); }}
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Feedback Message */}
        {showFeedback && (
          <div className={`text-center p-4 rounded-lg mb-4 ${showFeedback === "correct"
            ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200"
            : "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200"
            }`}>
            {showFeedback === "correct" ? "✅ Correct!" : `❌ Incorrect. The answer is: ${currentCard.answer}`}
          </div>
        )}



        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => handleAnswer("skip")}
            disabled={showFeedback !== null}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            Skip this card
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={showHint}
              disabled={showFeedback !== null || hintLevel >= Math.min(2, currentCard?.answer?.length ?? 0)}
              className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Show hint (reveals 1 then 2 letters)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6" />
                <path d="M12 2a6 6 0 00-4 10.8V15a2 2 0 002 2h4a2 2 0 002-2v-2.2A6 6 0 0012 2z" />
              </svg>
              <span className="text-sm">{hintLevel === 0 ? "Hint" : `Hint: ${hint}`}</span>
            </button>
            <button
              onClick={goRandom}
              disabled={showFeedback !== null || !shuffle}
              className="flex items-center space-x-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Go to a random card"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M3 4l17 17" />
              </svg>
              <span className="text-sm">Random</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          <span className="text-green-600 dark:text-green-400 font-bold">{progress.mastered.size}</span> mastered •
          <span className="text-red-600 dark:text-red-400 font-bold ml-2">{progress.incorrect.size}</span> incorrect
        </p>
      </div>
    </div>
  );
}

// Helper presentational components (lightweight, matching Flashcard page styling)
function SettingRow({ title, desc, checked, onToggle, accent = "green" }: any) {
  const accentClass = accent === "amber" ? "from-amber-400 to-amber-500" : "from-green-400 to-emerald-500";
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-400 mt-1">{desc}</div>
      </div>
      <button onClick={onToggle} className={`w-12 h-6 rounded-full p-0.5 transition ${checked ? `bg-gradient-to-br ${accentClass}` : 'bg-slate-300 dark:bg-slate-700'}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow transform transition ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: any) {
  return (
    <div className="flex items-center justify-between p-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span className={`w-12 h-6 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-600"}`} />
      </label>
    </div>
  );
}