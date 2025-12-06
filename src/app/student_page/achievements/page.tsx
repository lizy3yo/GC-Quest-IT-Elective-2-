"use client";

import "../dashboard/styles.css";
import { useEffect, useMemo, useState } from "react";
import useAuth from "@/hooks/useAuth";
import { useToast } from '@/contexts/ToastContext';
import { useAchievements } from '@/contexts/AchievementContext';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/atoms";

type Achievement = {
    id: number;
    title: string;
    description: string;
    icon: string;
    earned?: boolean;
    earnedDate?: string;
    progress?: number;
    total?: number;
};

export default function AchievementsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [flashcards, setFlashcards] = useState<any[]>([]);
    const [summaries, setSummaries] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [studyStreak, setStudyStreak] = useState<number>(0);
    const [checklist, setChecklist] = useState<Record<string, boolean>>({});
    const { showSuccess, showError } = useToast();
    const [recentCompletions, setRecentCompletions] = useState<any[]>([]);
    const { checkForNewAchievements, showAllUnlocked, resetTracking } = useAchievements();

    // compute streak from activity dates (consecutive days up to today, ending at 11:59 PM each day)
    function computeStreakFromActivities(activities: any[]) {
        try {
            // Collect all study-related activity dates
            const studyDates = new Set<string>();
            
            activities.forEach(a => {
                const type = (a.type || '')?.toString().toLowerCase();
                // Count flashcard sessions, summary reads, and practice test submissions
                if (type.includes('flashcard.study_complete') || 
                    type.includes('summary.read') || 
                    type.includes('practice_test.submit')) {
                    const date = new Date(a.createdAt);
                    // Normalize to start of day (midnight) for comparison
                    date.setHours(0, 0, 0, 0);
                    studyDates.add(date.toISOString());
                }
            });

            // Calculate consecutive days from today backwards
            let streak = 0;
            const now = new Date();
            // Set to start of current day to check if user studied today
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);

            // Check consecutive days going backwards
            for (let i = 0; i < 365; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() - i);
                const key = checkDate.toISOString();
                
                if (studyDates.has(key)) {
                    streak++;
                } else {
                    // If this is day 0 (today) and no activity yet, continue checking yesterday
                    // This prevents breaking streak if user hasn't studied today yet but studied yesterday
                    if (i === 0) continue;
                    break;
                }
            }

            return streak;
        } catch {
            return 0;
        }
    }

    // When flashcards or activities update, compute streak from all study activities
    useEffect(() => {
        const computed = computeStreakFromActivities(activities);
        setStudyStreak(computed);
    }, [activities]);

    // Load checklist from localStorage
    useEffect(() => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem('achievements_checklist') : null;
            if (raw) setChecklist(JSON.parse(raw));
        } catch {}
    }, []);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem('achievements_checklist', JSON.stringify(checklist));
            }
        } catch {}
    }, [checklist]);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            if (!user || !user._id) {
                setLoading(false);
                return;
            }

            const userId = encodeURIComponent(user._id as string);
            const cacheBuster = Date.now(); // Prevent browser caching
            try {
                const [flashcardsRes, summariesRes, activitiesRes] = await Promise.allSettled([
                    fetch(`/api/student_page/flashcard?userId=${userId}&_t=${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
                    fetch(`/api/student_page/summary?userId=${userId}&_t=${cacheBuster}`, { credentials: 'include', cache: 'no-store' }),
                    fetch(`/api/student_page/history?userId=${userId}&limit=200&_t=${cacheBuster}`, { credentials: 'include', cache: 'no-store' })
                ]);

                if (mounted) {
                    if (flashcardsRes.status === 'fulfilled' && flashcardsRes.value.ok) {
                        const data = await flashcardsRes.value.json().catch(() => null);
                        setFlashcards(Array.isArray(data?.flashcards) ? data.flashcards : []);
                    } else {
                        setFlashcards([]);
                    }

                    if (summariesRes.status === 'fulfilled' && summariesRes.value.ok) {
                        const data = await summariesRes.value.json().catch(() => null);
                        setSummaries(Array.isArray(data?.summaries) ? data.summaries : []);
                    } else {
                        setSummaries([]);
                    }

                    if (activitiesRes.status === 'fulfilled' && activitiesRes.value.ok) {
                        const data = await activitiesRes.value.json().catch(() => null);
                        const acts = Array.isArray(data?.activities) ? data.activities : [];
                        console.log('📊 Activities loaded:', acts.length, 'activities');
                        console.log('📊 Activity types:', acts.map((a: any) => a.type || a.action).filter(Boolean));
                        console.log('📊 Full activities data:', acts);
                        console.log('📊 User ID used for query:', userId);
                        setActivities(acts);
                    } else {
                        console.error('❌ Failed to fetch activities:', activitiesRes.status === 'fulfilled' ? activitiesRes.value.status : 'rejected');
                        if (activitiesRes.status === 'fulfilled') {
                            const errorText = await activitiesRes.value.text().catch(() => 'Unable to read error');
                            console.error('❌ Error response:', errorText);
                        }
                        setActivities([]);
                    }
                    
                }
            } catch (err) {
                console.warn('Failed to load achievements data', err);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();

        // Refresh when user returns to the tab or when other tabs broadcast activity updates.
        let bc: BroadcastChannel | null = null;
        const visibilityHandler = () => { if (document.visibilityState === 'visible') load(); };
        const focusHandler = () => { load(); };

                try {
                    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                        const BC = (window as any).BroadcastChannel;
                        if (typeof BC === 'function') {
                            const instance = new BC('notewise.activities');
                            bc = instance;
                            instance.onmessage = () => { load(); };
                        }
                    }
                } catch (e) {
            bc = null;
        }

        window.addEventListener('visibilitychange', visibilityHandler);
        window.addEventListener('focus', focusHandler);

        return () => {
            mounted = false;
            window.removeEventListener('visibilitychange', visibilityHandler);
            window.removeEventListener('focus', focusHandler);
            try { if (bc) bc.close(); } catch (e) {}
        };
    }, [user]);

    // Derived metrics
    const totalFlashcards = useMemo(() => flashcards.length, [flashcards]);
    const totalSummaries = useMemo(() => summaries.length, [summaries]);

    // cardsReviewed: number of individual cards reviewed across all flashcard sets.
    // Prefer server-side repetitionCount on flashcard docs; fall back to summing activity meta values.
    const cardsReviewed = useMemo(() => {
        const sum = flashcards.reduce((s, fc) => s + (Number(fc.repetitionCount) || 0), 0);
        if (sum > 0) return sum;

        try {
            const actSum = (activities || []).reduce((s, a) => {
                const t = (a.type || a.action || '')?.toString().toLowerCase();
                if (t.includes('flashcard.study_complete')) {
                    // activity meta may include several possible numeric fields
                    if (typeof a.meta?.cardsStudied === 'number') return s + a.meta.cardsStudied;
                    if (typeof a.meta?.cardCount === 'number') return s + a.meta.cardCount;
                    if (Array.isArray(a.meta?.cardIds)) return s + a.meta.cardIds.length;
                    if (typeof a.meta?.total === 'number') return s + a.meta.total;
                    if (typeof a.progress === 'number') return s + a.progress;
                    // otherwise count the event as 1 card reviewed
                    return s + 1;
                }
                return s;
            }, 0);
            return actSum;
        } catch (e) {
            return 0;
        }
    }, [flashcards, activities]);

    // studySessionsCompleted: number of flashcard study sessions (i.e., sets completed)
    const studySessionsCompleted = useMemo(() => {
        try {
            const count = (activities || []).filter(a => {
                const t = (a.type || a.action || '')?.toString().toLowerCase();
                return t.includes('flashcard.study_complete');
            }).length;
            console.log('📚 Flashcard sessions completed:', count);
            return count;
        } catch (e) {
            return 0;
        }
    }, [activities]);

    // favoritesStudied: how many sessions studied favorites flag was true
    const favoritesStudied = useMemo(() => {
        try {
            return (activities || []).filter(a => {
                const t = (a.type || a.action || '')?.toString().toLowerCase();
                return t.includes('flashcard.study_complete') && !!a.meta?.studiedFavorites;
            }).length;
        } catch (e) {
            return 0;
        }
    }, [activities]);

    // Practice tests completed: count of practice_test.submit activities
    const practiceTestsCompleted = useMemo(() => {
        try {
            const count = (activities || []).filter(a => {
                const t = (a.type || a.action || '')?.toString().toLowerCase();
                return t.includes('practice_test.submit') || t.includes('practice_test.completed') || t.includes('test.submit');
            }).length;
            console.log('✅ Practice tests completed:', count);
            return count;
        } catch (e) {
            return 0;
        }
    }, [activities]);

    // summarySessionsCompleted: count of summary "read" activities
    const summarySessionsCompleted = useMemo(() => {
        try {
            const count = (activities || []).filter(a => {
                const t = (a.type || a.action || '')?.toString().toLowerCase();
                return t.includes('summary.read') || t.includes('summary.session') || t.includes('summary.completed');
            }).length;
            console.log('📖 Summary sessions completed:', count);
            return count;
        } catch (e) {
            return 0;
        }
    }, [activities]);

    // small sparkline data: count flashcards lastReviewed per day for last 7 days
    const sparkline = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setHours(0,0,0,0);
            d.setDate(d.getDate() - (6 - i));
            return d;
        });
        const counts = days.map(() => 0);
        flashcards.forEach(fc => {
            if (!fc.lastReviewed) return;
            const lr = new Date(fc.lastReviewed);
            lr.setHours(0,0,0,0);
            for (let i = 0; i < days.length; i++) {
                if (lr.getTime() === days[i].getTime()) counts[i]++;
            }
        });
        return counts;
    }, [flashcards]);

    // Achievements list derived from real data where possible
    const achievements: Achievement[] = useMemo(() => {
        const finishedSets = flashcards.filter((f) => f.lastReviewed).length;
        const totalCards = flashcards.reduce((sum, f) => sum + (Array.isArray(f.cards) ? f.cards.length : 0), 0);
        const weeklyReviews = sparkline.reduce((s, n) => s + n, 0);
        const recentCount = recentCompletions.length;

        // Use precomputed session/card metrics
        const studyCompletions = studySessionsCompleted;

        const a: Achievement[] = [
            { id: 1, title: 'First Steps', description: 'Created your first flashcard set', icon: '🎯', earned: totalFlashcards >= 1 },
            { id: 2, title: 'Study Streak', description: 'Studied for 7 days in a row', icon: '🔥', earned: studyStreak >= 7, progress: studyStreak, total: 7 },
            { id: 3, title: 'Knowledge Master', description: 'Created 10 flashcard sets', icon: '🏆', progress: totalFlashcards, total: 10, earned: totalFlashcards >= 10 },
            { id: 4, title: 'Perfect Score', description: 'Got 100% on a practice test', icon: '⭐', progress: practiceTestsCompleted, total: 1, earned: practiceTestsCompleted >= 1 },
            { id: 5, title: 'Deck Finisher', description: 'Complete 5 study sessions', icon: '🏁', progress: studyCompletions, total: 5, earned: studyCompletions >= 5 },
            { id: 6, title: 'Streak Holder', description: 'Keep a study streak for 14 days', icon: '📅', progress: studyStreak, total: 14, earned: studyStreak >= 14 },

            // additional achievements (7-20)
            { id: 7, title: 'Flashcard Novice', description: 'Create 3 flashcard sets', icon: '📚', progress: totalFlashcards, total: 3, earned: totalFlashcards >= 3 },
            { id: 8, title: 'Flashcard Collector', description: 'Create 25 flashcard sets', icon: '🧩', progress: totalFlashcards, total: 25, earned: totalFlashcards >= 25 },
            { id: 9, title: 'Summary Starter', description: 'Read your first summary', icon: '✍️', progress: summarySessionsCompleted, total: 1, earned: summarySessionsCompleted >= 1 },
            { id: 10, title: 'Summary Scholar', description: 'Read 5 summaries', icon: '📖', progress: summarySessionsCompleted, total: 5, earned: summarySessionsCompleted >= 5 },
            { id: 11, title: 'Review Apprentice', description: 'Review 50 cards', icon: '🔁', progress: cardsReviewed, total: 50, earned: cardsReviewed >= 50 },
            { id: 12, title: 'Review Pro', description: 'Review 200 cards', icon: '⚡', progress: cardsReviewed, total: 200, earned: cardsReviewed >= 200 },
            { id: 13, title: 'Marathoner', description: 'Study streak of 30 days', icon: '🏃‍♀️', progress: studyStreak, total: 30, earned: studyStreak >= 30 },
            { id: 14, title: 'Active Week', description: 'Study 7 times in the last 7 days', icon: '📆', progress: weeklyReviews, total: 7, earned: weeklyReviews >= 7 },
            { id: 15, title: 'Session Master', description: 'Complete 10 study sessions', icon: '🎓', progress: studyCompletions, total: 10, earned: studyCompletions >= 10 },
            { id: 16, title: 'Card Collector', description: 'Add 100 cards total', icon: '🃏', progress: totalCards, total: 100, earned: totalCards >= 100 },
            { id: 17, title: 'Card Hoarder', description: 'Add 500 cards total', icon: '📦', progress: totalCards, total: 500, earned: totalCards >= 500 },
            { id: 18, title: 'Favorites Fan', description: 'Study favorites 3 times', icon: '⭐', progress: favoritesStudied, total: 3, earned: favoritesStudied >= 3 },
            { id: 19, title: 'Centurion', description: 'Create 100 flashcard sets', icon: '💯', progress: totalFlashcards, total: 100, earned: totalFlashcards >= 100 },
            { id: 20, title: 'Study Champion', description: 'Complete 50 study sessions', icon: '🏅', progress: studyCompletions, total: 50, earned: studyCompletions >= 50 }
        ];
        return a;
    }, [flashcards, totalFlashcards, totalSummaries, cardsReviewed, practiceTestsCompleted, studyStreak, recentCompletions, sparkline, activities, studySessionsCompleted, summarySessionsCompleted, favoritesStudied]);

    const earnedCount = achievements.filter(a => a.earned).length;

    // Show unlocked/earned achievements first
    const sortedAchievements = useMemo(() => {
        return [...achievements].sort((a, b) => {
            const aEarn = a.earned ? 1 : 0;
            const bEarn = b.earned ? 1 : 0;
            if (bEarn !== aEarn) return bEarn - aEarn; // earned first
            // secondary sort: progress percent desc
            const aPct = (a.progress ?? 0) / (a.total ?? 1);
            const bPct = (b.progress ?? 0) / (b.total ?? 1);
            return bPct - aPct;
        });
    }, [achievements]);

    const unlocked = useMemo(() => sortedAchievements.filter(a => a.earned), [sortedAchievements]);
    const locked = useMemo(() => sortedAchievements.filter(a => !a.earned), [sortedAchievements]);

    // Check for newly unlocked achievements using the global context
    useEffect(() => {
        checkForNewAchievements(achievements);
    }, [achievements, checkForNewAchievements]);

    function toggleChecklist(key: string) {
        setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    }

    // helper: update local streak when user finishes any study activity
    // Note: This is a fallback for localStorage-based streak tracking
    // The actual streak is now computed from activities in computeStreakFromActivities()
    function updateStreakOnFinish() {
        try {
            if (typeof window === 'undefined') return;
            const keyDate = 'studyLastFinishedDate';
            const keyStreak = 'studyStreak';
            const rawLast = localStorage.getItem(keyDate);
            
            // Current date/time
            const now = new Date();
            // Start of today (12:00 AM)
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString();

            let streak = 0;
            const rawStreak = localStorage.getItem(keyStreak);
            if (rawStreak) streak = Number(rawStreak) || 0;

            if (rawLast) {
                const last = new Date(rawLast);
                last.setHours(0, 0, 0, 0);
                const diff = Math.round((today.getTime() - last.getTime()) / (1000*60*60*24));
                if (diff === 0) {
                    // already studied today: no change to streak
                } else if (diff === 1) {
                    // studied yesterday, increment streak
                    streak = streak + 1;
                } else {
                    // gap in days, reset streak to 1
                    streak = 1;
                }
            } else {
                // first time studying
                streak = 1;
            }

            localStorage.setItem(keyDate, todayStr);
            localStorage.setItem(keyStreak, String(streak));
            setStudyStreak(streak);
            return streak;
        } catch (err) {
            return studyStreak;
        }
    }

    async function markSetFinished(flashcard: any) {
        if (!user || !user._id) {
            showError('You must be signed in to mark a set finished');
            return;
        }

        const confirm = window.confirm(`Mark "${flashcard.title || 'this set'}" as finished? This will mark all ${flashcard.cards?.length || 0} cards as mastered.`);
        if (!confirm) return;

        const userId = encodeURIComponent(user._id as string);
        const fcId = flashcard._id;
        const masteredIds = Array.isArray(flashcard.cards) ? flashcard.cards.map((c: any) => c._id) : [];
        const body = {
            learn: { masteredIds, currentIndex: 0 },
            sessionQueue: [],
            viewerPos: 0,
            lastSessionStartedAt: new Date().toISOString()
        };

        try {
            // Prevent double-marking: check existing StudyProgress completion first
            try {
                const progRes = await fetch(`/api/student_page/flashcard/${fcId}/progress?userId=${userId}`, { credentials: 'include' });
                if (progRes.ok) {
                    const progJson = await progRes.json().catch(() => null);
                    const prog = progJson?.progress || progJson;
                    const existingCompletedAt = prog?.completion?.completedAt || prog?.lastSessionStartedAt || null;
                    if (prog?.completion?.showCompletion || existingCompletedAt) {
                        // Already recorded a completion for this flashcard; avoid sending another PATCH
                        showSuccess(`"${flashcard.title || 'set'}" is already marked finished`);
                        // update local UI from server to reflect current state
                        try {
                            const refreshed = await fetch(`/api/student_page/flashcard?userId=${userId}`, { credentials: 'include' });
                            if (refreshed.ok) {
                                const json = await refreshed.json().catch(() => null);
                                setFlashcards(Array.isArray(json?.flashcards) ? json.flashcards : []);
                            }
                        } catch (e) {
                            // ignore
                        }
                        const newStreak = updateStreakOnFinish();
                        return;
                    }
                }
            } catch (e) {
                // if progress check fails, proceed with PATCH as before
                console.warn('Progress check failed, will attempt to mark finished', e);
            }

            const res = await fetch(`/api/student_page/flashcard/${fcId}/progress?userId=${userId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(body)
                });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);

            // update local UI: re-fetch flashcards from server to ensure persistence across sessions
            try {
                const refreshed = await fetch(`/api/student_page/flashcard?userId=${userId}`, { credentials: 'include' });
                if (refreshed.ok) {
                    const json = await refreshed.json().catch(() => null);
                    setFlashcards(Array.isArray(json?.flashcards) ? json.flashcards : []);
                } else {
                    // fallback: optimistic update
                    const now = new Date().toISOString();
                    setFlashcards(prev => prev.map(f => f._id === fcId ? { ...f, lastReviewed: now, repetitionCount: (Number(f.repetitionCount) || 0) + 1 } : f));
                }
            } catch (err) {
                const now = new Date().toISOString();
                setFlashcards(prev => prev.map(f => f._id === fcId ? { ...f, lastReviewed: now, repetitionCount: (Number(f.repetitionCount) || 0) + 1 } : f));
            }

            const newStreak = updateStreakOnFinish();
            showSuccess(`Marked "${flashcard.title || 'set'}" as finished — streak: ${newStreak} days`);
        } catch (err: unknown) {
            console.warn('Failed to mark set finished', err);
            showError('Failed to mark set finished');
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
                <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
                    {/* Header Card Skeleton */}
                    <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
                        <div className="animate-pulse">
                            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-3"></div>
                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
                        </div>
                    </div>
                    
                    {/* Progress Stats Skeleton */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 mb-8 animate-pulse">
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-6"></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="text-center p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto mb-2"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 mx-auto"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Achievements Grid Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                                    <div className="flex-1">
                                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
            <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
                {/* Header Card - matching student profile style */}
                <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
                    
                    <div className="relative flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                                Achievements
                            </h1>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">
                                Track your learning milestones and celebrate your progress
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    console.log('🎉 MANUALLY SHOWING ALL UNLOCKED ACHIEVEMENTS');
                                    showAllUnlocked(achievements);
                                }}
                                className="px-4 py-2 bg-[#2E7D32] hover:brightness-110 text-white text-sm font-semibold rounded-lg transition-all"
                                title="Show all unlocked achievements"
                            >
                                🎊 Show All
                            </button>
                            <button
                                onClick={() => {
                                    console.log('🔄 RESETTING TRACKING');
                                    resetTracking();
                                    showSuccess('Reset complete! Refresh to see all achievements again.');
                                }}
                                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                title="Reset achievement tracking"
                            >
                                🔄 Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Your Progress - moved to top-most position */}
                <div className="mb-6 sm:mb-8">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">Your Progress</h2>
                            <TooltipProvider delayDuration={0}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
                                <div className="relative text-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg group">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                                                <span className="text-xs">?</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">Tracks completed flashcard study sessions</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{studySessionsCompleted}</div>
                                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Flashcards</div>
                                </div>

                                <div className="relative text-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg group">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                                                <span className="text-xs">?</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">Tracks completed summary reading sessions</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">{summarySessionsCompleted}</div>
                                        <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Summaries</div>
                                </div>

                                <div className="relative text-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg group">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                                                <span className="text-xs">?</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">Tracks submitted practice tests</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="text-2xl sm:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{practiceTestsCompleted}</div>
                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Practice tests</div>
                                </div>

                                <div className="relative text-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg group">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                                                <span className="text-xs">?</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">Percentage of achievements unlocked</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{Math.round((earnedCount / (achievements.length || 1)) * 100)}%</div>
                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Completion %</div>
                                </div>

                                <div className="relative text-center p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg group">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                                                <span className="text-xs">?</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">Consecutive days with study activity (flashcards, summaries, or practice tests)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400 mb-1">{studyStreak}d</div>
                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Study streak</div>
                                </div>
                            </div>
                            </TooltipProvider>
                        </div>
                    </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3">
                        {/* Unlocked achievements */}
                        {unlocked.length > 0 && (
                            <div className="mb-6 sm:mb-8">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Unlocked</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                                    {unlocked.map((achievement) => (
                                        <div key={achievement.id} className={`rounded-xl shadow-sm border p-4 sm:p-6 transition-all hover:shadow-lg hover:-translate-y-1 ${achievement.earned ? 'border-[#2E7D32] dark:border-[#04C40A] bg-[#E8F5E9] dark:bg-[#1C2B1C]' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                                            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                                                <div className={`text-3xl sm:text-4xl flex-shrink-0 ${achievement.earned ? 'grayscale-0' : 'grayscale opacity-50'}`}>{achievement.icon}</div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className={`text-base sm:text-lg font-semibold mb-2 ${achievement.earned ? 'text-gray-900 dark:text-[#04C40A]' : 'text-gray-900 dark:text-white'}`}>{achievement.title}</h3>
                                                    <p className={`text-xs sm:text-sm mb-3 leading-relaxed ${achievement.earned ? 'text-gray-600 dark:text-[#04C40A]' : 'text-gray-600 dark:text-gray-400'}`}>{achievement.description}</p>
                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                        <span className="text-xs font-medium text-[#2E7D32] dark:text-[#04C40A]">✓ Earned</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Locked achievements are rendered at the bottom of the page */}

                        {/* 'Your Decks' removed per user request */}

                        {/* 'Your Progress' moved to top of the page */}
                    </div>
                </div>

                {/* Locked achievements placed at the bottom-most part of the page */}
                {locked.length > 0 && (
                    <div className="mb-6 sm:mb-8">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Locked Achievements</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                                {locked.map((achievement) => (
                                    <div key={achievement.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 sm:p-6 transition-all hover:shadow-lg hover:-translate-y-1 border-gray-200 dark:border-gray-700`}>
                                        <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                                            <div className={`text-3xl sm:text-4xl flex-shrink-0 grayscale opacity-50`}>{achievement.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text-base sm:text-lg font-semibold mb-2 text-gray-900 dark:text-white`}>{achievement.title}</h3>
                                                <p className={`text-xs sm:text-sm mb-3 leading-relaxed text-gray-600 dark:text-gray-400`}>{achievement.description}</p>
                                                <div>
                                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                        <span>Progress</span>
                                                        <span>{achievement.progress ?? 0}/{achievement.total ?? '-'}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                        <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((achievement.progress ?? 0) / (achievement.total ?? 1)) * 100}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}