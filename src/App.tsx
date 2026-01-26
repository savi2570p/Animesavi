import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout";
import { WelcomePopup } from "@/components/WelcomePopup";
import { FloatingTelegramButton } from "@/components/FloatingTelegramButton";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { useNetworkSpeed } from "@/hooks/useNetworkSpeed";
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
import NotFound from "./pages/NotFound";
import ExternalPlayer from "./pages/ExternalPlayer";
import AnimeSlugRedirect from "./pages/AnimeSlugRedirect";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <WelcomePopup />
          <FloatingTelegramButton />
          <NetworkSpeedInitializer />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/external-player" element={<ExternalPlayer />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<Index />} />
              {/* Schedule route removed */}
              <Route path="/browse" element={<Browse />} />
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
              {/* Clean URL routes for sharing */}
              <Route path="/:animeSlug/:episodeSlug" element={<AnimeSlugRedirect />} />
              <Route path="/:animeSlug" element={<AnimeSlugRedirect />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
