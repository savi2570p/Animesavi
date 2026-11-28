import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PopupQueueProvider, usePopupQueue } from '@/contexts/PopupQueueContext';
import { DownloadRemovedNotice } from '@/components/notices/DownloadRemovedNotice';
import { DOWNLOAD_NOTICE_KEY, DOWNLOAD_NOTICE_DISABLED_KEY } from '@/lib/downloadNotice';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isAdmin: false, isUploader: false, signOut: vi.fn() }),
}));

vi.mock('@/components/AccessBanner', () => ({
  fetchTokenSystemStatus: async () => false,
  fetchTokenAccessFromDB: async () => ({ hasAccess: true }),
  isSuperAdmin: () => false,
}));

function NoticeTrigger() {
  const { showDownloadNoticeManually } = usePopupQueue();
  return (
    <button type="button" onClick={showDownloadNoticeManually}>
      Show notice
    </button>
  );
}

function renderQueue(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PopupQueueProvider>
        <NoticeTrigger />
        <DownloadRemovedNotice />
      </PopupQueueProvider>
    </MemoryRouter>,
  );
}

const NOTICE_TITLE = 'Downloads have been removed';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

describe('opening the notice from the profile menu', () => {
  it('persists popup opt-out and suppresses it when the provider mounts again', async () => {
    const first = renderQueue();
    await screen.findByText(NOTICE_TITLE);
    fireEvent.click(screen.getByRole('checkbox', { name: "Don't show again" }));
    await waitFor(() => expect(screen.queryByText(NOTICE_TITLE)).toBeNull());
    expect(localStorage.getItem(DOWNLOAD_NOTICE_DISABLED_KEY)).toBe('true');
    first.unmount();
    localStorage.removeItem(DOWNLOAD_NOTICE_KEY);
    renderQueue();
    await waitFor(() => expect(document.documentElement.classList.contains('scroll-locked')).toBe(false));
    expect(screen.queryByText(NOTICE_TITLE)).toBeNull();
  });
  it('shows the notice even though the automatic one is already spent', async () => {
    // Pretend the automatic notice was shown a moment ago: it will not auto-open.
    localStorage.setItem(DOWNLOAD_NOTICE_KEY, String(Date.now()));

    renderQueue();
    expect(await screen.findByText('Show notice')).toBeInTheDocument();
    expect(screen.queryByText(NOTICE_TITLE)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show notice' }));
    expect(await screen.findByText(NOTICE_TITLE)).toBeInTheDocument();
  });

  it('does not consume the once-every-48-hours automatic showing', async () => {
    const lastShown = String(Date.now() - 60 * 60 * 1000);
    localStorage.setItem(DOWNLOAD_NOTICE_KEY, lastShown);

    renderQueue();
    fireEvent.click(await screen.findByRole('button', { name: 'Show notice' }));
    await screen.findByText(NOTICE_TITLE);

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByText(NOTICE_TITLE)).toBeNull());

    expect(localStorage.getItem(DOWNLOAD_NOTICE_KEY)).toBe(lastShown);
  });

  it('opens from any page, not only the home page', async () => {
    localStorage.setItem(DOWNLOAD_NOTICE_KEY, String(Date.now()));

    renderQueue('/watch/one-piece/season-1/episode-5');
    fireEvent.click(await screen.findByRole('button', { name: 'Show notice' }));
    expect(await screen.findByText(NOTICE_TITLE)).toBeInTheDocument();
  });
});
