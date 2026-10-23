import { useRef } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { useEmbedResume } from './useEmbedResume';
import { safeStorage } from '@/lib/storage/safeStorage';

function Player() {
  const ref = useRef<HTMLVideoElement>(null);
  useEmbedResume(ref, 'resume-flow', 'movie.mp4');
  return <video ref={ref} data-testid="video" />;
}
afterEach(() => { cleanup(); safeStorage.removeItem('resume:resume-flow'); });
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
});