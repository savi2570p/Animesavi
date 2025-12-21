import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Browse from "./pages/Browse";
import AnimeDetail from "./pages/AnimeDetail";
import Watch from "./pages/Watch";
import Favorites from "./pages/Favorites";
import History from "./pages/History";
import ApplyUploader from "./pages/ApplyUploader";
import Upload from "./pages/Upload";
import UploadAnimeEdit from "./pages/UploadAnimeEdit";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/anime/:id" element={<AnimeDetail />} />
              <Route path="/watch/:episodeId" element={<Watch />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/history" element={<History />} />
              <Route path="/apply-uploader" element={<ApplyUploader />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/upload/anime/:animeId" element={<UploadAnimeEdit />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
