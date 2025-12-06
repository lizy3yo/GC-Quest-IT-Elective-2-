/**
 * ORGANISM: DashboardStats
 * Generic dashboard statistics display
 */

import React from 'react';

interface StatItem {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}

interface DashboardStatsProps {
  stats: StatItem[];
  className?: string;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  stats,
  className = ''
}) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-lg shadow p-6">
          {stat.icon && <div className="mb-4">{stat.icon}</div>}
          {stat.color && !stat.icon && (
            <div className={`w-12 h-12 ${stat.color} rounded-lg mb-4`} />
          )}
          <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
          <p className="text-sm text-gray-600">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};
