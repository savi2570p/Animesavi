export type CommentSortMode = 'newest' | 'oldest' | 'most_liked';

interface SortableComment { created_at: string; likes?: number; dislikes?: number }

/** Sorts already-loaded top-level comments in memory, so changing the sort never refetches the page. */
export function sortComments<T extends SortableComment>(comments: T[], mode: CommentSortMode): T[] {
  const score = (c: T) => (c.likes || 0) - (c.dislikes || 0);
  const time = (c: T) => new Date(c.created_at).getTime();
  const list = [...comments];
  if (mode === 'most_liked') list.sort((a, b) => score(b) - score(a) || time(b) - time(a));
  else if (mode === 'oldest') list.sort((a, b) => time(a) - time(b));
  else list.sort((a, b) => time(b) - time(a));
  return list;
}
