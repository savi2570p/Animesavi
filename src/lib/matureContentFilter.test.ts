import { it, expect } from 'vitest';
import { filterMatureContent, includeClassification, isHentai } from './matureContentFilter';
it('hides Hentai regardless of capitalization while preserving other genres', () => {
  expect(isHentai({ genres: [' HENTAI '] })).toBe(true);
  expect(filterMatureContent([{ id: 'hidden', genres: ['Hentai'] }, { id: 'visible', genres: ['Romance'] }])).toEqual([{ id: 'visible', genres: ['Romance'] }]);
});
it('also hides episodes, history and favorites joined to Hentai titles', () => {
  expect(filterMatureContent([{ id: 'episode', season: { anime: { genres: ['Hentai'] } } }])).toEqual([]);
  expect(filterMatureContent([{ anime: { genres: ['Hentai'] } }])).toEqual([]);
});
it('adds genre metadata to projected title joins and search results', () => {
  expect(includeClassification('id,title', 'anime')).toBe('id,title,genres');
  expect(includeClassification('id,anime:anime_id(id,title)', 'watch_history')).toBe('id,anime:anime_id(id,title,genres)');
  expect(includeClassification('id,season:seasons(anime:anime(id,title))', 'episodes')).toBe('id,season:seasons(anime:anime(id,title,genres))');
});