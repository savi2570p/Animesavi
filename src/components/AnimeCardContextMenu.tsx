import { useState, useRef, useCallback, ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Download, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnimeCardContextMenuProps {
  children: ReactNode;
  animeTitle: string;
  animeUrl: string;
  coverImage?: string | null;
}

export function AnimeCardContextMenu({ 
  children, 
  animeTitle, 
  animeUrl,
  coverImage 
}: AnimeCardContextMenuProps) {
  const { toast } = useToast();
  const [isLongPress, setIsLongPress] = useState(false);
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

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${animeUrl}`;
    const shareData = {
      title: animeTitle,
      text: `Check out ${animeTitle} on Anime.Savi.me!`,
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
      // Trigger context menu via custom event
      const contextEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY,
      });
      e.currentTarget.dispatchEvent(contextEvent);
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

  return (
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
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleDownload} className="flex items-center gap-2 cursor-pointer">
          <Download className="h-4 w-4" />
          <span>Download</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleShare} className="flex items-center gap-2 cursor-pointer">
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}