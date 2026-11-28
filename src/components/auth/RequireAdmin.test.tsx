import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAdmin } from './RequireAdmin';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string },
  isAdmin: false,
  isLoading: false,
  isRolesLoaded: true,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }));

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<RequireAdmin><div>Private admin tools</div></RequireAdmin>} />
        <Route path="/auth" element={<div>Sign in page</div>} />
        <Route path="/" element={<div>Public home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  beforeEach(() => {
    authState.user = null;
    authState.isAdmin = false;
    authState.isLoading = false;
    authState.isRolesLoaded = true;
  });

  it('sends a signed-out visitor to sign in', async () => {
    renderAdminRoute();
    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByText('Private admin tools')).not.toBeInTheDocument();
  });

  it('sends a signed-in non-admin to the public home page', async () => {
    authState.user = { id: 'viewer-1' };
    renderAdminRoute();
    expect(await screen.findByText('Public home')).toBeInTheDocument();
    expect(screen.queryByText('Private admin tools')).not.toBeInTheDocument();
  });

  it('allows a signed-in admin after roles have loaded', async () => {
    authState.user = { id: 'admin-1' };
    authState.isAdmin = true;
    renderAdminRoute();
    expect(await screen.findByText('Private admin tools')).toBeInTheDocument();
  });
});
