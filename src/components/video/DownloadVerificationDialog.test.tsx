import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DownloadVerificationDialog } from './DownloadVerificationDialog';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/downloadAudio', () => ({ discoverDownloadAudio: () => new Promise(() => {}) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); mocks.navigate.mockClear(); });
describe('download confirmation handoff', () => {
  const props = { open: true, onOpenChange: vi.fn(), videoUrl: 'https://example.test/video.mp4', fileName: 'video.mp4' };
  it('does not block downloads when discovery is still waiting on the source', () => {
    render(<DownloadVerificationDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '480p SD' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download 480p' }));
    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(new URL(mocks.navigate.mock.calls[0][0], 'https://example.test').searchParams.get('quality')).toBe('480p');
  });
  it('passes selected audio and quality even if browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    render(<DownloadVerificationDialog {...props} audioTracks={[{ label: 'Hindi', language: 'hin' }, { label: 'English', language: 'eng' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /English/ }));
    fireEvent.click(screen.getByRole('button', { name: '1080p FHD' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download 1080p' }));
    const url = new URL(mocks.navigate.mock.calls[0][0], 'https://example.test');
    expect(url.searchParams.get('audio')).toBe('1');
    expect(url.searchParams.get('audioLang')).toBe('en');
    expect(url.searchParams.get('quality')).toBe('1080p');
  });
});