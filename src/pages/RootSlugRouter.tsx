import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { isEmbedTokenCandidate } from '@/lib/embedTokens';

const TokenEmbedPlayer = lazy(() => import('./TokenEmbedPlayer'));
const ClonePlatform = lazy(() => import('./ClonePlatform'));

/**
 * Root-level dispatcher.
 *
 * Embed tokens live at the domain root (`/7xK92p`) exactly like the public
 * embed URL requires. Clone-platform slugs also live at the root, so we split
 * on shape: tokens are 6-12 base62 chars containing at least one uppercase
 * letter, which slugs never are.
 */
export default function RootSlugRouter() {
  const { slug } = useParams();

  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      {isEmbedTokenCandidate(slug) ? <TokenEmbedPlayer /> : <ClonePlatform />}
    </Suspense>
  );
}
