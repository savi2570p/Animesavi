import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function FloatingTelegramButton() {
  // Hide on embed routes
  const isEmbed = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  if (isEmbed) return null;

  const handleClick = () => {
    window.open('https://t.me/Lv_Savi', '_blank');
  };

  return (
    <Button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg bg-[#0088cc] hover:bg-[#0077b5] text-white p-0 transition-all duration-300 hover:scale-110"
      aria-label="Contact on Telegram"
    >
      <MessageCircle className="h-6 w-6" />
    </Button>
  );
}
