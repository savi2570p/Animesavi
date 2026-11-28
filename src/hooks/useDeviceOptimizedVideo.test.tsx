import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useDeviceOptimizedVideo } from './useDeviceOptimizedVideo';

const { query, from } = vi.hoisted(() => {
  const query = {
    select: vi.fn(), eq: vi.fn(), abortSignal: vi.fn(), maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.abortSignal.mockReturnValue(query);
  return { query, from: vi.fn(() => query) };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));

afterEach(() => vi.clearAllMocks());

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

it('reuses resolved media across manual server switches', async () => {
  query.maybeSingle.mockResolvedValue({ data: { original_url: 'dub.mp4', hls_url: 'dub.m3u8', status: 'completed' }, error: null });
  const { client, wrapper } = setup();
  const first = renderHook(() => useDeviceOptimizedVideo('ep1', 'dub.mp4'), { wrapper });
  await waitFor(() => expect(first.result.current.videoUrl).toBe('dub.m3u8'));
  first.unmount();
  const second = renderHook(() => useDeviceOptimizedVideo('ep1', 'dub.mp4'), { wrapper });
  expect(second.result.current.videoUrl).toBe('dub.m3u8');
  expect(from).toHaveBeenCalledTimes(1);
  second.unmount(); client.clear();
});

it('does not reuse the primary conversion for an alternate SUB file', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  const { client, wrapper } = setup();
  const hook = renderHook(() => useDeviceOptimizedVideo('ep1', 'sub.mp4'), { wrapper });
  await waitFor(() => expect(query.eq).toHaveBeenCalledWith('original_url', 'sub.mp4'));
  expect(hook.result.current.videoUrl).toBe('sub.mp4');
  hook.unmount(); client.clear();
});

it('starts a new episode with its own file even while its lookup is pending', async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: { hls_url: 'one.m3u8', status: 'completed' }, error: null });
  const { client, wrapper } = setup();
  const hook = renderHook(({ id, url }) => useDeviceOptimizedVideo(id, url), { initialProps: { id: 'one', url: 'one.mp4' }, wrapper });
  await waitFor(() => expect(hook.result.current.videoUrl).toBe('one.m3u8'));
  query.maybeSingle.mockReturnValueOnce(new Promise(() => {}));
  hook.rerender({ id: 'two', url: 'two.mp4' });
  expect(hook.result.current.videoUrl).toBe('two.mp4');
  hook.unmount(); client.clear();
});