/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { authenticate } from '@/lib/middleware/authenticate';
import { authorize } from '@/lib/middleware/authorize';
import Submission from '@/models/submission';
import Assessment from '@/models/assessment';
import Class from '@/models/class';
import User from '@/models/user';
import { cache, cacheKeys, CACHE_TTL, cacheTags } from '@/lib/cache';

interface AssessmentStat {
    assessmentId: string;
    title: string;
    classId: string;
    className: string;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    submissionCount: number;
    totalStudents: number;
}

interface StudentRisk {
    studentId: string;
    studentName: string;
    email: string;
    averageScore: number;
    missedAssignments: number;
    lastActive: string | null;
    classes: string[];
}

interface EngagementData {
    date: string;
    activeStudents: number;
    submissions: number;
}

interface PerformanceTrend {
    period: string;
    averageScore: number;
    submissionCount: number;
}

/**
 * GET /api/teacher_page/analytics/detailed
 * Get detailed analytics including trends, at-risk students, and engagement
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await authenticate(request);
        if (authResult instanceof Response) {
            return authResult;
        }

        const authzResult = await authorize(authResult.userId, ['teacher']);
        if (authzResult !== true) {
            return authzResult as Response;
        }

        const { searchParams } = new URL(request.url);
        const classFilter = searchParams.get('classId');
        const days = parseInt(searchParams.get('days') || '30');

        // Check cache first
        const cacheKey = `${cacheKeys.analytics(authResult.userId.toString(), `${days}d`)}:${classFilter || 'all'}`;
        const cachedData = cache.get<any>(cacheKey);
        if (cachedData) {
            return NextResponse.json({
                success: true,
                data: cachedData,
                cached: true
            });
        }

        await connectToDatabase();

        // Get all classes for this teacher
        const classQuery: any = {
            teacherId: authResult.userId.toString(),
            isActive: true
        };
        if (classFilter) {
            classQuery._id = classFilter;
        }

        const classes = await Class.find(classQuery)
            .select('_id subject courseYear students')
            .lean();

        const classIds = classes.map((c: any) => c._id.toString());
        const classMap = new Map(
            classes.map((c: any) => [c._id.toString(), `${c.subject} - ${c.courseYear}`])
        );

        // Collect all unique student IDs
        const allStudentIds = new Set<string>();
        for (const cls of classes) {
            ((cls as any).students || []).forEach((s: any) => {
                const id = s.studentId || s;
                allStudentIds.add(id.toString());
            });
        }

        // Get all assessments for these classes
        const assessments = await Assessment.find({
            teacherId: authResult.userId.toString(),
            classId: { $in: classIds }
        }).select('_id title classId').lean();

        const assessmentIds = assessments.map((a: any) => a._id);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

        // ========== 1. ASSESSMENT COMPARISON ==========
        const assessmentStats: AssessmentStat[] = await Promise.all(
            assessments.map(async (assessment: any) => {
                const submissions = await Submission.find({
                    assessmentId: assessment._id,
                    status: 'graded',
                    score: { $exists: true, $ne: null }
                }).select('score maxScore').lean();

                const scores = submissions.map((s: any) => {
                    const max = s.maxScore || 100;
                    return (s.score / max) * 100;
                });

                const cls = classes.find((c: any) => c._id.toString() === assessment.classId?.toString());
                const totalStudents = ((cls as any)?.students || []).length;

                return {
                    assessmentId: assessment._id.toString(),
                    title: assessment.title,
                    classId: assessment.classId?.toString() || '',
                    className: classMap.get(assessment.classId?.toString() || '') || 'Unknown',
                    averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
                    highestScore: scores.length > 0 ? Math.round(Math.max(...scores)) : 0,
                    lowestScore: scores.length > 0 ? Math.round(Math.min(...scores)) : 0,
                    submissionCount: submissions.length,
                    totalStudents
                };
            })
        );

        // ========== 2. AT-RISK STUDENTS ==========
        const studentPerformance = new Map<string, {
            scores: number[];
            missed: number;
            lastSubmission: Date | null;
            classes: Set<string>;
        }>();

        // Initialize all students
        for (const cls of classes) {
            const className = classMap.get((cls as any)._id.toString()) || '';
            for (const student of ((cls as any).students || [])) {
                const studentId = (student.studentId || student).toString();
                if (!studentPerformance.has(studentId)) {
                    studentPerformance.set(studentId, {
                        scores: [],
                        missed: 0,
                        lastSubmission: null,
                        classes: new Set()
                    });
                }
                studentPerformance.get(studentId)!.classes.add(className);
            }
        }

        // Get all submissions to calculate performance
        const allSubmissions = await Submission.find({
            assessmentId: { $in: assessmentIds },
            status: 'graded'
        }).select('studentId score maxScore createdAt').lean();

        for (const sub of allSubmissions) {
            const studentId = (sub as any).studentId?.toString();
            if (studentId && studentPerformance.has(studentId)) {
                const perf = studentPerformance.get(studentId)!;
                const score = ((sub as any).score / ((sub as any).maxScore || 100)) * 100;
                perf.scores.push(score);
                const subDate = new Date((sub as any).createdAt);
                if (!perf.lastSubmission || subDate > perf.lastSubmission) {
                    perf.lastSubmission = subDate;
                }
            }
        }

        // Get student details
        const studentIds = Array.from(allStudentIds);
        const students = await User.find({
            _id: { $in: studentIds }
        }).select('_id firstName lastName email').lean();

        const studentDetailsMap = new Map<string, { firstName?: string; lastName?: string; email?: string }>(
            students.map((s: any) => [s._id.toString(), s])
        );

        // Build at-risk list (average < 70% or no activity in 7+ days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const atRiskStudents: StudentRisk[] = [];

        for (const [studentId, perf] of studentPerformance) {
            const avg = perf.scores.length > 0
                ? perf.scores.reduce((a, b) => a + b, 0) / perf.scores.length
                : 0;

            const isInactive = !perf.lastSubmission || perf.lastSubmission < sevenDaysAgo;
            const isLowPerforming = avg < 70;

            if (isInactive || isLowPerforming) {
                const details = studentDetailsMap.get(studentId);
                atRiskStudents.push({
                    studentId,
                    studentName: details
                        ? `${details.firstName || ''} ${details.lastName || ''}`.trim() || 'Unknown'
                        : 'Unknown Student',
                    email: details?.email || '',
                    averageScore: Math.round(avg),
                    missedAssignments: assessments.length - perf.scores.length,
                    lastActive: perf.lastSubmission?.toISOString() || null,
                    classes: Array.from(perf.classes)
                });
            }
        }

        // Sort by average score (lowest first)
        atRiskStudents.sort((a, b) => a.averageScore - b.averageScore);

        // ========== 3. ENGAGEMENT DATA (last N days) ==========
        const engagementData: EngagementData[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(endDate.getTime() - i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));

            const dailySubmissions = await Submission.find({
                assessmentId: { $in: assessmentIds },
                createdAt: { $gte: dayStart, $lte: dayEnd }
            }).select('studentId').lean();

            const uniqueStudents = new Set(dailySubmissions.map((s: any) => s.studentId?.toString())).size;

            engagementData.push({
                date: dayStart.toISOString().split('T')[0],
                activeStudents: uniqueStudents,
                submissions: dailySubmissions.length
            });
        }

        // ========== 4. PERFORMANCE TRENDS (weekly) ==========
        const performanceTrends: PerformanceTrend[] = [];
        const weeksToShow = Math.ceil(days / 7);

        for (let w = weeksToShow - 1; w >= 0; w--) {
            const weekEnd = new Date(endDate.getTime() - w * 7 * 24 * 60 * 60 * 1000);
            const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

            const weekSubmissions = await Submission.find({
                assessmentId: { $in: assessmentIds },
                status: 'graded',
                createdAt: { $gte: weekStart, $lte: weekEnd }
            }).select('score maxScore').lean();

            const scores = weekSubmissions.map((s: any) => {
                return ((s as any).score / ((s as any).maxScore || 100)) * 100;
            });

            performanceTrends.push({
                period: `Week ${weeksToShow - w}`,
                averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
                submissionCount: weekSubmissions.length
            });
        }

        // ========== 5. GRADE DISTRIBUTION ==========
        const gradeDistribution = {
            excellent: 0,
            good: 0,
            satisfactory: 0,
            needsImprovement: 0
        };

        for (const sub of allSubmissions) {
            const score = ((sub as any).score / ((sub as any).maxScore || 100)) * 100;
            if (score >= 90) {
                gradeDistribution.excellent++;
            } else if (score >= 80) {
                gradeDistribution.good++;
            } else if (score >= 70) {
                gradeDistribution.satisfactory++;
            } else {
                gradeDistribution.needsImprovement++;
            }
        }

        const analyticsData = {
            assessmentStats: assessmentStats.slice(0, 20),
            atRiskStudents: atRiskStudents.slice(0, 20),
            engagementData,
            performanceTrends,
            gradeDistribution,
            summary: {
                totalClasses: classes.length,
                totalStudents: allStudentIds.size,
                totalAssessments: assessments.length,
                atRiskCount: atRiskStudents.length
            }
        };

        // Cache for 5 minutes
        cache.set(cacheKey, analyticsData, {
            ttl: CACHE_TTL.MEDIUM,
            tags: [cacheTags.analytics, cacheTags.user(authResult.userId.toString())]
        });

        return NextResponse.json({
            success: true,
            data: analyticsData,
            cached: false
        });

    } catch (error) {
        console.error('Error fetching detailed analytics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
