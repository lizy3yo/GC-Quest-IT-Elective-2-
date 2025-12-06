"use client";

import { BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Tooltip as InfoTooltip, TooltipContent as InfoTooltipContent, TooltipProvider as InfoTooltipProvider, TooltipTrigger as InfoTooltipTrigger } from '@/components/atoms';

interface DashboardStats {
    totalTeachers: number;
    totalStudents: number;
    totalClasses: number;
    totalAssessments: number;
    totalResources: number;
    programDistribution: { name: string; count: number }[];
    subjectDistribution: { name: string; count: number }[];
    roleDistribution: { name: string; value: number }[];
    userGrowth: { date: string; teacher: number; student: number; parent: number }[];
    recentActivity: { type: 'user' | 'class'; role?: 'teacher' | 'student' | 'parent'; description: string; timestamp: Date }[];
}

interface CoordinatorDashboardProps {
    stats: DashboardStats;
    onCreateTeacher: () => void;
    onCreateStudent: () => void;
    onCreateClass: () => void;
    onManageEmails: () => void;
    userGrowthRange: string;
    onUserGrowthRangeChange: (range: string) => void;
}
const COLORS = ['#C86F26', '#60a5fa', '#a78bfa', '#fbbf24', '#a78bfa', '#f87171'];


export default function CoordinatorDashboard({
    stats,
    onCreateTeacher,
    onCreateStudent,
    onCreateClass,
    onManageEmails,
    userGrowthRange,
    onUserGrowthRangeChange
}: CoordinatorDashboardProps) {
    const totalUsers = stats.roleDistribution.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {totalUsers}
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Classes</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {stats.totalClasses}
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Assessments</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {stats.totalAssessments}
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Resources</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                {stats.totalResources}
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Program Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Classes by Program
                        </h3>
                        <InfoTooltipProvider delayDuration={0}>
                            <InfoTooltip>
                                <InfoTooltipTrigger asChild>
                                    <div className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help rounded-full border border-gray-300 dark:border-gray-600">
                                        <span className="text-xs font-medium">?</span>
                                    </div>
                                </InfoTooltipTrigger>
                                <InfoTooltipContent>
                                    <p className="text-xs max-w-xs">Shows the distribution of classes across different academic programs (e.g., BSIT, BSCS). Helps identify which programs have the most or fewest classes.</p>
                                </InfoTooltipContent>
                            </InfoTooltip>
                        </InfoTooltipProvider>
                    </div>
                    {stats.programDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.programDistribution}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                                <XAxis dataKey="name" className="text-gray-600 dark:text-gray-400" />
                                <YAxis className="text-gray-600 dark:text-gray-400" />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--tooltip-bg, #fff)',
                                        border: '1px solid var(--tooltip-border, #e5e7eb)',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Bar dataKey="count" fill="#059669" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                            No data available
                        </div>
                    )}
                </div>

                {/* User Role Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            User Distribution
                        </h3>
                        <InfoTooltipProvider delayDuration={0}>
                            <InfoTooltip>
                                <InfoTooltipTrigger asChild>
                                    <div className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help rounded-full border border-gray-300 dark:border-gray-600">
                                        <span className="text-xs font-medium">?</span>
                                    </div>
                                </InfoTooltipTrigger>
                                <InfoTooltipContent>
                                    <p className="text-xs max-w-xs">Displays the breakdown of users by role. Orange = Teachers, Blue = Students, Purple = Parents. Shows the overall composition of your user base.</p>
                                </InfoTooltipContent>
                            </InfoTooltip>
                        </InfoTooltipProvider>
                    </div>
                    {stats.roleDistribution.some(r => r.value > 0) ? (
                        <div id="coordinator-pie-chart">
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={stats.roleDistribution}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, value }) => `${name}: ${value}`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {stats.roleDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--tooltip-bg, #fff)',
                                            border: '1px solid var(--tooltip-border, #e5e7eb)',
                                            borderRadius: '0.5rem'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                            No data available
                        </div>
                    )}
                </div>
            </div>

            {/* User Growth Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            User Growth
                        </h3>
                        <InfoTooltipProvider delayDuration={0}>
                            <InfoTooltip>
                                <InfoTooltipTrigger asChild>
                                    <div className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help rounded-full border border-gray-300 dark:border-gray-600">
                                        <span className="text-xs font-medium">?</span>
                                    </div>
                                </InfoTooltipTrigger>
                                <InfoTooltipContent>
                                    <p className="text-xs max-w-xs">Tracks new user registrations over time. Orange = Teachers, Blue = Students, Purple = Parents. Use the dropdown to change the time range.</p>
                                </InfoTooltipContent>
                            </InfoTooltip>
                        </InfoTooltipProvider>
                    </div>
                    <div className="flex items-center gap-2">

                        <select
                            value={userGrowthRange}
                            onChange={(e) => onUserGrowthRangeChange(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                        >
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                            <option value="90d">Last 90 Days</option>
                            <option value="6m">Last 6 Months</option>
                        </select>
                    </div>
                </div>
                {stats.userGrowth.length > 0 ? (
                    <div id="coordinator-area-chart">
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={stats.userGrowth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTeachers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#C86F26" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#C86F26" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorParents" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                                <XAxis
                                    dataKey="date"
                                    className="text-gray-600 dark:text-gray-400"
                                    interval={userGrowthRange === '90d' ? 9 : userGrowthRange === '30d' ? 4 : 'preserveStartEnd'}
                                />
                                <YAxis className="text-gray-600 dark:text-gray-400" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--tooltip-bg, #fff)',
                                        border: '1px solid var(--tooltip-border, #e5e7eb)',
                                        borderRadius: '0.5rem'
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="teacher" name="Teachers" stroke="#C86F26" fill="url(#colorTeachers)" />
                                <Area type="monotone" dataKey="student" name="Students" stroke="#60a5fa" fill="url(#colorStudents)" />
                                <Area type="monotone" dataKey="parent" name="Parents" stroke="#a78bfa" fill="url(#colorParents)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                        No growth data available
                    </div>
                )}
            </div>

            {/* Bottom Row: Recent Activity + Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Recent Activity
                    </h3>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {stats.recentActivity.length > 0 ? (
                            stats.recentActivity.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === 'class'
                                        ? 'bg-emerald-100 dark:bg-emerald-900/20'
                                        : activity.role === 'teacher'
                                            ? 'bg-orange-100 dark:bg-orange-900/20'
                                            : activity.role === 'parent'
                                                ? 'bg-purple-100 dark:bg-purple-900/20'
                                                : 'bg-blue-100 dark:bg-blue-900/20'
                                        }`}>
                                        {activity.type === 'class' ? (
                                            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        ) : activity.role === 'teacher' ? (
                                            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        ) : activity.role === 'parent' ? (
                                            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {activity.type === 'user'
                                                ? `New ${activity.role ? activity.role.charAt(0).toUpperCase() + activity.role.slice(1) : 'User'} Registered`
                                                : 'New class created'}
                                        </p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                            {activity.description}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                            {new Date(activity.timestamp).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                No recent activity
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Quick Actions
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={onCreateTeacher}
                            className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all group"
                        >
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Create Teacher</span>
                        </button>

                        <button
                            onClick={onCreateStudent}
                            className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
                        >
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Create Student</span>
                        </button>

                        <button
                            onClick={onCreateClass}
                            className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group"
                        >
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Create Class</span>
                        </button>

                        <button
                            onClick={onManageEmails}
                            className="flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group"
                        >
                            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Emails</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Top Subjects */}
            {stats.subjectDistribution.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Top Subjects
                    </h3>
                    <div className="space-y-3">
                        {stats.subjectDistribution.map((subject, index) => (
                            <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                                        style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                                        {index + 1}
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white">{subject.name}</span>
                                </div>
                                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                    {subject.count} {subject.count === 1 ? 'class' : 'classes'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
