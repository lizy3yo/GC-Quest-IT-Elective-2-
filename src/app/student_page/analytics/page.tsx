'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  totalStudySessions: number;
  totalTimeStudied: number; // in minutes
  averageAccuracy: number; // percentage
  streakDays: number;
  cardsStudied: number;
  decksCompleted: number;
  weeklyProgress: Array<{
    day: string;
    sessions: number;
    accuracy: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    accuracy: number;
  }>;
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      // Mock data - replace with actual API call
      const mockData: AnalyticsData = {
        totalStudySessions: 45,
        totalTimeStudied: 720, // 12 hours
        averageAccuracy: 85.5,
        streakDays: 7,
        cardsStudied: 324,
        decksCompleted: 8,
        weeklyProgress: [
          { day: 'Mon', sessions: 3, accuracy: 88 },
          { day: 'Tue', sessions: 2, accuracy: 82 },
          { day: 'Wed', sessions: 4, accuracy: 90 },
          { day: 'Thu', sessions: 1, accuracy: 78 },
          { day: 'Fri', sessions: 5, accuracy: 85 },
          { day: 'Sat', sessions: 3, accuracy: 92 },
          { day: 'Sun', sessions: 2, accuracy: 87 }
        ],
        categoryBreakdown: [
          { category: 'Computer Science', count: 120, accuracy: 88 },
          { category: 'Mathematics', count: 95, accuracy: 82 },
          { category: 'Science', count: 75, accuracy: 90 },
          { category: 'Languages', count: 34, accuracy: 85 }
        ]
      };
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1>Learning Analytics</h1>
        <p>Track your progress and study patterns</p>
        
        <div className="time-range-selector">
          <button 
            className={timeRange === 'week' ? 'active' : ''}
            onClick={() => setTimeRange('week')}
          >
            This Week
          </button>
          <button 
            className={timeRange === 'month' ? 'active' : ''}
            onClick={() => setTimeRange('month')}
          >
            This Month
          </button>
          <button 
            className={timeRange === 'year' ? 'active' : ''}
            onClick={() => setTimeRange('year')}
          >
            This Year
          </button>
        </div>
      </div>

      {analyticsData && (
        <div className="analytics-content">
          {/* Key Metrics */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon">📚</div>
              <div className="metric-content">
                <h3>Study Sessions</h3>
                <p className="metric-value">{analyticsData.totalStudySessions}</p>
                <span className="metric-label">Total sessions</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">⏱️</div>
              <div className="metric-content">
                <h3>Time Studied</h3>
                <p className="metric-value">{formatTime(analyticsData.totalTimeStudied)}</p>
                <span className="metric-label">Total time</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">🎯</div>
              <div className="metric-content">
                <h3>Accuracy</h3>
                <p className="metric-value">{analyticsData.averageAccuracy}%</p>
                <span className="metric-label">Average accuracy</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon">🔥</div>
              <div className="metric-content">
                <h3>Study Streak</h3>
                <p className="metric-value">{analyticsData.streakDays}</p>
                <span className="metric-label">Days in a row</span>
              </div>
            </div>
          </div>

          {/* Weekly Progress Chart */}
          <div className="chart-section">
            <h2>Weekly Progress</h2>
            <div className="chart-container">
              <div className="chart-bars">
                {analyticsData.weeklyProgress.map((day, index) => (
                  <div key={index} className="chart-bar-group">
                    <div className="chart-bar-container">
                      <div 
                        className="chart-bar sessions"
                        style={{ height: `${(day.sessions / 5) * 100}%` }}
                        title={`${day.sessions} sessions`}
                      ></div>
                    </div>
                    <span className="chart-label">{day.day}</span>
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <div className="legend-color sessions"></div>
                  <span>Study Sessions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="category-section">
            <h2>Study Categories</h2>
            <div className="category-list">
              {analyticsData.categoryBreakdown.map((category, index) => (
                <div key={index} className="category-item">
                  <div className="category-info">
                    <h3>{category.category}</h3>
                    <p>{category.count} cards studied</p>
                  </div>
                  <div className="category-stats">
                    <div className="accuracy-badge">
                      {category.accuracy}% accuracy
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill"
                        style={{ width: `${(category.count / Math.max(...analyticsData.categoryBreakdown.map(c => c.count))) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}
