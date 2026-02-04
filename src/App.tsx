import { useEffect } from "react";
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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Browse from "./pages/Browse";
import AnimeDetail from "./pages/AnimeDetail";
import Watch from "./pages/Watch";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import Upload from "./pages/Upload";
import UploadAnimeEdit from "./pages/UploadAnimeEdit";
import EpisodeEdit from "./pages/EpisodeEdit";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import UserStats from "./pages/UserStats";
import NotFound from "./pages/NotFound";
import ExternalPlayer from "./pages/ExternalPlayer";
import EmbedPlayer from "./pages/EmbedPlayer";
import AnimeSlugRedirect from "./pages/AnimeSlugRedirect";
import LatestSeriesPage from "./pages/LatestSeriesPage";
import LatestEpisodesPage from "./pages/LatestEpisodesPage";
import LatestMoviesPage from "./pages/LatestMoviesPage";
import PendingUploadPage from "./pages/PendingUploadPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (previously cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

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

// Auto video scan component for MKV conversion queue
function AutoVideoScanInitializer() {
  const { hasScanned, scanResult, isScanning } = useAutoVideoScan();
  
  useEffect(() => {
    if (hasScanned && scanResult && scanResult.created > 0) {
      console.log(`[AutoVideoScan] Queued ${scanResult.created} new videos for iOS conversion`);
    }
  }, [hasScanned, scanResult]);
  
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
            <OfflineIndicator />
            <WelcomePopup />
            <FloatingTelegramButton />
            <MiniPlayer />
            <PWAInstallPrompt />
            <NetworkSpeedInitializer />
            <BackgroundSyncInitializer />
            <AutoVideoScanInitializer />
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/external-player" element={<ExternalPlayer />} />
              <Route path="/embed/:episodeId" element={<EmbedPlayer />} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<Index />} />
                {/* Schedule route removed */}
                <Route path="/browse" element={<Browse />} />
                <Route path="/latest-series" element={<LatestSeriesPage />} />
                <Route path="/latest-episodes" element={<LatestEpisodesPage />} />
                <Route path="/latest-movies" element={<LatestMoviesPage />} />
                <Route path="/pending-upload" element={<PendingUploadPage />} />
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
                {/* Clean URL routes for sharing */}
                <Route path="/:animeSlug/:episodeSlug" element={<AnimeSlugRedirect />} />
                <Route path="/:animeSlug" element={<AnimeSlugRedirect />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </MiniPlayerProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
