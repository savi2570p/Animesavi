import { describe, it, expect } from 'vitest';
import { sortComments } from './commentSort';

const comments = [
  { id: 'a', created_at: '2026-11-01T10:00:00Z', likes: 1, dislikes: 0 },
  { id: 'b', created_at: '2026-11-03T10:00:00Z', likes: 0, dislikes: 2 },
  { id: 'c', created_at: '2026-11-02T10:00:00Z', likes: 5, dislikes: 1 },
];
const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe('comment sorting', () => {
  it('Newest puts the latest comment first', () => expect(ids(sortComments(comments, 'newest'))).toEqual(['b', 'c', 'a']));
  it('Oldest puts the earliest comment first', () => expect(ids(sortComments(comments, 'oldest'))).toEqual(['a', 'c', 'b']));
  it('Top ranks by likes minus dislikes', () => expect(ids(sortComments(comments, 'most_liked'))).toEqual(['c', 'a', 'b']));
  it('does not mutate the loaded list', () => { sortComments(comments, 'oldest'); expect(ids(comments)).toEqual(['a', 'b', 'c']); });
});
