import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MiniPlayerProvider } from "@/contexts/MiniPlayerContext";
import { MainLayout } from "@/components/layout";
import { WelcomePopup } from "@/components/WelcomePopup";
import { FloatingTelegramButton } from "@/components/FloatingTelegramButton";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { MiniPlayer } from "@/components/video/MiniPlayer";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useNetworkSpeed } from "@/hooks/useNetworkSpeed";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";
import { useAutoVideoScan } from "@/hooks/useAutoVideoScan";
import { AccessBanner, fetchTokenAccessFromDB } from "@/components/AccessBanner";
import { TokenExpiredGlobalPopup } from "@/components/TokenExpiredGlobalPopup";

// Critical pages loaded eagerly for instant navigation
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy loaded pages — only downloaded when the user navigates to them
const TokenVerify = lazy(() => import("./pages/TokenVerify"));
const UnlockAccess = lazy(() => import("./pages/UnlockAccess"));
const Browse = lazy(() => import("./pages/Browse"));
const AnimeDetail = lazy(() => import("./pages/AnimeDetail"));
const Watch = lazy(() => import("./pages/Watch"));
const Favorites = lazy(() => import("./pages/Favorites"));
const History = lazy(() => import("./pages/History"));
const Upload = lazy(() => import("./pages/Upload"));
const UploadAnimeEdit = lazy(() => import("./pages/UploadAnimeEdit"));
const EpisodeEdit = lazy(() => import("./pages/EpisodeEdit"));
const Admin = lazy(() => import("./pages/Admin"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const UserStats = lazy(() => import("./pages/UserStats"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ExternalPlayer = lazy(() => import("./pages/ExternalPlayer"));
const EmbedPlayer = lazy(() => import("./pages/EmbedPlayer"));
const AnimeSlugRedirect = lazy(() => import("./pages/AnimeSlugRedirect"));
const LatestSeriesPage = lazy(() => import("./pages/LatestSeriesPage"));
const LatestEpisodesPage = lazy(() => import("./pages/LatestEpisodesPage"));
const LatestMoviesPage = lazy(() => import("./pages/LatestMoviesPage"));
const PendingUploadPage = lazy(() => import("./pages/PendingUploadPage"));
const CrunchyPage = lazy(() => import("./pages/CrunchyPage"));
const MuseINPage = lazy(() => import("./pages/MuseINPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Schedule = lazy(() => import("./pages/Schedule"));
const UpcomingPage = lazy(() => import("./pages/UpcomingPage"));
const EmbedSlugPlayer = lazy(() => import("./pages/EmbedSlugPlayer"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Downloads = lazy(() => import("./pages/Downloads"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Minimal loading fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Network speed test component that runs on app load
function NetworkSpeedInitializer() {
  const { downloadSpeed, recommendedQuality, isSlowNetwork, isTesting } = useNetworkSpeed();
  
  useEffect(() => {
    if (!isTesting && downloadSpeed > 0) {
      console.log(`Network speed test complete: ${downloadSpeed} Mbps, recommended quality: ${recommendedQuality}`);
      if (isSlowNetwork) {
        console.log('Slow network detected, video will start at lower quality');
      }
    }
  }, [downloadSpeed, recommendedQuality, isSlowNetwork, isTesting]);
  
  return null;
}

// Background sync component that runs within AuthProvider context
function BackgroundSyncInitializer() {
  const { isSyncing, newEpisodes, lastSyncTime } = useBackgroundSync();
  
  useEffect(() => {
    if (newEpisodes.length > 0) {
      console.log(`Background sync found ${newEpisodes.length} new episodes`);
    }
  }, [newEpisodes]);
  
  return null;
}

// Auto video scan + auto-start converter component
function AutoVideoScanInitializer() {
  const { hasScanned, scanResult } = useAutoVideoScan();
  
  useEffect(() => {
    if (hasScanned && scanResult && scanResult.created > 0) {
      console.log(`[AutoVideoScan] Queued ${scanResult.created} new videos for iOS conversion`);
    }
  }, [hasScanned, scanResult]);
  
  return null;
}

// DB-authoritative token access validation on every app load
function TokenAccessSyncInitializer() {
  useEffect(() => {
    fetchTokenAccessFromDB().then((result) => {
      const hadLocalAccess = !!localStorage.getItem('unlock_token_expires') &&
        Date.now() < parseInt(localStorage.getItem('unlock_token_expires') || '0', 10);

      if (result.hasAccess && !hadLocalAccess) {
        import('sonner').then(({ toast }) => {
          toast.success('Access synced from your account', {
            description: 'Your token access was restored automatically.',
            duration: 4000,
          });
        });
      }
    });
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <MiniPlayerProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <AccessBanner />
            <TokenExpiredGlobalPopup />
            <OfflineIndicator />
            <WelcomePopup />
            <FloatingTelegramButton />
            <MiniPlayer />
            <PWAInstallPrompt />
            <NetworkSpeedInitializer />
            <BackgroundSyncInitializer />
            <AutoVideoScanInitializer />
            <TokenAccessSyncInitializer />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify" element={<TokenVerify />} />
                <Route path="/secure-verify" element={<TokenVerify />} />
                <Route path="/unlock/:token" element={<UnlockAccess />} />
                
                <Route path="/external-player" element={<ExternalPlayer />} />
                <Route path="/embed/:episodeId" element={<EmbedPlayer />} />
                <Route path="/embed/:animeSlug/:seasonSlug/:episodeSlug" element={<EmbedSlugPlayer />} />
                <Route path="/embed/:animeSlug/:episodeSlug" element={<EmbedSlugPlayer />} />
                <Route path="/welcome" element={<Welcome />} />
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/latest-series" element={<LatestSeriesPage />} />
                  <Route path="/latest-episodes" element={<LatestEpisodesPage />} />
                  <Route path="/latest-movies" element={<LatestMoviesPage />} />
                  <Route path="/pending-upload" element={<PendingUploadPage />} />
                  <Route path="/crunchy" element={<CrunchyPage />} />
                  <Route path="/musein" element={<MuseINPage />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/upcoming" element={<UpcomingPage />} />
                  <Route path="/anime/:id" element={<AnimeDetail />} />
                  <Route path="/watch/:episodeId" element={<Watch />} />
                  <Route path="/favorites" element={<Favorites />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/upload/anime/:animeId" element={<UploadAnimeEdit />} />
                  <Route path="/upload/anime/:animeId/episode/:episodeId/edit" element={<EpisodeEdit />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/stats" element={<UserStats />} />
                  <Route path="/downloads" element={<Downloads />} />
                  <Route path="/:animeSlug/:episodeSlug" element={<AnimeSlugRedirect />} />
                  <Route path="/:animeSlug" element={<AnimeSlugRedirect />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </MiniPlayerProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
