import { useState, useRef, useCallback, ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Download, Share2, Link, Image, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface AnimeCardContextMenuProps {
  children: ReactNode;
  animeTitle: string;
  animeUrl: string;
  coverImage?: string | null;
  description?: string | null;
}

// Helper to create clean slug from title
const createSlug = (title: string): string => {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export function AnimeCardContextMenu({ 
  children, 
  animeTitle, 
  animeUrl,
  coverImage,
  description 
}: AnimeCardContextMenuProps) {
  const { toast } = useToast();
  const [isLongPress, setIsLongPress] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (coverImage) {
      try {
        const response = await fetch(coverImage);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${animeTitle.replace(/[^a-z0-9]/gi, '_')}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({
          title: "Download Started",
          description: `Downloading ${animeTitle} poster...`,
        });
      } catch (error) {
        toast({
          title: "Download Failed",
          description: "Could not download the image.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "No Image Available",
        description: "This anime doesn't have a cover image to download.",
        variant: "destructive",
      });
    }
  };

  const handleSaveToGallery = async () => {
    if (!coverImage) {
      toast({
        title: "No Image Available",
        description: "This anime doesn't have a cover image to save.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Try using the Web Share API for mobile (allows saving to gallery)
      if (navigator.share && navigator.canShare) {
        const response = await fetch(coverImage);
        const blob = await response.blob();
        const file = new File([blob], `${animeTitle.replace(/[^a-z0-9]/gi, '_')}.jpg`, { type: blob.type });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: animeTitle,
            text: `${animeTitle} poster`,
          });
          toast({
            title: "Image Shared",
            description: "You can now save the image to your gallery.",
          });
          return;
        }
      }
      
      // Fallback to regular download
      await handleDownload();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        // Fallback to regular download
        await handleDownload();
      }
    }
  };

  const handleCopyLink = async () => {
    // Use clean URL with anime slug instead of ID
    const animeSlug = createSlug(animeTitle);
    const shareUrl = `${window.location.origin}/${animeSlug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied!",
        description: "Anime link has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy the link.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    // Use clean URL with anime slug instead of ID
    const animeSlug = createSlug(animeTitle);
    const shareUrl = `${window.location.origin}/${animeSlug}`;
    const shareData = {
      title: animeTitle,
      text: `Check out ${animeTitle} on AnimeSavi!`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied!",
          description: "Anime link has been copied to clipboard.",
        });
      }
    } catch (error) {
      // User cancelled share or error occurred
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: "Link Copied!",
          description: "Anime link has been copied to clipboard.",
        });
      }
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      // On iOS, show preview instead of context menu
      if (isIOS) {
        setShowPreview(true);
      } else {
        // Trigger context menu via custom event for other devices
        const contextEvent = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY,
        });
        e.currentTarget.dispatchEvent(contextEvent);
      }
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Reset long press flag after a short delay
    setTimeout(() => setIsLongPress(false), 100);
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Detect if mobile and if iOS
  const isMobile = typeof window !== 'undefined' && 'ontouchstart' in window;
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <>
      {/* iOS-style Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
          <div className="relative">
            {coverImage && (
              <img
                src={coverImage}
                alt={animeTitle}
                className="w-full aspect-[3/4] object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
              <h3 className="text-white font-bold text-lg line-clamp-2">{animeTitle}</h3>
              {description && (
                <p className="text-white/70 text-sm line-clamp-3">{description}</p>
              )}
              <div className="flex gap-2 pt-2">
                <a
                  href={animeUrl}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                  onClick={() => setShowPreview(false)}
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </a>
                <button
                  onClick={() => {
                    handleShare();
                    setShowPreview(false);
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-4 bg-white/20 text-white rounded-lg text-sm font-medium"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={contextMenuRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onClick={(e) => {
              // Prevent click if it was a long press
              if (isLongPress) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {/* Preview option */}
          {coverImage && (
            <ContextMenuItem onClick={() => setShowPreview(true)} className="flex items-center gap-2 cursor-pointer">
              <Eye className="h-4 w-4" />
              <span>Preview</span>
            </ContextMenuItem>
          )}
          {/* Save to Gallery - Mobile only */}
          {isMobile && coverImage && (
            <ContextMenuItem onClick={handleSaveToGallery} className="flex items-center gap-2 cursor-pointer">
              <Image className="h-4 w-4" />
              <span>Save to Gallery</span>
            </ContextMenuItem>
          )}
          {/* Download - Desktop */}
          {!isMobile && coverImage && (
            <ContextMenuItem onClick={handleDownload} className="flex items-center gap-2 cursor-pointer">
              <Download className="h-4 w-4" />
              <span>Save Image</span>
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={handleCopyLink} className="flex items-center gap-2 cursor-pointer">
            <Link className="h-4 w-4" />
            <span>Copy Link</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleShare} className="flex items-center gap-2 cursor-pointer">
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
}