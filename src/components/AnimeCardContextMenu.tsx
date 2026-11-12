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
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link as RouterLink } from 'react-router-dom';

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
    // Always share via the production custom domain
    const animeSlug = createSlug(animeTitle);
    const shareUrl = `https://animesavi.com/${animeSlug}`;
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
    // Always share via the production custom domain
    const animeSlug = createSlug(animeTitle);
    const shareUrl = `https://animesavi.com/${animeSlug}`;
    const shareData = {
      title: animeTitle,
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
      {/* Preview card */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="preview-v5 w-[calc(100vw-2rem)] max-w-[340px] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="preview-v5-art">
            {coverImage ? (
              <>
                <img src={coverImage} alt="" aria-hidden="true" className="preview-v5-fill" />
                <img src={coverImage} alt={animeTitle} className="preview-v5-poster" />
              </>
            ) : (
              <div className="preview-v5-empty"><Image className="h-8 w-8" /></div>
            )}
          </div>
          <div className="preview-v5-body">
            <span className="preview-v5-eyebrow">Quick preview</span>
            <DialogTitle className="preview-v5-title">{animeTitle}</DialogTitle>
            {description ? (
              <DialogDescription className="preview-v5-desc">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Preview of {animeTitle}</DialogDescription>
            )}
            <RouterLink to={animeUrl} className="preview-v5-primary" onClick={() => setShowPreview(false)}>
              <Eye className="h-4 w-4" />
              View Details
            </RouterLink>
            <div className="preview-v5-actions">
              <button type="button" onClick={handleCopyLink} className="preview-v5-action">
                <Link className="h-4 w-4" /><span>Copy link</span>
              </button>
              <button type="button" onClick={() => { handleShare(); setShowPreview(false); }} className="preview-v5-action">
                <Share2 className="h-4 w-4" /><span>Share</span>
              </button>
              {coverImage && (
                <button type="button" onClick={isMobile ? handleSaveToGallery : handleDownload} className="preview-v5-action">
                  <Download className="h-4 w-4" /><span>Save</span>
                </button>
              )}
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