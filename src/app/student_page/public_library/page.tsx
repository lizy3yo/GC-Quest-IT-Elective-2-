'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
// styles are now included via student.css imported in the layout

interface PublicDeck {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  cardCount: number;
  createdAt: string;
  coverImage?: string;
  author: {
    _id: string;
    username: string;
  };
  studyCount?: number;
  rating?: number;
}

export default function PublicLibrary() {
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'alphabetical'>('popular');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchPublicDecks();
    fetchCategories();
  }, []);

  const fetchPublicDecks = async () => {
    try {
      // Try to get decks with authentication, but don't fail if auth fails
      let response;
      try {
        response = await api.get('/decks/public');
      } catch (authError) {
        console.warn('Authenticated request failed, trying without auth:', authError);
        // Fallback to direct fetch without authentication
        const res = await fetch('/api/v1/decks/public');
        if (res.ok) {
          response = await res.json();
        } else {
          throw new Error('Failed to fetch public decks');
        }
      }
      setDecks(response as PublicDeck[]);
    } catch (error) {
      console.error('Failed to fetch public decks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      // Try to get categories with authentication, but don't fail if auth fails
      let response;
      try {
        response = await api.get('/decks/categories');
      } catch (authError) {
        console.warn('Authenticated request failed, trying without auth:', authError);
        // Fallback to direct fetch without authentication
        const res = await fetch('/api/v1/decks/categories');
        if (res.ok) {
          response = await res.json();
        } else {
          throw new Error('Failed to fetch categories');
        }
      }
      setCategories(response as string[]);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const filteredAndSortedDecks = decks
    .filter(deck => {
      const matchesSearch = deck.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deck.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deck.author.username.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !selectedCategory || deck.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'popular':
        default:
          return (b.studyCount || 0) - (a.studyCount || 0);
      }
    });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div>
          <h1 className="header-title">Public Library</h1>
          <p className="header-description">
            Discover study sets created by the community
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filters-container">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search public sets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="select"
        >
          <option value="">All categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="select"
        >
          <option value="popular">Most popular</option>
          <option value="recent">Recently created</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>

      {/* Popular Categories */}
      {!searchTerm && !selectedCategory && (
        <div className="categories-container">
          <h2 className="categories-title">Popular Categories</h2>
          <div className="categories-grid">
            {categories.slice(0, 8).map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="category-button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {filteredAndSortedDecks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-container">
            <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="empty-title">No sets found</h3>
          <p className="empty-description">
            Try adjusting your search terms or filters
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('');
            }}
            className="clear-button"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="container">
          <div className="results-header">
            <p className="results-count">
              {filteredAndSortedDecks.length} {filteredAndSortedDecks.length === 1 ? 'set' : 'sets'} found
            </p>
            {(searchTerm || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                }}
                className="clear-button"
              >
                Clear filters
              </button>
            )}
          </div>
          
          <div className="results-grid">
            {filteredAndSortedDecks.map((deck) => (
              <PublicDeckCard key={deck._id} deck={deck} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PublicDeckCard({ deck }: { deck: PublicDeck }) {
  const [isStudying, setIsStudying] = useState(false);

  const handleStudy = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsStudying(true);
    try {
      // Copy deck to user's library or start studying directly
      await api.post(`/decks/${deck._id}/study`);
      // Redirect to study mode
      window.location.href = `/student_page/study_mode/${deck._id}`;
    } catch (error) {
      console.error('Failed to start studying:', error);
      setIsStudying(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="deck-card">
      {/* Cover Image or Placeholder */}
      <div className="card-cover">
        {deck.coverImage ? (
          <img src={deck.coverImage} alt={deck.title} />
        ) : (
          <div className="card-cover-placeholder">
            <svg className="card-cover-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        )}
        <div className="card-cover-overlay"></div>
      </div>

      {/* Content */}
      <div className="card-content">
        <Link href={`/student_page/flashcards/${deck._id}`}>
          <h3 className="card-title">
            {deck.title}
          </h3>
        </Link>
        
        {deck.description && (
          <p className="card-description">
            {deck.description}
          </p>
        )}

        <div className="card-meta">
          <span className="card-author">
            <svg className="icon-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {deck.author.username}
          </span>
          <span className="meta-divider">•</span>
          <span>{deck.cardCount} terms</span>
        </div>

        <div className="card-date-row">
          <span>Created {formatDate(deck.createdAt)}</span>
          {deck.studyCount && (
            <span className="study-count">
              <svg className="icon-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              {deck.studyCount} studied
            </span>
          )}
        </div>

        {deck.category && (
          <div>
            <span className="category-tag">
              {deck.category}
            </span>
          </div>
        )}

        <button
          onClick={handleStudy}
          disabled={isStudying}
          className="study-button"
        >
          {isStudying ? (
            <>
              <div className="loading-spinner"></div>
              Starting...
            </>
          ) : (
            <>
              <svg className="icon-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              Study
            </>
          )}
        </button>
      </div>
    </div>
  );
}