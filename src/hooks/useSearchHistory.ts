import { useState, useEffect, useCallback } from 'react';

const SEARCH_HISTORY_KEY = 'anime_search_history';
const MAX_HISTORY_ITEMS = 10;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Load search history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSearchHistory(parsed);
      } catch (e) {
        console.error('Error parsing search history:', e);
        localStorage.removeItem(SEARCH_HISTORY_KEY);
      }
    }
  }, []);

  // Save search history to localStorage
  const saveHistory = useCallback((history: SearchHistoryItem[]) => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    setSearchHistory(history);
  }, []);

  // Add a search query to history
  const addToHistory = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) return;

    setSearchHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter(
        (item) => item.query.toLowerCase() !== trimmedQuery.toLowerCase()
      );

      // Add new item at the beginning
      const newHistory = [
        { query: trimmedQuery, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY_ITEMS);

      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Remove a specific item from history
  const removeFromHistory = useCallback((query: string) => {
    setSearchHistory((prev) => {
      const newHistory = prev.filter(
        (item) => item.query.toLowerCase() !== query.toLowerCase()
      );
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setSearchHistory([]);
  }, []);

  return {
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}