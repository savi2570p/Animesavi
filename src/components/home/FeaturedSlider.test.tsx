import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { FeaturedSlider } from './FeaturedSlider';

const { active, query } = vi.hoisted(() => ({
  active: { value: true },
  query: { select: vi.fn(), eq: vi.fn(), order: vi.fn() },
}));
vi.mock('@/hooks/usePerfTier', () => ({ useActiveOnScreen: () => [() => {}, active.value] }));
vi.mock('@/lib/imageOptimization', () => ({ preloadImages: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => query } }));

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); active.value = true; });

it('advances after exactly three visible seconds and pauses while inactive', async () => {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [
    { anime: { id: '1', title: 'First', genres: [] } },
    { anime: { id: '2', title: 'Second', genres: [] } },
  ] });
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  // Install fake timers before data resolves so the actual carousel interval is controlled.
  vi.useFakeTimers();
  const view = render(<MemoryRouter><FeaturedSlider /></MemoryRouter>);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole('button', { name: 'Show First' }).getAttribute('aria-current')).toBe('true');
  act(() => vi.advanceTimersByTime(2999));
  expect(screen.getByRole('button', { name: 'Show First' }).getAttribute('aria-current')).toBe('true');
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('button', { name: 'Show Second' }).getAttribute('aria-current')).toBe('true');
  active.value = false;
  view.rerender(<MemoryRouter><FeaturedSlider key="inactive" /></MemoryRouter>);
  await act(async () => { await Promise.resolve(); });
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.getByRole('button', { name: 'Show First' }).getAttribute('aria-current')).toBe('true');
});