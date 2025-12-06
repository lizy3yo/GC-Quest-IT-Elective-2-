"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { authManager } from "@/utils/auth";
import { useRouter, useSearchParams } from "next/navigation";

type Question =
  | {
    id: string;
    type: "short";
    title: string;
    required: boolean;
  }
  | {
    id: string;
    type: "paragraph";
    title: string;
    required: boolean;
  }
  | {
    id: string;
    type: "mcq";
    title: string;
    required: boolean;
    options: string[];
    correctAnswer?: number; // index of correct option
  }
  | {
    id: string;
    type: "checkboxes";
    title: string;
    required: boolean;
    options: string[];
    correctAnswers?: number[]; // indices of correct options
  }
  | {
    id: string;
    type: "identification";
    title: string;
    required: boolean;
    answer?: string;
  }
  | {
    id: string;
    type: "enumeration";
    title: string;
    required: boolean;
    items: string[]; // expected enumeration items
  }
  | {
    id: string;
    type: "match";
    title: string;
    required: boolean;
    pairs: { left: string; right?: string }[]; // left items and right matches (right blank for students)
  }
  // new block types for title/description, image, and section
  | {
    id: string;
    type: "title";
    title: string;
    description?: string;
  }
  | {
    id: string;
    type: "image";
    title?: string;
    src?: string;
    alt?: string;
  }
  | {
    id: string;
    type: "section";
    title?: string;
  };

function AssessmentFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState(() => ({
    // mock data removed — start with an empty form
    title: "",
    description: "",
    questions: [] as Question[],
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Class selection state
  const [availableClasses, setAvailableClasses] = useState<{ id: string, name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Assessment editing state (when assessmentId is provided in URL)
  const [isEditing, setIsEditing] = useState(false);
  const [loadingAssessment, setLoadingAssessment] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(form.questions[0]?.id ?? null);
  const [toolbarTop, setToolbarTop] = useState<number>(0);

  // drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"above" | "below" | null>(null);
  const [dragClone, setDragClone] = useState<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const listenersRef = useRef<{ move: ((e: MouseEvent) => void) | null, up: ((e: MouseEvent) => void) | null }>({ move: null, up: null });
  // synchronous refs used by native event listeners so they don't depend on React state
  const isDraggingRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const dragCloneRef = useRef<HTMLElement | null>(null);
  const dragOffsetYRef = useRef<number>(0);
  // per-item menu state (which question id has an open menu)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  // inline formatting toolbar target
  const [inlineTarget, setInlineTarget] = useState<null | { scope: "header" | "section" | "title"; id?: string; field: "title" | "description" }>(null);
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const [inlineToolbarTop, setInlineToolbarTop] = useState<number | null>(null);
  const [inlineToolbarLeft, setInlineToolbarLeft] = useState<number | null>(null);
  const selectionRef = useRef<{ start: number; end: number; id?: string } | null>(null);
  // formatting map keyed by a string describing the target (eg "header:title", "question:q1:title", "section:abc:description")
  const [formatMap, setFormatMap] = useState<Record<string, { bold?: boolean; italic?: boolean; underline?: boolean; list?: 'bulleted' | 'numbered' }>>({});
  // transient drafts for new option input per question id
  const [newOptionDrafts, setNewOptionDrafts] = useState<Record<string, string>>({});
  // visibility map for description areas (keyed by question id or 'header')
  const [showDescription, setShowDescription] = useState<Record<string, boolean>>({ header: true });

  // Fetch available classes and handle URL parameters on component mount
  useEffect(() => {
    const urlClassId = searchParams.get('classId');
    const urlAssessmentId = searchParams.get('assessmentId');

    // If we have a classId from URL, use it directly (user came from a specific class)
    if (urlClassId) {
      setSelectedClassId(urlClassId);
      setIsEditing(!!urlAssessmentId);

      // If we have an assessmentId, load the existing assessment
      if (urlAssessmentId) {
        loadExistingAssessment(urlAssessmentId);
      }

      return; // Don't fetch all classes if we have a specific class
    }

    // Only fetch all classes if no classId is provided (general form access)
    const fetchClasses = async () => {
      try {
        setLoadingClasses(true);
        const response = await authManager.makeAuthenticatedRequest('/api/teacher_page/class');

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data?.classes) {
            const classes = result.data.classes.map((cls: any) => ({
              id: cls._id,
              name: cls.name
            }));
            setAvailableClasses(classes);

            // Set first available class as default
            if (classes.length > 0) {
              setSelectedClassId(classes[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch classes:', error);
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();
  }, [searchParams]);

  // Function to load existing assessment for editing
  const loadExistingAssessment = async (assessmentId: string) => {
    try {
      setLoadingAssessment(true);
      const response = await authManager.makeAuthenticatedRequest(`/api/teacher_page/assessment/${assessmentId}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.assessment) {
          const assessment = result.data.assessment;

          // Convert saved correct answers (text) back to indices for the UI
          const processedQuestions = (assessment.questions || []).map((q: any) => {
            const processedQ = { ...q };
            
            if (q.type === 'mcq' && q.correctAnswer && q.options) {
              // Find the index of the correct answer text
              const correctIndex = q.options.findIndex((option: string) => option === q.correctAnswer);
              processedQ.correctAnswer = correctIndex >= 0 ? correctIndex : 0;
            }
            
            if (q.type === 'checkboxes' && q.correctAnswer && q.options) {
              // Convert correct answer texts back to indices
              const correctTexts = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
              const correctIndices = correctTexts
                .map((text: string) => q.options.findIndex((option: string) => option === text))
                .filter((index: number) => index >= 0);
              processedQ.correctAnswers = correctIndices;
            }
            
            return processedQ;
          });

          // Populate form with existing assessment data
          setForm({
            title: assessment.title || '',
            description: assessment.description || '',
            questions: processedQuestions
          });
        }
      }
    } catch (error) {
      console.error('Failed to load assessment:', error);
    } finally {
      setLoadingAssessment(false);
    }
  };

  function restoreSelectionOnElement(el: HTMLInputElement | HTMLTextAreaElement | null) {
    if (!el || !selectionRef.current) return;
    if (selectionRef.current.id && selectionRef.current.id !== el.id) return;
    try {
      if (typeof (el as any).setSelectionRange === 'function') {
        (el as any).setSelectionRange(selectionRef.current.start, selectionRef.current.end);
      }
    } catch (err) {
      // ignore
    }
  }

  useEffect(() => {
    if (!inlineTarget) {
      setInlineToolbarTop(null);
      setInlineToolbarLeft(null);
      return;
    }
    const el = getTargetElement(inlineTarget as any);
    if (!el || !containerRef.current) return;

    const compute = () => {
      const rect = el.getBoundingClientRect();
      const contRect = containerRef.current!.getBoundingClientRect();
      // place the toolbar just below the target element and align it to the left edge
      setInlineToolbarTop(rect.bottom - contRect.top + 8); // 8px gap
      // align to the left edge of the target, with a slight inset so it doesn't touch the border
      setInlineToolbarLeft(rect.left - contRect.left + 8);
    };
    compute();

    // keep toolbar positioned while resizing / scrolling (including nested scrolls)
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [inlineTarget]);

  // Auto-resize any textarea marked with data-autoresize so cards expand with content
  useEffect(() => {
    function resizeAll() {
      if (!containerRef.current) return;
      const areas = Array.from(containerRef.current.querySelectorAll<HTMLTextAreaElement>('textarea[data-autoresize]'));
      areas.forEach((a) => {
        try {
          a.style.height = 'auto';
          // add a small fudge so the last line isn't clipped on some platforms
          a.style.height = `${a.scrollHeight + 2}px`;
        } catch (err) {
          // ignore
        }
      });
    }

    // resize on mount and whenever form changes
    resizeAll();
    // Also resize after a frame in case DOM updates lag
    const raf = requestAnimationFrame(resizeAll);
    return () => cancelAnimationFrame(raf);
  }, [form]);

  // Auto-continue lists when pressing Enter in textareas (numbered or bulleted)
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      // only handle Enter without modifier keys
      if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLTextAreaElement | null;
      if (!target) return;
      // only process textareas within our container
      if (!containerRef.current || !containerRef.current.contains(target)) return;

      // find the current line where the caret is
      try {
        const val = target.value ?? '';
        const start = (target.selectionStart ?? 0);
        const end = (target.selectionEnd ?? 0);
        // caret must be collapsed for the usual behavior
        if (start !== end) return;

        // find line start
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const line = val.slice(lineStart, start);

        // Match bulleted list (leading -, * or • with optional spaces)
        const bulletMatch = line.match(/^\s*([-*•])\s+/);
        // Match numbered list like '1. ' or '23. '
        const numberMatch = line.match(/^\s*(\d+)\.\s+/);

        if (!bulletMatch && !numberMatch) return;

        e.preventDefault();

        // If the current line has only the marker (i.e. nothing after marker), pressing Enter should remove the marker (exit list)
        const afterMarker = line.replace(/^\s*([-*•]|\d+\.)\s+/, '').trim();
        if (afterMarker === '') {
          // remove the marker from current line
          const before = val.slice(0, lineStart);
          const restLine = val.slice(lineStart + line.length);
          // remove marker from the line
          const newLine = '';
          const newVal = before + newLine + restLine;
          const caretPos = lineStart;
          // update the underlying textarea and related state
          applyTextAreaValueToState(target, newVal, caretPos);
          return;
        }

        // Otherwise, insert the next marker after the newline
        if (bulletMatch) {
          // convert the existing marker to the preferred bullet glyph if it isn't already
          const BULLET = '•';
          // find the full current line boundaries
          const lineEndIndex = val.indexOf('\n', start);
          const lineEnd = lineEndIndex === -1 ? val.length : lineEndIndex;
          const originalLine = val.slice(lineStart, lineEnd);
          // replace the leading marker (-, *, or •) with the BULLET, preserving indentation
          const convertedLine = originalLine.replace(/^(\s*)[-*•](\s+)/, `$1${BULLET} `);
          // if conversion changed anything, produce an updated value with the converted line
          const beforeLine = val.slice(0, lineStart);
          const afterLine = val.slice(lineEnd);
          const valWithConverted = beforeLine + convertedLine + afterLine;

          // Insert the next bullet on a new line using the BULLET glyph
          const before = valWithConverted.slice(0, start);
          const after = valWithConverted.slice(end);
          const insert = '\n' + BULLET + ' ';
          const newVal = before + insert + after;
          const caretPos = start + insert.length;
          applyTextAreaValueToState(target, newVal, caretPos);
        } else if (numberMatch) {
          const num = parseInt(numberMatch[1], 10);
          const next = num + 1;
          const insert = '\n' + next + '. ';
          const before = val.slice(0, start);
          const after = val.slice(end);
          const newVal = before + insert + after;
          const caretPos = start + insert.length;
          applyTextAreaValueToState(target, newVal, caretPos);
        }
      } catch (err) {
        // ignore any errors
      }
    }

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [form.questions, form.title, form.description]);

  // helper: update textarea DOM and sync to React state using existing update functions
  function applyTextAreaValueToState(target: HTMLTextAreaElement, newVal: string, caretPos: number) {
    // set DOM value and caret
    target.value = newVal;
    try {
      target.selectionStart = target.selectionEnd = caretPos;
    } catch (err) { }

    // now determine which field this textarea represents and update form state accordingly
    const id = target.id || target.getAttribute('data-qid') || '';
    if (id === 'header-title-input') {
      setForm((p) => ({ ...p, title: newVal }));
    } else if (id === 'header-desc-input') {
      setForm((p) => ({ ...p, description: newVal }));
    } else {
      // could be a section or question textarea; walk up to find [data-qid]
      const el = target.closest('[data-qid]') as HTMLElement | null;
      if (el) {
        const qid = el.getAttribute('data-qid');
        if (qid) {
          // determine field by element id pattern (question-title-, section-title-, section-desc-)
          if (target.id && target.id.startsWith('question-title-')) {
            updateTitle(qid, newVal);
          } else if (target.id && target.id.startsWith('section-title-')) {
            updateTitle(qid, newVal);
          } else if (target.id && target.id.startsWith('section-desc-')) {
            updateDescription(qid, newVal);
          } else {
            // fallback: try to detect textarea role by data-role attribute
            const role = target.getAttribute('data-role') || '';
            if (role === 'question-title') updateTitle(qid, newVal);
            else if (role === 'section-desc') updateDescription(qid, newVal);
            else updateTitle(qid, newVal);
          }
        }
      }
    }
    // trigger autoresize manually
    try { target.style.height = 'auto'; target.style.height = `${target.scrollHeight + 2}px`; } catch (err) { }
  }

  // helper to get element by target
  function getTargetElement(target: NonNullable<typeof inlineTarget>) {
    if (target.scope === "header") {
      if (target.field === "title") return document.getElementById("header-title-input") as HTMLInputElement | null;
      return document.getElementById("header-desc-input") as HTMLTextAreaElement | null;
    }
    if (!target.id) return null;
    if (target.scope === "section") {
      const id = target.field === "title" ? `section-title-${target.id}` : `section-desc-${target.id}`;
      return document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    }
    if (target.scope === "title") {
      const id = target.field === "title" ? `title-block-title-${target.id}` : `title-block-desc-${target.id}`;
      return document.getElementById(id) as HTMLInputElement | null;
    }
    return null;
  }

  function applyWrapAroundSelection(wrapper: "bold" | "italic" | "underline") {
    // Instead of inserting markdown markers, toggle visual formatting for the whole field.
    if (!inlineTarget) return;
    const key = inlineTarget.scope === 'header'
      ? `header:${inlineTarget.field}`
      : inlineTarget.scope === 'section' && inlineTarget.id
        ? `section:${inlineTarget.id}:${inlineTarget.field}`
        : inlineTarget.scope === 'title' && inlineTarget.id
          ? `title:${inlineTarget.id}:${inlineTarget.field}`
          : null;
    if (!key) return;
    setFormatMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [wrapper]: !((prev[key] && prev[key][wrapper]) ?? false),
      },
    }));
  }

  function applyLink() {
    if (!inlineTarget) return;
    const el = getTargetElement(inlineTarget);
    if (!el) return;
    restoreSelectionOnElement(el);
    let start = (el as any).selectionStart ?? 0;
    let end = (el as any).selectionEnd ?? 0;
    if (selectionRef.current && (start === undefined || end === undefined || (start === 0 && end === 0 && selectionRef.current.start !== 0))) {
      start = selectionRef.current.start;
      end = selectionRef.current.end;
    }
    const val = el.value ?? "";
    const before = val.slice(0, start);
    const sel = val.slice(start, end) || "link";
    const after = val.slice(end);
    const url = window.prompt("Enter URL", "https://") || "";
    const wrapped = `[${sel}](${url})`;
    const newVal = before + wrapped + after;
    if (inlineTarget.scope === "header") {
      if (inlineTarget.field === "title") setForm((p) => ({ ...p, title: newVal }));
      else setForm((p) => ({ ...p, description: newVal }));
    } else if (inlineTarget.scope === "section" && inlineTarget.id) {
      if (inlineTarget.field === "title") updateTitle(inlineTarget.id, newVal);
      else updateDescription(inlineTarget.id, newVal);
    } else if (inlineTarget.scope === "title" && inlineTarget.id) {
      if (inlineTarget.field === "title") updateTitle(inlineTarget.id, newVal);
      else updateDescription(inlineTarget.id, newVal);
    }
    setTimeout(() => { const node = getTargetElement(inlineTarget as any); if (node) node.focus(); }, 0);
  }

  function clearFormatting() {
    if (!inlineTarget) return;
    const el = getTargetElement(inlineTarget);
    if (!el) return;
    let val = el.value ?? "";
    // keep previous behavior of stripping markdown markers from the text value
    val = val.replace(/\*\*(.*?)\*\*/g, "$1");
    val = val.replace(/\*(.*?)\*/g, "$1");
    val = val.replace(/<u>(.*?)<\/u>/g, "$1");
    val = val.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
    val = val.split('\n').map((ln) => ln.replace(/^\s*[-*]\s+/, '')).join('\n');
    val = val.split('\n').map((ln) => ln.replace(/^\s*\d+\.\s+/, '')).join('\n');
    if (inlineTarget.scope === "header") {
      if (inlineTarget.field === "title") setForm((p) => ({ ...p, title: val }));
      else setForm((p) => ({ ...p, description: val }));
    } else if (inlineTarget.scope === "section" && inlineTarget.id) {
      if (inlineTarget.field === "title") updateTitle(inlineTarget.id, val);
      else updateDescription(inlineTarget.id, val);
    } else if (inlineTarget.scope === "title" && inlineTarget.id) {
      if (inlineTarget.field === "title") updateTitle(inlineTarget.id, val);
      else updateDescription(inlineTarget.id, val);
    }
    // clear visual formatting state for this target
    const key = inlineTarget.scope === 'header'
      ? `header:${inlineTarget.field}`
      : inlineTarget.scope === 'section' && inlineTarget.id
        ? `section:${inlineTarget.id}:${inlineTarget.field}`
        : inlineTarget.scope === 'title' && inlineTarget.id
          ? `title:${inlineTarget.id}:${inlineTarget.field}`
          : null;
    setFormatMap((prev) => {
      if (!key) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setTimeout(() => { const node = getTargetElement(inlineTarget as any); if (node) node.focus(); }, 0);
  }

  function applyList(listType: 'bulleted' | 'numbered') {
    // Toggle list mode for the field and add/remove list markers in the text value.
    if (!inlineTarget) return;
    const el = getTargetElement(inlineTarget);
    if (!el) return;
    const key = inlineTarget.scope === 'header'
      ? `header:${inlineTarget.field}`
      : inlineTarget.scope === 'section' && inlineTarget.id
        ? `section:${inlineTarget.id}:${inlineTarget.field}`
        : inlineTarget.scope === 'title' && inlineTarget.id
          ? `title:${inlineTarget.id}:${inlineTarget.field}`
          : null;
    if (!key) return;

    const currentList = formatMap[key]?.list;
    // If already the same list type, turn it off (remove markers)
    if (currentList === listType) {
      // remove markers from the whole value
      let val = el.value ?? '';
      val = val.split('\n').map((ln) => ln.replace(/^\s*[-*]\s+/, '')).map((ln) => ln.replace(/^\s*\d+\.\s+/, '')).join('\n');
      if (inlineTarget.scope === 'header') {
        if (inlineTarget.field === 'title') setForm((p) => ({ ...p, title: val }));
        else setForm((p) => ({ ...p, description: val }));
      } else if (inlineTarget.scope === 'section' && inlineTarget.id) {
        if (inlineTarget.field === 'title') updateTitle(inlineTarget.id, val);
        else updateDescription(inlineTarget.id, val);
      } else if (inlineTarget.scope === 'title' && inlineTarget.id) {
        if (inlineTarget.field === 'title') updateTitle(inlineTarget.id, val);
        else updateDescription(inlineTarget.id, val);
      }
      // clear list from formatMap for this key
      setFormatMap((prev) => {
        const copy = { ...prev };
        if (copy[key]) {
          const entry = { ...copy[key] };
          delete entry.list;
          if (Object.keys(entry).length === 0) delete copy[key];
          else copy[key] = entry;
        }
        return copy;
      });
      setTimeout(() => { const node = getTargetElement(inlineTarget as any); if (node) node.focus(); }, 0);
      return;
    }

    // Otherwise set/replace list mode and add markers across selection or whole value
    setFormatMap((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), list: listType } }));

    restoreSelectionOnElement(el);
    let start = (el as any).selectionStart ?? 0;
    let end = (el as any).selectionEnd ?? 0;
    if (selectionRef.current && (start === undefined || end === undefined || (start === 0 && end === 0 && selectionRef.current.start !== 0))) {
      start = selectionRef.current.start;
      end = selectionRef.current.end;
    }
    const val = el.value ?? '';
    const before = val.slice(0, start);
    const sel = val.slice(start, end) || '';
    const after = val.slice(end);

    if (!sel) {
      // apply to current line
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const lineEndIndex = val.indexOf('\n', start);
      const lineEnd = lineEndIndex === -1 ? val.length : lineEndIndex;
      const line = val.slice(lineStart, lineEnd);
      let newLine = line;
      if (listType === 'bulleted') newLine = `- ${line}`;
      else newLine = `1. ${line}`;
      const newVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd);
      if (inlineTarget.scope === 'header') {
        if (inlineTarget.field === 'title') setForm((p) => ({ ...p, title: newVal }));
        else setForm((p) => ({ ...p, description: newVal }));
      } else if (inlineTarget.scope === 'section' && inlineTarget.id) {
        if (inlineTarget.field === 'title') updateTitle(inlineTarget.id, newVal);
        else updateDescription(inlineTarget.id, newVal);
      }
      setTimeout(() => { const node = getTargetElement(inlineTarget as any); if (node) node.focus(); }, 0);
      return;
    }

    // selection spans lines: prefix each line in the selection
    const lines = sel.split('\n');
    const transformed = lines.map((ln, i) => (listType === 'bulleted' ? `- ${ln}` : `${i + 1}. ${ln}`)).join('\n');
    const newVal = before + transformed + after;
    if (inlineTarget.scope === 'header') {
      if (inlineTarget.field === 'title') setForm((p) => ({ ...p, title: newVal }));
      else setForm((p) => ({ ...p, description: newVal }));
    } else if (inlineTarget.scope === 'section' && inlineTarget.id) {
      if (inlineTarget.field === 'title') updateTitle(inlineTarget.id, newVal);
      else updateDescription(inlineTarget.id, newVal);
    }
    setTimeout(() => { const node = getTargetElement(inlineTarget as any); if (node) node.focus(); }, 0);
  }

  // initialize toolbar position after first render
  useEffect(() => {
    requestAnimationFrame(() => updateToolbarPosition(activeQuestionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // compute toolbar position for a given question id (center of the question card)
  function updateToolbarPosition(id: string | null) {
    if (!id || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-qid="${id}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const contRect = containerRef.current.getBoundingClientRect();
    const center = rect.top - contRect.top + rect.height / 2;
    setToolbarTop(center);
  }

  // when clicking the container, pick the nearest question by vertical distance and activate it
  function handleContainerClick(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const contRect = containerRef.current.getBoundingClientRect();
    const clickY = e.clientY - contRect.top;
    const nodes = Array.from(containerRef.current.querySelectorAll<HTMLElement>("[data-qid]"));
    if (nodes.length === 0) return;
    let closestId: string | null = null;
    let minDist = Number.POSITIVE_INFINITY;
    nodes.forEach((n) => {
      const r = n.getBoundingClientRect();
      const center = r.top - contRect.top + r.height / 2;
      const dist = Math.abs(center - clickY);
      const id = n.getAttribute("data-qid");
      if (id && dist < minDist) {
        minDist = dist;
        closestId = id;
      }
    });
    if (closestId) {
      setActiveQuestionId(closestId);
      // ensure toolbar update after state change / layout
      requestAnimationFrame(() => updateToolbarPosition(closestId));
    }
  }

  // keep toolbar positioned on resize / scroll
  useEffect(() => {
    // If there's no active question, align toolbar to the header card
    const alignToHeader = () => {
      if (!containerRef.current) return;
      if (!activeQuestionId) {
        const headerEl = containerRef.current.querySelector('[data-header]') as HTMLElement | null;
        if (headerEl) {
          const rect = headerEl.getBoundingClientRect();
          const contRect = containerRef.current.getBoundingClientRect();
          const center = rect.top - contRect.top + rect.height / 2;
          setToolbarTop(center);
          return;
        }
      }
      updateToolbarPosition(activeQuestionId);
    };

    alignToHeader();
    const onWin = () => alignToHeader();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [activeQuestionId, form.questions]);

  // Close open small menus when clicking outside or pressing Escape
  useEffect(() => {
    if (!openMenuId) return;
    // Close menus when clicking outside of any menu or pressing Escape.
    // Ignore clicks that happen inside a menu popover or on its toggle button.
    const onDocDown = (e: MouseEvent) => {
      const tgt = e.target as Element | null;
      try {
        if (tgt && (tgt.closest('[data-menu-for]') || tgt.closest('[data-menu-button-for]'))) {
          // clicked inside a menu or on its button -> keep it open
          return;
        }
      } catch (err) {
        // defensive: fall through to close
      }
      setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenuId(null); };
    // use click instead of mousedown so button click handlers run first and can toggle state
    document.addEventListener('click', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  function getNextId() {
    return "q" + Math.random().toString(36).slice(2, 9);
  }

  function makeDefaultForType(id: string, type: Question["type"]): Question {
    if (type === "short") return { id, type: "short", title: "Short answer", required: false };
    if (type === "mcq") return { id, type: "mcq", title: "Multiple choice", required: false, options: ["Option 1"], correctAnswer: 0 };
    if (type === "checkboxes") return { id, type: "checkboxes", title: "Checkboxes", required: false, options: ["Option 1"], correctAnswers: [] };
    if (type === "paragraph") return { id, type: "paragraph", title: "Paragraph", required: false };
    if (type === "identification") return { id, type: "identification", title: "Identification", required: false, answer: "" };
    if (type === "enumeration") return { id, type: "enumeration", title: "Enumeration", required: false, items: [""] };
    if (type === "title") return { id, type: "title", title: "Section title", description: "Description" };
    if (type === "image") return { id, type: "image", title: "Image", src: "" };
    if (type === "section") return { id, type: "section", title: "Section" };
    return { id, type: "match", title: "Match", required: false, pairs: [{ left: "Left 1", right: "" }] };
  }

  // Core state-driven CRUD operations (no reliance on mutable mockForm)
  function updateQuestion(id: string, patch: Partial<Question> | ((q: Question) => Question)) {
    setForm((prev) => {
      const questions = prev.questions.map((q) => {
        if (q.id !== id) return q;
        const updated = typeof patch === "function" ? patch(q) : ({ ...q, ...patch } as Question);
        return { ...updated };
      });
      return { ...prev, questions };
    });
  }

  function toggleRequired(id: string) {
    // safely toggle whatever the current value is (may be undefined)
    const q = form.questions.find((x) => x.id === id);
    const current = (q as any)?.required ?? false;
    updateQuestion(id, { ...(q as any), required: !current } as Partial<Question>);
  }

  function addQuestion(type: Question["type"] = "short") {
    insertAfter(activeQuestionId, type);
  }

  function insertAfter(afterId: string | null, type: Question["type"]) {
    const id = getNextId();
    const newQ = makeDefaultForType(id, type);
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = afterId ? next.findIndex((q) => q.id === afterId) : -1;
      const pos = idx === -1 ? next.length : idx + 1;
      next.splice(pos, 0, newQ);
      return { ...prev, questions: next };
    });
    setActiveQuestionId(id);
    // ensure description is visible by default for title blocks
    if (type === 'title') {
      setShowDescription((prev) => ({ ...prev, [id]: true }));
    }
    requestAnimationFrame(() => updateToolbarPosition(id));
  }

  function addTitleBlock() {
    insertAfter(activeQuestionId, "title");
  }

  function addImageBlock() {
    insertAfter(activeQuestionId, "image");
  }

  function addSectionBlock() {
    insertAfter(activeQuestionId, "section");
  }

  function duplicateQuestion(id: string) {
    setForm((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const src = prev.questions[idx];
      const copy: any = JSON.parse(JSON.stringify(src));
      copy.id = getNextId();
      const next = prev.questions.map((q) => ({ ...q }));
      next.splice(idx + 1, 0, copy);
      // update active after state set via outer setter below
      requestAnimationFrame(() => {
        setActiveQuestionId(copy.id);
        requestAnimationFrame(() => updateToolbarPosition(copy.id));
      });
      return { ...prev, questions: next };
    });
  }

  function deleteQuestion(id: string) {
    setForm((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const next = prev.questions.filter((q) => q.id !== id).map((q) => ({ ...q }));
      // compute next active id based on position
      const remainingIds = next.map((q) => q.id);
      const nextId = remainingIds[idx] ?? remainingIds[idx - 1] ?? null;
      requestAnimationFrame(() => {
        setActiveQuestionId(nextId);
        requestAnimationFrame(() => updateToolbarPosition(nextId));
      });
      return { ...prev, questions: next };
    });
  }

  function changeType(id: string, newType: Question["type"]) {
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = next.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const base = next[idx] as any;
      const replacement = { ...makeDefaultForType(id, newType), title: base?.title ?? (makeDefaultForType(id, newType).title) } as Question;
      next[idx] = replacement;
      // keep cursor on changed question
      requestAnimationFrame(() => {
        setActiveQuestionId(id);
        requestAnimationFrame(() => updateToolbarPosition(id));
      });
      // if switching to a title block, make sure its description is shown by default
      if (newType === 'title') {
        setShowDescription((prev) => ({ ...prev, [id]: true }));
      }
      return { ...prev, questions: next };
    });
  }

  // options / items / pairs management (now state-only)
  function addOption(questionId: string) {
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = next.findIndex((q) => q.id === questionId);
      if (idx === -1) return prev;
      const q = next[idx] as any;
      if (q.type === "mcq") {
        const nextOpt = (q.options?.length ?? 0) + 1;
        q.options = [...(q.options ?? []), `Option ${nextOpt}`];
      } else if (q.type === "enumeration") {
        q.items = [...(q.items ?? []), ""];
      } else if (q.type === "match") {
        q.pairs = [...(q.pairs ?? []), { left: `Left ${(q.pairs?.length ?? 0) + 1}`, right: "" }];
      }
      return { ...prev, questions: next };
    });
  }

  // add an option using provided text (used by inline "Add option" input)
  function addOptionWithText(questionId: string, text: string) {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return;
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = next.findIndex((q) => q.id === questionId);
      if (idx === -1) return prev;
      const q = next[idx] as any;
      if (q.type === "mcq" || q.type === 'checkboxes') {
        q.options = [...(q.options ?? []), trimmed];
      } else if (q.type === "enumeration") {
        q.items = [...(q.items ?? []), trimmed];
      } else if (q.type === "match") {
        q.pairs = [...(q.pairs ?? []), { left: trimmed, right: "" }];
      }
      return { ...prev, questions: next };
    });
  }

  function updateOptionText(questionId: string, index: number, text: string) {
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = next.findIndex((q) => q.id === questionId);
      if (idx === -1) return prev;
      const q = next[idx] as any;
      if (q.type === "mcq") {
        const opts = [...(q.options ?? [])];
        opts[index] = text;
        q.options = opts;
      } else if (q.type === "enumeration") {
        const items = [...(q.items ?? [])];
        items[index] = text;
        q.items = items;
      } else if (q.type === "match") {
        const pairs = [...(q.pairs ?? [])];
        pairs[index] = { ...pairs[index], right: text };
        q.pairs = pairs;
      } else if (q.type === "image") {
        q.src = text;
      }
      return { ...prev, questions: next };
    });
  }

  function removeOption(questionId: string, index: number) {
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = next.findIndex((q) => q.id === questionId);
      if (idx === -1) return prev;
      const q = next[idx] as any;
      if (q.type === "mcq") {
        const opts = [...(q.options ?? [])];
        opts.splice(index, 1);
        q.options = opts;

        // Update correct answer index
        if (q.correctAnswer === index) {
          q.correctAnswer = 0; // Reset to first option
        } else if (q.correctAnswer > index) {
          q.correctAnswer = q.correctAnswer - 1; // Shift down
        }
      } else if (q.type === "checkboxes") {
        const opts = [...(q.options ?? [])];
        opts.splice(index, 1);
        q.options = opts;

        // Update correct answer indices
        const correctAnswers = q.correctAnswers || [];
        q.correctAnswers = correctAnswers
          .filter((i: number) => i !== index) // Remove the deleted index
          .map((i: number) => i > index ? i - 1 : i); // Shift down indices after the deleted one
      } else if (q.type === "enumeration") {
        const items = [...(q.items ?? [])];
        items.splice(index, 1);
        q.items = items;
      } else if (q.type === "match") {
        const pairs = [...(q.pairs ?? [])];
        pairs.splice(index, 1);
        q.pairs = pairs;
      }
      return { ...prev, questions: next };
    });
  }

  function updateTitle(id: string, title: string) {
    updateQuestion(id, { title } as Partial<Question>);
  }

  function updateDescription(id: string, description?: string) {
    updateQuestion(id, { description } as Partial<Question>);
  }

  function updateImageSrc(id: string, src?: string) {
    updateQuestion(id, { src } as Partial<Question>);
  }

  // Handle correct answer selection for MCQ
  function setCorrectAnswer(questionId: string, optionIndex: number) {
    updateQuestion(questionId, { correctAnswer: optionIndex } as Partial<Question>);
  }

  // Handle correct answer selection for checkboxes
  function toggleCorrectAnswer(questionId: string, optionIndex: number) {
    const question = form.questions.find(q => q.id === questionId) as any;
    if (!question || question.type !== 'checkboxes') return;

    const currentCorrect = question.correctAnswers || [];
    const newCorrect = currentCorrect.includes(optionIndex)
      ? currentCorrect.filter((i: number) => i !== optionIndex)
      : [...currentCorrect, optionIndex];

    updateQuestion(questionId, { correctAnswers: newCorrect } as Partial<Question>);
  }

  // Upload image to Cloudinary
  async function uploadImageToCloudinary(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default'); // Using default preset

    try {
      const response = await fetch('https://api.cloudinary.com/v1_1/dqvhbvqnw/image/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // ----------------------
  // Question-local formatting helpers (for the title field inside each question)
  // ----------------------
  function applyWrapToQuestion(qid: string, wrapper: "bold" | "italic" | "underline") {
    // Toggle visual formatting for the whole question title instead of injecting markers
    const key = `question:${qid}:title`;
    setFormatMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [wrapper]: !((prev[key] && prev[key][wrapper]) ?? false),
      },
    }));
  }

  function applyLinkToQuestion(qid: string) {
    // Keep existing behavior of inserting a markdown-like link for now (no visual link rendering implemented)
    const el = document.getElementById(`question-title-${qid}`) as HTMLTextAreaElement | null;
    if (!el) return;
    try {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const val = el.value ?? "";
      const before = val.slice(0, start);
      const sel = val.slice(start, end) || "link";
      const after = val.slice(end);
      const url = window.prompt("Enter URL", "https://") || "";
      const wrapped = `[${sel}](${url})`;
      updateTitle(qid, before + wrapped + after);
      setTimeout(() => { el.focus(); }, 0);
    } catch (err) { /* ignore */ }
  }

  function clearFormattingQuestion(qid: string) {
    const el = document.getElementById(`question-title-${qid}`) as HTMLTextAreaElement | null;
    if (!el) return;
    let val = el.value ?? "";
    val = val.replace(/\*\*(.*?)\*\*/g, "$1");
    val = val.replace(/\*(.*?)\*/g, "$1");
    val = val.replace(/<u>(.*?)<\/u>/g, "$1");
    val = val.replace(/\[(.*?)\]\((.*?)\)/g, "$1");
    val = val.split('\n').map((ln) => ln.replace(/^\s*[-*]\s+/, '')).join('\n');
    val = val.split('\n').map((ln) => ln.replace(/^\s*\d+\.\s+/, '')).join('\n');
    updateTitle(qid, val);
    // clear visual formatting state for this question title (including list)
    const key = `question:${qid}:title`;
    setFormatMap((prev) => {
      const copy = { ...prev };
      if (copy[key]) delete copy[key];
      return copy;
    });
    setTimeout(() => { el.focus(); }, 0);
  }
  // ----------------------

  // FLIP helper: capture positions, then animate transform from old -> new
  function capturePositions() {
    const positions: Record<string, number> = {};
    if (!containerRef.current) return positions;
    const nodes = Array.from(containerRef.current.querySelectorAll<HTMLElement>("[data-qid]"));
    nodes.forEach((n) => {
      const id = n.getAttribute("data-qid");
      if (id) positions[id] = n.getBoundingClientRect().top;
    });
    return positions;
  }

  function runFlipAnimation(prevPositions: Record<string, number>, movedId?: string | null) {
    if (!containerRef.current) return;
    const nodes = Array.from(containerRef.current.querySelectorAll<HTMLElement>("[data-qid]"));
    const DURATION = 360; // longer for a smoother feeling
    const EASE = "cubic-bezier(.25,.8,.25,1)";

    const contRect = containerRef.current.getBoundingClientRect();

    // If there is a movedId, create an absolute clone to animate it separately so it won't "teleport"
    let cloneEl: HTMLElement | null = null;
    let originalMovedEl: HTMLElement | null = null;
    if (movedId) {
      originalMovedEl = containerRef.current.querySelector<HTMLElement>(`[data-qid="${movedId}"]`);
      if (originalMovedEl) {
        const newRect = originalMovedEl.getBoundingClientRect();
        const prevTop = prevPositions[movedId];
        // only create clone when we have previous position
        if (prevTop !== undefined) {
          cloneEl = originalMovedEl.cloneNode(true) as HTMLElement;
          // style clone
          cloneEl.style.position = "absolute";
          cloneEl.style.left = `${newRect.left - contRect.left}px`;
          cloneEl.style.width = `${newRect.width}px`;
          // place clone at previous top (relative to container)
          cloneEl.style.top = `${prevTop - contRect.top}px`;
          cloneEl.style.margin = "0";
          cloneEl.style.pointerEvents = "none";
          cloneEl.style.zIndex = "9999";
          cloneEl.style.boxSizing = "border-box";
          cloneEl.style.transition = `top ${DURATION}ms ${EASE}, opacity ${Math.round(DURATION * 0.6)}ms ${EASE}`;
          // visually hide original while clone animates
          originalMovedEl.style.visibility = "hidden";
          containerRef.current.appendChild(cloneEl);
        }
      }
    }

    // apply inverse transforms (place elements where they used to be) for non-moved nodes
    nodes.forEach((n) => {
      const id = n.getAttribute("data-qid");
      if (!id) return;
      // skip the moved element because the clone will animate it
      if (movedId && id === movedId) return;
      const prevTop = prevPositions[id];
      const newTop = n.getBoundingClientRect().top;
      const delta = prevTop !== undefined ? prevTop - newTop : 0;
      n.style.transition = "transform 0s, opacity 0s";
      n.style.transform = `translateY(${delta}px) translateZ(0)`;
      n.style.willChange = "transform, opacity";
      if (Math.abs(delta) > 0) {
        (n.style as any).zIndex = "20";
      } else {
        (n.style as any).zIndex = "";
      }
      n.style.opacity = "0.99";
    });

    // Force reflow to flush the inverse transforms
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    containerRef.current.offsetHeight;

    // animate back to natural positions for non-moved nodes
    requestAnimationFrame(() => {
      nodes.forEach((n) => {
        const id = n.getAttribute("data-qid");
        if (!id) return;
        if (movedId && id === movedId) return;
        n.style.transition = `transform ${DURATION}ms ${EASE}, opacity ${Math.round(DURATION * 0.6)}ms ${EASE}`;
        n.style.transform = "";
        n.style.opacity = "1";
        const cleanup = () => {
          n.style.transition = "";
          n.style.transform = "";
          n.style.willChange = "";
          (n.style as any).zIndex = "";
          n.removeEventListener("transitionend", cleanup);
        };
        n.addEventListener("transitionend", cleanup);
        setTimeout(cleanup, DURATION + 50);
      });

      // animate clone (moved element) from previous top -> new top
      if (cloneEl && originalMovedEl) {
        const newRect = originalMovedEl.getBoundingClientRect();
        const newTopRel = newRect.top - contRect.top;
        // trigger the top transition by setting top to new position
        requestAnimationFrame(() => {
          cloneEl!.style.top = `${newTopRel}px`;
          cloneEl!.style.opacity = '1';
        });

        const onCloneEnd = () => {
          // remove clone and reveal original
          if (cloneEl && cloneEl.parentElement) cloneEl.parentElement.removeChild(cloneEl);
          originalMovedEl!.style.visibility = "";
          cloneEl!.removeEventListener("transitionend", onCloneEnd);
        };
        cloneEl.addEventListener("transitionend", onCloneEnd);
        // safety fallback
        setTimeout(() => {
          if (cloneEl && cloneEl.parentElement) {
            cloneEl.parentElement.removeChild(cloneEl);
            originalMovedEl!.style.visibility = "";
          }
        }, DURATION + 80);
      }
    });
  }

  // Mouse drag handlers for vertical-only reordering
  function handleMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    // debug trace to confirm the handler runs
    try { console.debug('[drag] mouseDown', { id }); } catch (err) { }
    setDraggingId(id);
    draggingIdRef.current = id;
    setIsDragging(true);
    isDraggingRef.current = true;
    const el = containerRef.current?.querySelector(`[data-qid="${id}"]`) as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      const contRect = containerRef.current!.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      setDragOffsetY(offsetY);
      dragOffsetYRef.current = offsetY;

      // Create clone
      const clone = el.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.left = `${rect.left}px`;
      clone.style.top = `${rect.top}px`;
      clone.style.width = `${rect.width}px`;
      clone.style.zIndex = '1000';
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '0.9';
      clone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';
      clone.style.borderRadius = '8px';
      document.body.appendChild(clone);
      setDragClone(clone);
      dragCloneRef.current = clone;

      // Hide original
      el.style.visibility = 'hidden';
    }

    // Add listeners
    listenersRef.current.move = (ev: MouseEvent) => {
      ev.preventDefault();
      handleMouseMove(ev);
    };
    listenersRef.current.up = (e: MouseEvent) => {
      handleMouseUp(e);
    };
    document.addEventListener('mousemove', listenersRef.current.move);
    document.addEventListener('mouseup', listenersRef.current.up);
  }

  function handleMouseMove(e: MouseEvent) {
    // read synchronous refs (don't rely on React state here)
    if (!isDraggingRef.current || !dragCloneRef.current || !containerRef.current) return;
    try { console.debug('[drag] move', { clientY: e.clientY, draggingId: draggingIdRef.current }); } catch (err) { }
    const contRect = containerRef.current.getBoundingClientRect();
    const newTop = e.clientY - (dragOffsetYRef.current ?? 0);
    const cloneEl = dragCloneRef.current;
    cloneEl.style.top = `${newTop}px`;

    // Determine drag over position by finding closest question
    // ignore the element being dragged (it is hidden) so we compute the correct target
    const questions = Array.from(containerRef.current.querySelectorAll<HTMLElement>('[data-qid]'))
      .filter((q) => q.getAttribute('data-qid') !== draggingIdRef.current);
    let closestId: string | null = null;
    let minDist = Number.POSITIVE_INFINITY;
    let closestCenter = 0;
    questions.forEach((q) => {
      const rect = q.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - e.clientY);
      if (dist < minDist) {
        minDist = dist;
        closestId = q.getAttribute('data-qid');
        closestCenter = center;
      }
    });
    if (closestId) {
      const overPos = e.clientY < closestCenter ? 'above' : 'below';
      setDragOverId(closestId);
      setDragOverPos(overPos);
    } else {
      setDragOverId(null);
      setDragOverPos(null);
    }
  }

  function handleMouseUp(e: MouseEvent) {
    // use refs for synchronous checks
    if (!isDraggingRef.current || !draggingIdRef.current) return;
    try { console.debug('[drag] mouseUp', { clientY: e.clientY, draggingId: draggingIdRef.current, dragOverId }); } catch (err) { }
    setIsDragging(false);
    isDraggingRef.current = false;

    // Perform reorder
    // capture current drag-over values locally to avoid state updates during cleanup
    const finalDragOverId = dragOverId;
    const finalDragOverPos = dragOverPos;
    const finalDraggingId = draggingIdRef.current;

    // remove visual clone first so FLIP uses the real DOM state
    const cloneToRemove = dragCloneRef.current;
    if (cloneToRemove) {
      try { document.body.removeChild(cloneToRemove); } catch (err) { /* ignore */ }
      setDragClone(null);
      dragCloneRef.current = null;
    }

    if (finalDragOverId && finalDraggingId && finalDragOverId !== finalDraggingId) {
      performReorderWithFlip(finalDraggingId, finalDragOverId, finalDragOverPos);
    } else {
      // Dropped outside or on itself -> move to end if outside
      if (!finalDragOverId && finalDraggingId) performReorderWithFlip(finalDraggingId, null, null);
    }

    // Clean up
    if (dragClone) {
      document.body.removeChild(dragClone);
      setDragClone(null);
    }
    if (finalDraggingId && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-qid="${finalDraggingId}"]`) as HTMLElement;
      if (el) el.style.visibility = 'visible';
    }
    setDraggingId(null);
    draggingIdRef.current = null;
    setDragOverId(null);
    setDragOverPos(null);

    // Remove listeners
    if (listenersRef.current.move) {
      document.removeEventListener('mousemove', listenersRef.current.move);
      listenersRef.current.move = null;
    }
    if (listenersRef.current.up) {
      document.removeEventListener('mouseup', listenersRef.current.up);
      listenersRef.current.up = null;
    }
  }



  // helper to perform ordered array mutation with FLIP animation wrapping
  function performReorderWithFlip(draggedId: string, targetId: string | null, insertPos: "above" | "below" | null) {
    if (!containerRef.current) {
      // fallback to simple set
      setForm((prev) => {
        // work off original indices to avoid off-by-one when inserting below
        const orig = prev.questions.map((q) => ({ ...q }));
        const from = orig.findIndex((q) => q.id === draggedId);
        if (from === -1) return prev;
        const toOrig = targetId ? orig.findIndex((q) => q.id === targetId) : -1;
        const next = orig.slice();
        const [item] = next.splice(from, 1);
        if (!targetId) {
          next.push(item);
        } else {
          if (toOrig === -1) {
            next.push(item);
          } else {
            const pos = insertPos === "above" ? toOrig : toOrig + 1;
            let insertIndex = Math.max(0, pos);
            // if removing an earlier index shifts the insertion index, adjust
            if (from !== -1 && from < insertIndex) insertIndex -= 1;
            if (insertIndex < 0) insertIndex = 0;
            if (insertIndex > next.length) insertIndex = next.length;
            next.splice(insertIndex, 0, item);
          }
        }
        return { ...prev, questions: next };
      });
      return;
    }

    const prevPositions = capturePositions();

    // compute next array deterministically
    const nextArray = (() => {
      const current = form.questions.map((q) => ({ ...q }));
      const from = current.findIndex((q) => q.id === draggedId);
      if (from === -1) return current;
      // compute target index from the original array before removal to avoid off-by-one
      const toOrig = targetId ? current.findIndex((q) => q.id === targetId) : -1;
      const [item] = current.splice(from, 1);
      if (!targetId) {
        current.push(item);
        return current;
      }
      if (toOrig === -1) {
        current.push(item);
        return current;
      }
      const pos = insertPos === "above" ? toOrig : toOrig + 1;
      let insertIndex = Math.max(0, pos);
      if (from !== -1 && from < insertIndex) insertIndex -= 1;
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > current.length) insertIndex = current.length;
      current.splice(insertIndex, 0, item);
      return current;
    })();

    // apply state change
    setForm((prev) => ({ ...prev, questions: nextArray.map((q) => ({ ...q })) }));

    // run FLIP on next frame after DOM updates for smooth transition
    // pass draggedId so the routine can animate the moved card itself via a clone
    requestAnimationFrame(() => requestAnimationFrame(() => runFlipAnimation(prevPositions, draggedId)));

    // update active and toolbar
    requestAnimationFrame(() => {
      setActiveQuestionId(draggedId);
      requestAnimationFrame(() => updateToolbarPosition(draggedId));
    });
  }

  // section-related menu actions
  function toggleMenu(id: string) {
    setOpenMenuId((prev) => (prev === id ? null : id));
  }

  function duplicateSection(id: string) {
    duplicateQuestion(id);
    setOpenMenuId(null);
  }

  function deleteSectionById(id: string) {
    deleteQuestion(id);
    setOpenMenuId(null);
  }

  function moveSectionUp(id: string) {
    const idx = form.questions.findIndex((q) => q.id === id);
    if (idx <= 0) return;
    // find previous sibling id
    const prevId = form.questions[idx - 1].id;
    performReorderWithFlip(id, prevId, "above");
    setOpenMenuId(null);
  }

  function moveSectionDown(id: string) {
    const idx = form.questions.findIndex((q) => q.id === id);
    if (idx === -1 || idx >= form.questions.length - 1) return;
    const nextId = form.questions[idx + 1].id;
    performReorderWithFlip(id, nextId, "below");
    setOpenMenuId(null);
  }

  function mergeWithAbove(id: string) {
    setForm((prev) => {
      const next = prev.questions.map((q) => ({ ...q }));
      const idx = next.findIndex((q) => q.id === id);
      if (idx <= 0) return prev;
      const above = next[idx - 1] as any;
      const curr = next[idx] as any;
      // merge current description into above's description
      const aboveDesc = (above.description ?? "").trim();
      const currDesc = (curr.description ?? "").trim();
      above.description = [aboveDesc, currDesc].filter(Boolean).join("\n\n");
      // remove current
      next.splice(idx, 1);
      // after merging, set active to above
      requestAnimationFrame(() => {
        setActiveQuestionId(above.id);
        requestAnimationFrame(() => updateToolbarPosition(above.id));
      });
      return { ...prev, questions: next };
    });
    setOpenMenuId(null);
  }

  // Save assessment function
  const saveAssessment = async () => {
    if (isSaving) return;

    // Basic validation
    if (!form.title.trim()) {
      alert('Please enter a title for the assessment');
      return;
    }

    if (form.questions.length === 0) {
      alert('Please add at least one question to the assessment');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      // Debug: Check current user's profile
      try {
        const profileResponse = await authManager.makeAuthenticatedRequest('/api/user/profile');
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log('Current user profile:', profileData.data?.user);
        } else {
          console.log('Failed to fetch user profile:', profileResponse.statusText);
        }
      } catch (error) {
        console.log('Error fetching user profile:', error);
      }

      // Filter out invalid questions and prepare data
      const validQuestions = form.questions.filter(q => {
        if (q.type === 'title' || q.type === 'section' || q.type === 'image') {
          return true; // These don't need validation
        }
        return q.title && q.title.trim().length > 0;
      });

      if (validQuestions.length === 0) {
        alert('Please add at least one valid question with a title');
        return;
      }

      // Get classId from selected class or URL parameters
      let classId = selectedClassId || searchParams.get('classId');

      if (!classId) {
        // For development/testing, you can create assessments without a specific class
        // In production, you should always require a classId
        const shouldProceed = confirm(
          'No class selected. This assessment will be created as a draft. Do you want to continue?'
        );
        if (!shouldProceed) {
          return;
        }
        // Use a development classId - the backend will create it if it doesn't exist
        classId = 'dev-class-' + Date.now();
      }

      const assessmentData = {
        title: form.title.trim(),
        description: form.description?.trim() || '',
        type: 'Mixed', // Since we support multiple question types
        category: 'Quiz', // Default category, could be made selectable
        format: 'online', // Add the required format field
        // Allow teacher to set a custom total points for the assessment. If not provided,
        // the backend model will calculate from question points.
        totalPoints: (form as any).totalPoints ?? undefined,
        questions: validQuestions.map(q => {
          // Base question data
          const baseQuestion = {
            id: q.id,
            type: q.type,
            title: q.title,
            points: 1 // Default points per question
          };

          // Add required field only for question types that support it
          if ('required' in q) {
            (baseQuestion as any).required = q.required || false;
          }

          // Add type-specific fields
          switch (q.type) {
            case 'mcq':
              const mcqOptions = (q as any).options || [];
              const mcqCorrectIndex = (q as any).correctAnswer;
              const mcqCorrectText = (mcqCorrectIndex !== undefined && mcqOptions[mcqCorrectIndex]) 
                ? mcqOptions[mcqCorrectIndex] 
                : undefined;
              return { 
                ...baseQuestion, 
                options: mcqOptions,
                correctAnswer: mcqCorrectText
              };
            case 'checkboxes':
              const checkboxOptions = (q as any).options || [];
              const checkboxCorrectIndices = (q as any).correctAnswers || [];
              const checkboxCorrectTexts = checkboxCorrectIndices
                .map((index: number) => checkboxOptions[index])
                .filter((text: string) => text !== undefined);
              return { 
                ...baseQuestion, 
                options: checkboxOptions,
                correctAnswer: checkboxCorrectTexts
              };
            case 'identification':
              return { ...baseQuestion, answer: (q as any).answer || '', required: (q as any).required || false };
            case 'enumeration':
              return { ...baseQuestion, items: (q as any).items || [], required: (q as any).required || false };
            case 'match':
              return { ...baseQuestion, pairs: (q as any).pairs || [], required: (q as any).required || false };
            case 'title':
            case 'section':
              return { ...baseQuestion, description: (q as any).description || '' };
            case 'image':
              return { ...baseQuestion, src: (q as any).src || '', alt: (q as any).alt || '' };
            case 'short':
            case 'paragraph':
              return { ...baseQuestion, required: (q as any).required || false };
            default:
              return baseQuestion;
          }
        }),
        classId,
        published: false, // Default to unpublished
        maxAttempts: 1,
        showResults: 'immediately',
        allowReview: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        instructions: form.description?.trim() || '',
        attachments: [],
        settings: {
          lockdown: false,
          showProgress: true,
          allowBacktrack: true,
          autoSubmit: false
        }
      };

      console.log('Saving assessment:', assessmentData);
      
      // Debug: Log MCQ and checkbox questions to verify correct answers are included
      const mcqAndCheckboxQuestions = assessmentData.questions.filter(q => 
        q.type === 'mcq' || q.type === 'checkboxes'
      );
      console.log('MCQ and Checkbox questions with correct answers:', mcqAndCheckboxQuestions);

      // Determine if we're creating or updating
      const assessmentId = searchParams.get('assessmentId');
      const isUpdate = isEditing && assessmentId;

      const response = await authManager.makeAuthenticatedRequest(
        isUpdate ? `/api/teacher_page/assessment/${assessmentId}` : '/api/teacher_page/assessment',
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(assessmentData)
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', response.status, errorText);

        let errorMessage = `Failed to ${isUpdate ? 'update' : 'save'} assessment`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
          if (errorData.details) {
            errorMessage += ': ' + errorData.details;
          }
        } catch (e) {
          errorMessage = `Server error: ${response.status} - ${errorText}`;
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Assessment saved:', result);

      if (result.success && result.data?.assessment?._id) {
        alert(`Assessment ${isUpdate ? 'updated' : 'saved'} successfully!`);
        // Redirect to a more appropriate page based on the context
        const resultAssessmentId = result.data.assessment._id;

        // If we have a selected class, go to the class assessment view
        if (selectedClassId && !selectedClassId.startsWith('dev-class-')) {
          router.push(`/teacher_page/class/${selectedClassId}/assessments/quiz/${resultAssessmentId}`);
        } else {
          // For draft assessments or dev classes, go back to the teacher classes page
          router.push(`/teacher_page/class`);
        }
      } else {
        throw new Error('Invalid response from server: ' + JSON.stringify(result));
      }

    } catch (error) {
      console.error('Error saving assessment:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSaveError(errorMessage);
      alert(`Failed to ${isEditing ? 'update' : 'save'} assessment: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  // compute section order ids for display (used to show "Section X of Y")
  const sectionIds = form.questions.filter((qq) => (qq as any).type === "section").map((qq) => qq.id);
  const totalSections = 1 + sectionIds.length; // header counts as Section 1

  return (
    <div className="min-h-screen bg-purple-50 p-6">
      <div
        ref={containerRef}
        className="max-w-4xl mx-auto space-y-6 relative overflow-visible"
        onClick={handleContainerClick}
      >
        {/* Class Selection Header - Only show if no classId in URL */}
        {!searchParams.get('classId') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">Create Assessment</h2>
                {availableClasses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="class-select" className="text-sm font-medium text-gray-700">
                      For Class:
                    </label>
                    <select
                      id="class-select"
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      disabled={loadingClasses}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {loadingClasses ? (
                        <option>Loading classes...</option>
                      ) : (
                        <>
                          <option value="">Select a class...</option>
                          {availableClasses.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assessment Context Header - Show when we have context from URL */}
        {searchParams.get('classId') && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Edit Assessment' : 'Create Assessment'}
                </h2>
                {loadingAssessment && (
                  <span className="text-sm text-gray-500">Loading assessment...</span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                Class: {searchParams.get('classId')}
              </div>
            </div>
          </div>
        )}

        {/* Header card visually matches section design and includes Section 1 pill */}
        <div className="relative mt-6" data-header>
          {/* floating purple tab for Section 1 */}
          <div className="absolute -top-4 left-6">
            <div className="inline-flex items-center bg-gradient-to-b from-purple-700 to-purple-600 text-white rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg" style={{ boxShadow: '0 6px 18px rgba(99,102,241,0.12)' }}>
              {`Section 1 of ${totalSections}`}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-purple-200">
            <div className="p-4 border-b border-purple-100">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600">Assessment total points</label>
                  <input
                    type="number"
                    min={0}
                    value={(form as any).totalPoints ?? ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || '0', 10);
                      setForm((f) => ({ ...f, totalPoints: isNaN(v) ? undefined : v } as any));
                    }}
                    className="mt-1 w-40 p-2 border rounded-md text-sm"
                    placeholder="Leave blank to auto-calc"
                  />
                </div>
              </div>
            </div>
            {/* purple top bar */}
            <div className="h-2 bg-purple-600" />
            <div className="flex items-start">
              {/* blue left accent */}
              <div className="w-1 bg-blue-400" />
              <div className="p-6 flex-1">
                <textarea
                  id="header-title-input"
                  data-autoresize
                  className={
                    `w-full text-3xl ${formatMap["header:title"]?.bold ? 'font-bold' : 'font-medium'} text-gray-900 placeholder-gray-400 focus:outline-none resize-none bg-transparent border-b border-gray-200 pb-4` +
                    (formatMap["header:title"] ? `${formatMap["header:title"].italic ? ' italic' : ''}${formatMap["header:title"].underline ? ' underline' : ''}` : '')
                  }
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  onFocus={() => setInlineTarget({ scope: "header", field: "title" })}
                  onSelect={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                  onKeyUp={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                  onMouseUp={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                  placeholder="Untitled form"
                  rows={1}
                />

                {/* Inline toolbar for header title (inside the card) */}
                {inlineTarget && inlineTarget.scope === 'header' && inlineTarget.field === 'title' && (
                  <div className="mt-3 flex items-center space-x-3 text-gray-600" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                      title="Bold"
                      onClick={() => applyWrapAroundSelection('bold')}
                      className={`p-1 rounded hover:bg-gray-100 ${formatMap["header:title"]?.bold ? 'bg-gray-100 text-purple-700' : ''} font-semibold`}
                    >B</button>
                    <button
                      title="Italic"
                      onClick={() => applyWrapAroundSelection('italic')}
                      className={`p-1 rounded hover:bg-gray-100 ${formatMap["header:title"]?.italic ? 'bg-gray-100 text-purple-700' : ''} italic`}
                    >I</button>
                    <button
                      title="Underline"
                      onClick={() => applyWrapAroundSelection('underline')}
                      className={`p-1 rounded hover:bg-gray-100 ${formatMap["header:title"]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                    >U</button>
                    <button title="Clear formatting" onClick={() => clearFormatting()} className="p-1 rounded hover:bg-gray-100">
                      <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                    </button>
                  </div>
                )}

                <textarea
                  id="header-desc-input"
                  data-autoresize
                  className={
                    `mt-3 w-full ${formatMap["header:description"]?.bold ? 'font-bold' : 'text-gray-600'} placeholder-gray-400 resize-none focus:outline-none bg-transparent border-b border-transparent pb-3` +
                    (formatMap["header:description"] ? `${formatMap["header:description"].italic ? ' italic' : ''}${formatMap["header:description"].underline ? ' underline' : ''}` : '')
                  }
                  rows={1}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  onFocus={() => setInlineTarget({ scope: "header", field: "description" })}
                  onSelect={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                  onKeyUp={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                  onMouseUp={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                  placeholder="Form description"
                />

                {/* Inline toolbar for header description (inside the card) */}
                {inlineTarget && inlineTarget.scope === 'header' && inlineTarget.field === 'description' && (
                  <div className="mt-3 flex items-center space-x-3 text-gray-600" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                      title="Bold"
                      onClick={() => applyWrapAroundSelection('bold')}
                      className={`p-1 rounded hover:bg-gray-100 ${formatMap["header:description"]?.bold ? 'bg-gray-100 text-purple-700' : ''} font-semibold`}
                    >B</button>
                    <button
                      title="Italic"
                      onClick={() => applyWrapAroundSelection('italic')}
                      className={`p-1 rounded hover:bg-gray-100 ${formatMap["header:description"]?.italic ? 'bg-gray-100 text-purple-700' : ''} italic`}
                    >I</button>
                    <button
                      title="Underline"
                      onClick={() => applyWrapAroundSelection('underline')}
                      className={`p-1 rounded hover:bg-gray-100 ${formatMap["header:description"]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                    >U</button>
                    <button title="Link" onClick={() => applyLink()} className="p-1 rounded hover:bg-gray-100">
                      <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M10 14a5 5 0 007.07 0l1.42-1.42M14 10a5 5 0 00-7.07 0L5.51 11.42" /></svg>
                    </button>
                    <button title="Bulleted list" onClick={() => applyList('bulleted')} className="p-1 rounded hover:bg-gray-100">•</button>
                    <button title="Numbered list" onClick={() => applyList('numbered')} className="p-1 rounded hover:bg-gray-100">1.</button>
                    <button title="Clear formatting" onClick={() => clearFormatting()} className="p-1 rounded hover:bg-gray-100">
                      <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save button section */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {saveError && (
              <div className="text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
                Error: {saveError}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={saveAssessment}
              disabled={isSaving}
              className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
                }`}
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Assessment'
              )}
            </button>
          </div>
        </div>

        {/* persistent right-side pill toolbar - positioned closer to the card */}
        <div
          className="absolute z-20 transform -translate-y-1/2"
          // animate vertical moves via top for a smooth slide instead of teleporting
          style={{
            right: '-56px',
            top: `${toolbarTop}px`,
            transition: "top 200ms cubic-bezier(.2,.9,.2,1)",
            willChange: "top, transform",
          }}
        >
          <div
            className="w-12 bg-white rounded-2xl shadow-md border border-gray-200 py-3 px-2 flex flex-col items-center space-y-3"
            role="toolbar"
            aria-label="question actions"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* add question (+) -> adds a short question */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addQuestion("short");
              }}
              title="Add question"
              className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 bg-white hover:bg-gray-50"
            >
              <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>

            {/* add title & description */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addTitleBlock();
              }}
              title="Add title & description"
              className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 bg-white hover:bg-gray-50"
            >
              <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h10" /></svg>
            </button>

            {/* add image */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addImageBlock();
              }}
              title="Add image"
              className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 bg-white hover:bg-gray-50"
            >
              <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7" /></svg>
            </button>

            {/* add section */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addSectionBlock();
              }}
              title="Add section"
              className="w-9 h-9 rounded-full flex items-center justify-center border border-gray-200 bg-white hover:bg-gray-50"
            >
              <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </div>
        </div>

        {/* Questions */}
        <div>
          <div className="space-y-6">
            {form.questions.map((q, qi) => (
              <div
                key={(q as Question).id}
                // make the card itself draggable
                className={`relative ${((q as Question).type === 'section' || (q as Question).type === 'title') ? '' : 'bg-white rounded-lg border p-4'}`}
                data-qid={(q as Question).id}
              >
                {/* six-dot handle (left side) - draggable; hide for sections to remove external header */}
                {(q as Question).type !== 'section' && (q as Question).type !== 'title' && (
                  // top-centered dot handle (matches provided image) - interactive
                  <div
                    className="absolute top-0 left-0 right-0 flex justify-center -translate-y-1/2 pointer-events-none"
                  >
                    <button
                      onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, (q as Question).id); }}
                      onPointerDown={(e) => { e.stopPropagation(); /* forward to mouse handler for consistency */ handleMouseDown(e as any, (q as Question).id); }}
                      onMouseDownCapture={(e) => { /* prevent container click from stealing focus */ e.stopPropagation(); }}
                      title="Drag to reorder"
                      aria-label="Drag handle"
                      className="pointer-events-auto cursor-grab active:cursor-grabbing bg-white rounded-full p-1 shadow-sm"
                      style={{ touchAction: 'none' }}
                    >
                      {/* three-dot horizontal icon (subtle) */}
                      <svg width="28" height="8" viewBox="0 0 28 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
                        <circle cx="4" cy="4" r="1.5" fill="#9CA3AF" />
                        <circle cx="14" cy="4" r="1.5" fill="#9CA3AF" />
                        <circle cx="24" cy="4" r="1.5" fill="#9CA3AF" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* show a blue insertion line when this card is the drag target */}
                <div
                  className={`absolute inset-x-0 ${dragOverId === (q as Question).id && dragOverPos === "above" ? "top-0" : "hidden"}`}
                  style={{
                    borderTop: dragOverId === (q as Question).id && dragOverPos === "above" ? "2px solid #3b82f6" : undefined,
                    transform: "translateY(-1px)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  className={`absolute inset-x-0 ${dragOverId === (q as Question).id && dragOverPos === "below" ? "bottom-0" : "hidden"}`}
                  style={{
                    borderBottom: dragOverId === (q as Question).id && dragOverPos === "below" ? "2px solid #3b82f6" : undefined,
                    transform: "translateY(1px)",
                    pointerEvents: "none",
                  }}
                />

                <div className="flex items-start justify-between space-x-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      {/* title input works for most types, but section uses a custom header card (rendered below) */}
                      {(q as Question).type === "section" || (q as Question).type === "title" ? (
                        <div className="w-full" />
                      ) : (
                        <div className="w-full">
                          <textarea
                            id={`question-title-${(q as Question).id}`}
                            data-autoresize
                            className={
                              `w-full text-lg ${formatMap[`question:${(q as Question).id}:title`]?.bold ? 'font-bold' : 'font-medium'} text-gray-900 placeholder-gray-400 focus:outline-none resize-none` +
                              (formatMap[`question:${(q as Question).id}:title`] ? `${formatMap[`question:${(q as Question).id}:title`].italic ? ' italic' : ''}${formatMap[`question:${(q as Question).id}:title`].underline ? ' underline' : ''}` : '')
                            }
                            value={(q as any).title ?? ""}
                            onChange={(e) => updateTitle((q as Question).id, e.target.value)}
                            onClick={(e) => { e.stopPropagation(); setActiveQuestionId((q as Question).id); requestAnimationFrame(() => updateToolbarPosition((q as Question).id)); }}
                            onFocus={(e) => { e.stopPropagation(); setActiveQuestionId((q as Question).id); requestAnimationFrame(() => updateToolbarPosition((q as Question).id)); }}
                            placeholder={((q as Question).type === "title" ? "Title" : "Question")}
                            rows={1}
                            onSelect={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                            onKeyUp={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                            onMouseUp={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                          />

                          {/* inline formatting toolbar (B I U link clear) like the image */}
                          <div className="mt-3 flex items-center space-x-3 text-gray-600">
                            <button
                              title="Bold"
                              onClick={() => applyWrapToQuestion((q as Question).id, "bold")}
                              className={`p-1 rounded hover:bg-gray-100 ${formatMap[`question:${(q as Question).id}:title`]?.bold ? 'bg-gray-100 text-purple-700' : ''}`}
                            >
                              <span className="font-semibold">B</span>
                            </button>
                            <button
                              title="Italic"
                              onClick={() => applyWrapToQuestion((q as Question).id, "italic")}
                              className={`p-1 rounded hover:bg-gray-100 ${formatMap[`question:${(q as Question).id}:title`]?.italic ? 'bg-gray-100 text-purple-700' : ''} italic`}
                            >
                              <span className="">I</span>
                            </button>
                            <button
                              title="Underline"
                              onClick={() => applyWrapToQuestion((q as Question).id, "underline")}
                              className={`p-1 rounded hover:bg-gray-100 ${formatMap[`question:${(q as Question).id}:title`]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                            >
                              <span className="">U</span>
                            </button>
                            <button title="Link" onClick={() => applyLinkToQuestion((q as Question).id)} className="p-1 rounded hover:bg-gray-100">
                              <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M10 14a5 5 0 007.07 0l1.42-1.42M14 10a5 5 0 00-7.07 0L5.51 11.42" /></svg>
                            </button>
                            <button title="Clear formatting" onClick={() => clearFormattingQuestion((q as Question).id)} className="p-1 rounded hover:bg-gray-100">
                              <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                            </button>
                          </div>

                          {/* purple underline like the image */}
                          <div className="mt-3" style={{ height: 2 }}>
                            <div className="w-full bg-transparent border-b-2 border-purple-600" />
                          </div>

                          {/* optional description area for this question (toggled via ellipsis) */}
                          {showDescription[(q as Question).id] && (
                            <textarea
                              id={`question-desc-${(q as Question).id}`}
                              data-autoresize
                              className="mt-3 w-full text-sm text-gray-600 placeholder-gray-400 resize-none focus:outline-none bg-transparent border-b border-transparent pb-3"
                              placeholder="Description (optional)"
                              rows={1}
                              value={(q as any).description ?? ''}
                              onChange={(e) => updateDescription((q as Question).id, e.target.value)}
                              onFocus={() => setInlineTarget({ scope: 'title', id: (q as Question).id, field: 'description' })}
                            />
                          )}
                        </div>
                      )}
                      {(q as Question).type !== 'section' && (q as Question).type !== 'title' && (
                        <div className="ml-4 flex items-center space-x-2">
                          {/* right-side small image button + type selector (matches image) */}
                          <div className="flex items-center space-x-2">
                            {/* Image add/edit button */}
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      // Show loading state
                                      const button = e.target.parentElement?.querySelector('button');
                                      if (button) {
                                        button.innerHTML = '<svg class="animate-spin w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                                      }

                                      const url = await uploadImageToCloudinary(file);
                                      updateImageSrc((q as Question).id, url);

                                      // Reset button
                                      if (button) {
                                        button.innerHTML = '<svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7"/><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M8 13l2.5 3L14 11l4 6"/></svg>';
                                      }
                                    } catch (error) {
                                      alert('Failed to upload image. Please try again.');
                                      // Reset button on error
                                      const button = e.target.parentElement?.querySelector('button');
                                      if (button) {
                                        button.innerHTML = '<svg class="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7"/><path stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M8 13l2.5 3L14 11l4 6"/></svg>';
                                      }
                                    }
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                id={`image-upload-${(q as Question).id}`}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Show options for image upload
                                  const choice = window.confirm("Click OK to upload a file from your computer, or Cancel to enter an image URL");
                                  if (choice) {
                                    document.getElementById(`image-upload-${(q as Question).id}`)?.click();
                                  } else {
                                    const url = window.prompt("Enter image URL", (q as any).src ?? "https://");
                                    if (url !== null && url.trim() !== "" && url !== "https://") {
                                      updateImageSrc((q as Question).id, url);
                                    }
                                  }
                                }}
                                title={(q as any).src ? "Change image" : "Add image"}
                                className="w-9 h-9 bg-gray-100 rounded-md flex items-center justify-center shadow hover:bg-gray-200 transition-colors"
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7" />
                                  <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 13l2.5 3L14 11l4 6" />
                                </svg>
                              </button>
                            </div>

                            {/* small thumbnail preview when an image URL is present */}
                            {(q as any).src ? (
                              <img
                                src={(q as any).src}
                                alt={(q as any).title ?? "preview"}
                                className="w-10 h-10 object-cover rounded border"
                                onClick={(e) => { e.stopPropagation(); /* allow clicking preview to edit via same prompt */ const url = window.prompt("Enter image URL", (q as any).src ?? "https://"); if (url !== null) updateImageSrc((q as Question).id, url); }}
                              />
                            ) : null}

                            {/* Type selector matching the UI in the screenshot */}
                            <select
                              value={(q as Question).type}
                              onChange={(e) => { e.stopPropagation(); changeType((q as Question).id, e.target.value as Question["type"]); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="ml-1 border rounded px-2 py-1 text-sm bg-white"
                              title="Question type"
                            >
                              <option value="short">Short answer</option>
                              <option value="paragraph">Paragraph</option>
                              <option value="mcq">Multiple choice</option>
                              <option value="checkboxes">Checkboxes</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      {(q as Question).type === "short" ? (
                        <input className="w-full border-b border-dashed border-gray-300 py-2 placeholder-gray-400 focus:outline-none" placeholder="Short answer text" readOnly />
                      ) : (q as Question).type === "paragraph" ? (
                        <textarea className="w-full border rounded p-2 placeholder-gray-400 focus:outline-none" placeholder="Long answer text" rows={4} readOnly />
                      ) : (q as Question).type === "mcq" || (q as Question).type === "checkboxes" ? (
                        <div className="space-y-3">
                          {(q as any).options?.map((opt: string, i: number) => {
                            const isCorrect = (q as Question).type === 'mcq'
                              ? (q as any).correctAnswer === i
                              : ((q as any).correctAnswers || []).includes(i);

                            return (
                              <div
                                key={i}
                                className={`relative group flex items-center space-x-3 border rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 ${isCorrect
                                    ? 'bg-green-50 border-green-300 ring-1 ring-green-200'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                              >
                                <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                                  <input
                                    type={(q as Question).type === 'mcq' ? 'radio' : 'checkbox'}
                                    name={`question-${(q as Question).id}`}
                                    checked={isCorrect}
                                    onChange={() => {
                                      if ((q as Question).type === 'mcq') {
                                        setCorrectAnswer((q as Question).id, i);
                                      } else {
                                        toggleCorrectAnswer((q as Question).id, i);
                                      }
                                    }}
                                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                                  />
                                </div>

                                <input
                                  value={opt}
                                  onChange={(e) => updateOptionText((q as Question).id, i, e.target.value)}
                                  className="flex-1 bg-transparent border-0 focus:outline-none px-2 py-1 text-sm"
                                  placeholder={`Option ${i + 1}`}
                                />

                                {isCorrect && (
                                  <div className="flex items-center text-green-700 text-sm font-medium bg-green-100 px-2 py-1 rounded-full">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Correct
                                  </div>
                                )}

                                <button
                                  onClick={() => removeOption((q as Question).id, i)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-sm text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded"
                                  aria-label="Remove option"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          {/* "Add option or add \"Other\" " line */}
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                              <input
                                type="text"
                                placeholder="Add option"
                                value={newOptionDrafts[(q as Question).id] ?? ''}
                                onChange={(e) => setNewOptionDrafts((p) => ({ ...p, [(q as Question).id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = (newOptionDrafts[(q as Question).id] ?? '').trim();
                                    if (val) {
                                      addOptionWithText((q as Question).id, val);
                                      setNewOptionDrafts((p) => ({ ...p, [(q as Question).id]: '' }));
                                    }
                                  } else if (e.key === 'Escape') {
                                    setNewOptionDrafts((p) => ({ ...p, [(q as Question).id]: '' }));
                                  }
                                }}
                                onBlur={() => {
                                  const val = (newOptionDrafts[(q as Question).id] ?? '').trim();
                                  if (val) addOptionWithText((q as Question).id, val);
                                  setNewOptionDrafts((p) => ({ ...p, [(q as Question).id]: '' }));
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                              <span className="text-gray-400">or</span>
                              <button
                                onClick={() => {
                                  addOption((q as Question).id);
                                  // Set the new option text to 'Other' after it's added
                                  setTimeout(() => {
                                    const currentOptions = (form.questions.find(x => x.id === (q as Question).id) as any)?.options || [];
                                    const lastIndex = currentOptions.length - 1;
                                    updateOptionText((q as Question).id, lastIndex, 'Other');
                                  }, 0);
                                }}
                                className="text-blue-600 hover:underline text-sm font-medium"
                              >
                                add "Other"
                              </button>
                            </div>

                            {/* Instructions for correct answers and Required toggle */}
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-gray-400 italic">
                                {(q as Question).type === 'mcq'
                                  ? 'Click the radio button to mark the correct answer'
                                  : 'Check the boxes to mark correct answers (multiple allowed)'
                                }
                              </div>

                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={(q as any).required ?? false}
                                    onChange={() => toggleRequired((q as Question).id)}
                                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                  />
                                  Required
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (q as Question).type === "identification" ? (
                        <input className="w-full border-b border-dashed border-gray-300 py-2 placeholder-gray-400 focus:outline-none" placeholder="Identification answer" readOnly />
                      ) : (q as Question).type === "enumeration" ? (
                        <div className="space-y-2">
                          {(q as any).items?.map((it: string, i: number) => (
                            <div key={i} className="flex items-center space-x-3">
                              <span className="text-gray-600 w-6 text-right">{i + 1}.</span>
                              <input
                                value={it}
                                onChange={(e) => updateOptionText((q as Question).id, i, e.target.value)}
                                className="flex-1 border rounded px-2 py-1"
                                placeholder={`Item ${i + 1}`}
                              />
                              <button onClick={() => removeOption((q as Question).id, i)} className="px-2 py-1 text-sm text-red-600">
                                Remove
                              </button>
                            </div>
                          ))}
                          <button onClick={() => addOption((q as Question).id)} className="mt-2 px-2 py-1 text-sm border rounded bg-white">
                            Add item
                          </button>
                        </div>
                      ) : (q as Question).type === "match" ? (
                        <div className="space-y-2">
                          {(q as any).pairs?.map((p: any, i: number) => (
                            <div key={i} className="flex items-center space-x-4">
                              <input value={p.left} readOnly className="w-1/2 border rounded px-2 py-1 bg-gray-50" />
                              <input
                                value={p.right}
                                onChange={(e) => updateOptionText((q as Question).id, i, e.target.value)}
                                className="w-1/2 border rounded px-2 py-1"
                                placeholder="Match"
                              />
                              <button onClick={() => removeOption((q as Question).id, i)} className="px-2 py-1 text-sm text-red-600">
                                Remove
                              </button>
                            </div>
                          ))}
                          <button onClick={() => addOption((q as Question).id)} className="mt-2 px-2 py-1 text-sm border rounded bg-white">
                            Add pair
                          </button>
                        </div>
                      ) : (q as Question).type === "title" ? (
                        <div className="bg-white rounded-lg shadow-sm overflow-visible border border-gray-200 relative">
                          {/* left blue accent */}
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l" />

                          {/* interactive drag handle (center-top) for title block */}
                          <div className="absolute top-2 inset-x-0 flex justify-center -translate-y-1/2">
                            <button
                              onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e as any, (q as Question).id); }}
                              onPointerDown={(e) => { e.stopPropagation(); handleMouseDown(e as any, (q as Question).id); }}
                              onMouseDownCapture={(e) => { e.stopPropagation(); }}
                              title="Drag to reorder"
                              aria-label="Drag handle"
                              className="pointer-events-auto cursor-grab active:cursor-grabbing bg-white rounded-full p-1 shadow-sm"
                              style={{ touchAction: 'none' }}
                            >
                              <svg width="28" height="8" viewBox="0 0 28 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
                                <circle cx="4" cy="4" r="1.5" fill="#9CA3AF" />
                                <circle cx="12" cy="4" r="1.5" fill="#9CA3AF" />
                                <circle cx="20" cy="4" r="1.5" fill="#9CA3AF" />
                              </svg>
                            </button>
                          </div>

                          <div className="p-6 flex items-start">
                            <div className="flex-1">
                              <input
                                id={`title-block-title-${(q as Question).id}`}
                                className={
                                  `w-full text-xl ${formatMap[`title:${(q as Question).id}:title`]?.bold ? 'font-bold' : 'font-medium'} text-gray-900 placeholder-gray-400 focus:outline-none border-b border-gray-200 pb-2` +
                                  (formatMap[`title:${(q as Question).id}:title`] ? `${formatMap[`title:${(q as Question).id}:title`].italic ? ' italic' : ''}${formatMap[`title:${(q as Question).id}:title`].underline ? ' underline' : ''}` : '')
                                }
                                value={(q as any).title ?? "Untitled Title"}
                                onChange={(e) => updateTitle((q as Question).id, e.target.value)}
                                onClick={(e) => { e.stopPropagation(); setActiveQuestionId((q as Question).id); requestAnimationFrame(() => updateToolbarPosition((q as Question).id)); }}
                                onFocus={() => setInlineTarget({ scope: "title", id: (q as Question).id, field: "title" })}
                                onSelect={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                onKeyUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                onMouseUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                placeholder="Untitled Title"
                              />

                              {/* Inline toolbar for title block title */}
                              {inlineTarget && inlineTarget.scope === 'title' && inlineTarget.id === (q as Question).id && inlineTarget.field === 'title' && (
                                <div className="mt-3 flex items-center space-x-3 text-gray-600" onMouseDown={(e) => e.stopPropagation()}>
                                  <button
                                    title="Bold"
                                    onClick={() => applyWrapAroundSelection('bold')}
                                    className={`p-1 rounded hover:bg-gray-100 ${formatMap[`title:${(q as Question).id}:title`]?.bold ? 'bg-gray-100 text-purple-700' : ''} font-semibold`}
                                  >B</button>
                                  <button
                                    title="Italic"
                                    onClick={() => applyWrapAroundSelection('italic')}
                                    className={`p-1 rounded hover:bg-gray-100 ${formatMap[`title:${(q as Question).id}:title`]?.italic ? 'bg-gray-100 text-purple-700' : ''} italic`}
                                  >I</button>
                                  <button
                                    title="Underline"
                                    onClick={() => applyWrapAroundSelection('underline')}
                                    className={`p-1 rounded hover:bg-gray-100 ${formatMap[`title:${(q as Question).id}:title`]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                                  >U</button>
                                  <button title="Clear formatting" onClick={() => clearFormatting()} className="p-1 rounded hover:bg-gray-100">
                                    <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                                  </button>
                                </div>
                              )}

                              {showDescription[(q as Question).id] && (
                                <>
                                  <input
                                    id={`title-block-desc-${(q as Question).id}`}
                                    className={
                                      `mt-4 w-full text-sm ${formatMap[`title:${(q as Question).id}:description`]?.bold ? 'font-bold' : 'text-gray-500'} placeholder-gray-400 focus:outline-none border-b border-gray-200 pb-2` +
                                      (formatMap[`title:${(q as Question).id}:description`] ? `${formatMap[`title:${(q as Question).id}:description`].italic ? ' italic' : ''}${formatMap[`title:${(q as Question).id}:description`].underline ? ' underline' : ''}` : '')
                                    }
                                    placeholder="Description (optional)"
                                    value={(q as any).description ?? ""}
                                    onChange={(e) => updateDescription((q as Question).id, e.target.value)}
                                    onClick={(e) => { e.stopPropagation(); setActiveQuestionId((q as Question).id); requestAnimationFrame(() => updateToolbarPosition((q as Question).id)); }}
                                    onFocus={() => setInlineTarget({ scope: "title", id: (q as Question).id, field: "description" })}
                                    onSelect={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    onKeyUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    onMouseUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                  />

                                  {/* Inline toolbar for title block description */}
                                  {inlineTarget && inlineTarget.scope === 'title' && inlineTarget.id === (q as Question).id && inlineTarget.field === 'description' && (
                                    <div className="mt-3 flex items-center space-x-3 text-gray-600" onMouseDown={(e) => e.stopPropagation()}>
                                      <button
                                        title="Bold"
                                        onClick={() => applyWrapAroundSelection('bold')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`title:${(q as Question).id}:description`]?.bold ? 'bg-gray-100 text-purple-700' : ''} font-semibold`}
                                      >B</button>
                                      <button
                                        title="Italic"
                                        onClick={() => applyWrapAroundSelection('italic')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`title:${(q as Question).id}:description`]?.italic ? 'bg-gray-100 text-purple-700' : ''} italic`}
                                      >I</button>
                                      <button
                                        title="Underline"
                                        onClick={() => applyWrapAroundSelection('underline')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`title:${(q as Question).id}:description`]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                                      >U</button>
                                      <button title="Link" onClick={() => applyLink()} className="p-1 rounded hover:bg-gray-100">
                                        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M10 14a5 5 0 007.07 0l1.42-1.42M14 10a5 5 0 00-7.07 0L5.51 11.42" /></svg>
                                      </button>
                                      <button title="Bulleted list" onClick={() => applyList('bulleted')} className="p-1 rounded hover:bg-gray-100">•</button>
                                      <button title="Numbered list" onClick={() => applyList('numbered')} className="p-1 rounded hover:bg-gray-100">1.</button>
                                      <button title="Clear formatting" onClick={() => clearFormatting()} className="p-1 rounded hover:bg-gray-100">
                                        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="ml-4 flex items-center space-x-2 p-2">

                              <button onClick={(e) => { e.stopPropagation(); duplicateQuestion((q as Question).id); }} className="w-8 h-8 rounded flex items-center justify-center text-gray-600 hover:bg-gray-100" title="Duplicate">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="11" height="11" rx="2" ry="2" strokeWidth="1.5" /><rect x="4" y="4" width="11" height="11" rx="2" ry="2" strokeWidth="1.5" /></svg>
                              </button>

                              <button onClick={(e) => { e.stopPropagation(); deleteQuestion((q as Question).id); }} className="w-8 h-8 rounded flex items-center justify-center text-gray-600 hover:bg-gray-100" title="Delete">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" /><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2" /></svg>
                              </button>

                              <div className="relative">
                                <button
                                  data-menu-button-for={(q as Question).id}
                                  onClick={(e) => { e.stopPropagation(); setOpenMenuId((prev) => (prev === (q as Question).id ? null : (q as Question).id)); }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-700"
                                  title="More"
                                >
                                  {/* ellipsis icon (solid dots) */}
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <circle cx="6" cy="12" r="1.5" />
                                    <circle cx="12" cy="12" r="1.5" />
                                    <circle cx="18" cy="12" r="1.5" />
                                  </svg>
                                </button>

                                {openMenuId === (q as Question).id && (
                                  <div data-menu-for={(q as Question).id} className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border text-sm text-gray-700 z-50">
                                    <div className="px-3 py-2 text-xs text-gray-500">Show</div>
                                    <button
                                      data-menu-button-for={(q as Question).id}
                                      onClick={(e) => { e.stopPropagation(); setShowDescription((prev) => ({ ...prev, [(q as Question).id]: !prev[(q as Question).id] })); setOpenMenuId(null); }}
                                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                                    >
                                      <div className="flex items-center gap-2">
                                        {showDescription[(q as Question).id] && (
                                          <svg className="w-4 h-4 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172l-2.293-2.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l8-8z" clipRule="evenodd" /></svg>
                                        )}
                                        <span className="text-sm">Description</span>
                                      </div>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      ) : (q as Question).type === "image" ? (
                        <div className="space-y-2">
                          <div className="w-full h-40 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                            {(q as any).src ? <img src={(q as any).src} alt={(q as any).alt ?? ""} className="max-h-full max-w-full" /> : "Image placeholder"}
                          </div>
                          <input
                            className="w-full border rounded px-2 py-1"
                            placeholder="Image URL"
                            value={(q as any).src ?? ""}
                            onChange={(e) => updateImageSrc((q as Question).id, e.target.value)}
                          />
                        </div>
                      ) : (q as Question).type === "section" ? (
                        // Styled section card (single, corrected instance)
                        <div className="py-2">
                          <div className="relative">
                            {/* floating purple tab */}
                            <div className="absolute -top-3 left-4">
                              <div className="bg-purple-700 text-white rounded-t-lg px-3 py-1 text-sm font-semibold shadow">
                                {`Section ${sectionIds.indexOf((q as Question).id) + 2} of ${totalSections}`}
                              </div>
                            </div>

                            {/* section cards intentionally do not show the centered drag handle (moved via menu) */}

                            <div className="bg-white rounded-lg shadow-sm overflow-visible border border-purple-200">
                              {/* purple top bar */}
                              <div className="h-2 bg-purple-600" />
                              <div className="flex items-start">
                                {/* blue left accent */}
                                <div className="w-1 bg-blue-400" />
                                <div className="p-6 flex-1">
                                  <input
                                    id={`section-title-${(q as Question).id}`}
                                    className={
                                      `w-full text-2xl ${formatMap[`section:${(q as Question).id}:title`]?.bold ? 'font-bold' : 'font-medium'} text-gray-900 placeholder-gray-400 focus:outline-none` +
                                      (formatMap[`section:${(q as Question).id}:title`] ? `${formatMap[`section:${(q as Question).id}:title`].italic ? ' italic' : ''}${formatMap[`section:${(q as Question).id}:title`].underline ? ' underline' : ''}` : '')
                                    }
                                    value={(q as any).title ?? "Untitled Section"}
                                    onChange={(e) => updateTitle((q as Question).id, e.target.value)}
                                    onClick={(e) => { e.stopPropagation(); setActiveQuestionId((q as Question).id); requestAnimationFrame(() => updateToolbarPosition((q as Question).id)); }}
                                    onFocus={() => setInlineTarget({ scope: "section", id: (q as Question).id, field: "title" })}
                                    onSelect={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    onKeyUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    onMouseUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    placeholder="Untitled Section"
                                  />
                                  {/* Inline toolbar for section title (inside section card) */}
                                  {inlineTarget && inlineTarget.scope === 'section' && inlineTarget.id === (q as Question).id && inlineTarget.field === 'title' && (
                                    <div className="mt-3 flex items-center space-x-3 text-gray-600" onMouseDown={(e) => e.stopPropagation()}>
                                      <button
                                        title="Bold"
                                        onClick={() => applyWrapAroundSelection('bold')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`section:${(q as Question).id}:title`]?.bold ? 'bg-gray-100 text-purple-700' : ''} font-semibold`}
                                      >B</button>
                                      <button
                                        title="Italic"
                                        onClick={() => applyWrapAroundSelection('italic')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`section:${(q as Question).id}:title`]?.italic ? 'bg-gray-100 text-purple-700' : ''} italic`}
                                      >I</button>
                                      <button
                                        title="Underline"
                                        onClick={() => applyWrapAroundSelection('underline')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`section:${(q as Question).id}:title`]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                                      >U</button>
                                      <button title="Clear formatting" onClick={() => clearFormatting()} className="p-1 rounded hover:bg-gray-100">
                                        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                                      </button>
                                    </div>
                                  )}
                                  <input
                                    id={`section-desc-${(q as Question).id}`}
                                    className={
                                      `mt-3 w-full ${formatMap[`section:${(q as Question).id}:description`]?.bold ? 'font-bold' : 'text-gray-500'} placeholder-gray-400 focus:outline-none border-b border-transparent` +
                                      (formatMap[`section:${(q as Question).id}:description`] ? `${formatMap[`section:${(q as Question).id}:description`].italic ? ' italic' : ''}${formatMap[`section:${(q as Question).id}:description`].underline ? ' underline' : ''}` : '')
                                    }
                                    placeholder="Description (optional)"
                                    value={(q as any).description ?? ""}
                                    onChange={(e) => updateDescription((q as Question).id, e.target.value)}
                                    onFocus={() => setInlineTarget({ scope: "section", id: (q as Question).id, field: "description" })}
                                    onSelect={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    onKeyUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                    onMouseUp={(e) => { const t = e.target as HTMLInputElement; selectionRef.current = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0, id: t.id }; }}
                                  />
                                  {/* Inline toolbar for section description (inside section card) */}
                                  {inlineTarget && inlineTarget.scope === 'section' && inlineTarget.id === (q as Question).id && inlineTarget.field === 'description' && (
                                    <div className="mt-3 flex items-center space-x-3 text-gray-600" onMouseDown={(e) => e.stopPropagation()}>
                                      <button
                                        title="Bold"
                                        onClick={() => applyWrapAroundSelection('bold')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`section:${(q as Question).id}:description`]?.bold ? 'bg-gray-100 text-purple-700' : ''} font-semibold`}
                                      >B</button>
                                      <button
                                        title="Italic"
                                        onClick={() => applyWrapAroundSelection('italic')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`section:${(q as Question).id}:description`]?.italic ? 'bg_gray-100 text-purple-700' : ''} italic`}
                                      >I</button>
                                      <button
                                        title="Underline"
                                        onClick={() => applyWrapAroundSelection('underline')}
                                        className={`p-1 rounded hover:bg-gray-100 ${formatMap[`section:${(q as Question).id}:description`]?.underline ? 'bg-gray-100 text-purple-700' : ''}`}
                                      >U</button>
                                      <button title="Link" onClick={() => applyLink()} className="p-1 rounded hover:bg-gray-100">
                                        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M10 14a5 5 0 007.07 0l1.42-1.42M14 10a5 5 0 00-7.07 0L5.51 11.42" /></svg>
                                      </button>
                                      <button title="Bulleted list" onClick={() => applyList('bulleted')} className="p-1 rounded hover:bg-gray-100">•</button>
                                      <button title="Numbered list" onClick={() => applyList('numbered')} className="p-1 rounded hover:bg-gray-100">1.</button>
                                      <button title="Clear formatting" onClick={() => clearFormatting()} className="p-1 rounded hover:bg-gray-100">
                                        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6h12v12" /></svg>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* small right-side controls (menu) */}
                                <div className="p-4 flex-shrink-0 relative">
                                  <button
                                    data-menu-button-for={(q as Question).id}
                                    onClick={(e) => { e.stopPropagation(); toggleMenu((q as Question).id); }}
                                    className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center shadow"
                                    title="Section options"
                                  >
                                    <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                      <circle cx="6" cy="12" r="1.5" />
                                      <circle cx="12" cy="12" r="1.5" />
                                      <circle cx="18" cy="12" r="1.5" />
                                    </svg>
                                  </button>

                                  {openMenuId === (q as Question).id && (
                                    <div data-menu-for={(q as Question).id} className="absolute right-0 mt-2 w-44 bg-white rounded-md shadow-lg border text-sm text-gray-700 z-[9999]">
                                      <button onClick={() => duplicateSection((q as Question).id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">Duplicate section</button>
                                      <button onClick={() => moveSectionUp((q as Question).id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">Move up</button>
                                      <button onClick={() => moveSectionDown((q as Question).id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">Move down</button>
                                      <button onClick={() => deleteSectionById((q as Question).id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">Delete section</button>
                                      <button onClick={() => mergeWithAbove((q as Question).id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">Merge with above</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* toolbar for each item - Move functionality removed; hide entirely for section */}
                {(q as Question).type !== 'section' && (q as Question).type !== 'title' && (
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center space-x-3 text-gray-500">
                      <button onClick={() => duplicateQuestion((q as Question).id)} className="p-2 rounded hover:bg-gray-100" title="Duplicate">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <rect x="9" y="9" width="11" height="11" rx="2" ry="2" strokeWidth="1.5" />
                          <rect x="4" y="4" width="11" height="11" rx="2" ry="2" strokeWidth="1.5" />
                        </svg>
                      </button>

                      <button onClick={() => deleteQuestion((q as Question).id)} className="p-2 rounded hover:bg-gray-100" title="Delete">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <span className="text-sm">Required</span>
                        <button
                          onClick={() => toggleRequired((q as Question).id)}
                          className={`w-10 h-6 flex items-center p-1 rounded-full transition-colors ${(((q as any).required) ? "bg-purple-600 justify-end" : "bg-gray-300 justify-start")}`}
                          aria-pressed={(q as any).required}
                        >
                          <span className="w-4 h-4 bg-white rounded-full shadow" />
                        </button>
                      </div>

                      <div className="text-gray-400">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add toolbar buttons for bold, italic, underline, and link */}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AssessmentFormContent />
    </Suspense>
  );
}