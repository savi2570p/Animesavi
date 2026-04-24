import { Send } from 'lucide-react';

export function FloatingTelegramButton() {
  // Hide on embed routes
  const isEmbed = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/embed/') ||
    new URLSearchParams(window.location.search).get('embed') === 'true'
  );

  if (isEmbed) return null;

  const handleClick = () => {
    window.open('https://t.me/Lv_Savi', '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Contact on Telegram"
      className="group fixed bottom-20 right-3 md:bottom-6 md:right-6 z-50 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-lg shadow-[#0088cc]/40 transition-all duration-300 hover:scale-110 active:scale-95"
      style={{
        background: 'linear-gradient(135deg, #229ED9 0%, #0088cc 60%, #0077b5 100%)',
      }}
    >
      {/* Pulse ring */}
      <span className="absolute inset-0 rounded-full bg-[#0088cc]/40 animate-ping opacity-60 group-hover:opacity-90" />
      {/* Glow */}
      <span className="absolute inset-0 rounded-full ring-1 ring-white/20" />
      <Send className="relative h-4 w-4 md:h-[18px] md:w-[18px] text-white -translate-x-[1px] translate-y-[1px] drop-shadow" />
    </button>
  );
}
