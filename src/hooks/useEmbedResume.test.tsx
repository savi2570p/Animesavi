import { useRef } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { useEmbedResume } from './useEmbedResume';
import { safeStorage } from '@/lib/storage/safeStorage';

function Player({ id = 'resume-flow', src = 'movie.mp4' }: { id?: string; src?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEmbedResume(ref, id, src);
  return <video ref={ref} data-testid="video" />;
}
afterEach(() => {
  cleanup();
  safeStorage.removeItem('resume:resume-flow');
  safeStorage.removeItem('resume:next-episode');
});
describe('embed media lifecycle', () => {
  it('saves on pause and seeks back once after reopening', () => {
    const first = render(<Player />);
    const video = first.getByTestId('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 1200 });
    fireEvent.loadedMetadata(video);
    video.currentTime = 123;
    fireEvent.pause(video);
    first.unmount();
    const second = render(<Player />);
    const reopened = second.getByTestId('video') as HTMLVideoElement;
    Object.defineProperty(reopened, 'duration', { configurable: true, value: 1200 });
    fireEvent.loadedMetadata(reopened);
    expect(reopened.currentTime).toBe(123);
    reopened.currentTime = 150;
    fireEvent.canPlay(reopened);
    expect(reopened.currentTime).toBe(150);
  });

  it('keeps the saved position when the player tears down its source', () => {
    const view = render(<Player />);
    const video = view.getByTestId('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { configurable: true, value: 1200 });
    fireEvent.loadedMetadata(video);
    video.currentTime = 400;
    fireEvent.pause(video);
    // Switching episodes empties the element; its reset position must not overwrite 400.
    fireEvent.emptied(video);
    video.currentTime = 0;
    fireEvent.pause(video);
    expect(safeStorage.getItem('resume:resume-flow')).toBe('400');
  });
});
