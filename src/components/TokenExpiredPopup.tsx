import { useState } from 'react';
import { Lock, Ban, Globe, ExternalLink, RefreshCw, Tv, Download, Zap, Crown, Sparkles, BookOpen, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

type Language = 'en' | 'hinglish' | 'hi' | 'bn' | 'ta' | 'te';

const translations: Record<Language, {
  badge: string;
  title: string;
  subtitle: string;
  perksTitle: string;
  feature1: string;
  feature2: string;
  feature3: string;
  feature4: string;
  feature5: string;
  feature6: string;
  reactivate: string;
  howTo: string;
  reload: string;
  signInWarn: string;
}> = {
  en: {
    badge: 'Premium Access Required',
    title: 'Unlock the Full Experience',
    subtitle: 'Your token expired. Reactivate to keep watching in 4K, ad-free.',
    perksTitle: "What You'll Unlock",
    feature1: '4K Ultra HD',
    feature2: 'Ad-Free',
    feature3: 'Multi-Audio',
    feature4: '4K Downloads',
    feature5: 'Priority Servers',
    feature6: 'Early Access',
    reactivate: 'Get Token Now',
    howTo: 'How to Get Token',
    reload: "I've Got My Token",
    signInWarn: 'Please sign-in before activating your token',
  },
  hinglish: {
    badge: 'Premium Access Chahiye',
    title: 'Full Experience Unlock Karo',
    subtitle: 'Token expire ho gaya. Reactivate karo aur 4K ad-free dekho.',
    perksTitle: 'Aapko Kya Milega',
    feature1: '4K Ultra HD',
    feature2: 'Ad-Free',
    feature3: 'Multi-Audio',
    feature4: '4K Downloads',
    feature5: 'Priority Servers',
    feature6: 'Early Access',
    reactivate: 'Token Lo Abhi',
    howTo: 'Token Kaise Lein',
    reload: 'Token Mil Gaya',
    signInWarn: 'Token activate karne se pehle sign-in karein',
  },
  hi: {
    badge: 'प्रीमियम एक्सेस आवश्यक',
    title: 'पूरा अनुभव अनलॉक करें',
    subtitle: 'आपका टोकन समाप्त हो गया। 4K विज्ञापन-मुक्त देखने के लिए पुनः सक्रिय करें।',
    perksTitle: 'आपको क्या मिलेगा',
    feature1: '4K अल्ट्रा HD',
    feature2: 'विज्ञापन-मुक्त',
    feature3: 'मल्टी-ऑडियो',
    feature4: '4K डाउनलोड',
    feature5: 'प्राथमिकता सर्वर',
    feature6: 'जल्दी एक्सेस',
    reactivate: 'अभी टोकन लें',
    howTo: 'टोकन कैसे प्राप्त करें',
    reload: 'मेरे पास टोकन है',
    signInWarn: 'टोकन सक्रिय करने से पहले साइन-इन करें',
  },
  bn: {
    badge: 'প্রিমিয়াম অ্যাক্সেস প্রয়োজন',
    title: 'সম্পূর্ণ অভিজ্ঞতা আনলক করুন',
    subtitle: 'আপনার টোকেন শেষ। 4K বিজ্ঞাপন-মুক্ত দেখতে পুনরায় সক্রিয় করুন।',
    perksTitle: 'আপনি যা পাবেন',
    feature1: '4K আল্ট্রা HD',
    feature2: 'বিজ্ঞাপন-মুক্ত',
    feature3: 'মাল্টি-অডিও',
    feature4: '4K ডাউনলোড',
    feature5: 'অগ্রাধিকার সার্ভার',
    feature6: 'আগে অ্যাক্সেস',
    reactivate: 'এখনই টোকেন নিন',
    howTo: 'টোকেন কিভাবে পাবেন',
    reload: 'আমার টোকেন আছে',
    signInWarn: 'টোকেন সক্রিয় করার আগে সাইন-ইন করুন',
  },
  ta: {
    badge: 'பிரீமியம் தேவை',
    title: 'முழு அனுபவத்தை திற',
    subtitle: 'டோக்கன் காலாவதியானது. 4K விளம்பரமில்லாமல் பார்க்க புதுப்பி.',
    perksTitle: 'நீங்கள் பெறுவது',
    feature1: '4K அல்ட்ரா HD',
    feature2: 'விளம்பரம் இல்லை',
    feature3: 'பல மொழி ஆடியோ',
    feature4: '4K டவுன்லோட்',
    feature5: 'முன்னுரிமை சர்வர்',
    feature6: 'முன்கூட்டிய அணுகல்',
    reactivate: 'டோக்கனை பெறு',
    howTo: 'டோக்கன் எப்படி பெறுவது',
    reload: 'டோக்கன் கிடைத்தது',
    signInWarn: 'டோக்கனை செயல்படுத்த முன் உள்நுழை',
  },
  te: {
    badge: 'ప్రీమియం కావాలి',
    title: 'పూర్తి అనుభవం అన్‌లాక్ చేయండి',
    subtitle: 'మీ టోకెన్ ముగిసింది. 4K యాడ్-ఫ్రీగా చూడటానికి తిరిగి సక్రియం చేయండి.',
    perksTitle: 'మీరు పొందేవి',
    feature1: '4K అల్ట్రా HD',
    feature2: 'యాడ్-ఫ్రీ',
    feature3: 'మల్టీ-ఆడియో',
    feature4: '4K డౌన్‌లోడ్‌లు',
    feature5: 'ప్రాధాన్య సర్వర్లు',
    feature6: 'ముందుగా యాక్సెస్',
    reactivate: 'ఇప్పుడే టోకెన్ పొందండి',
    howTo: 'టోకెన్ ఎలా పొందాలి',
    reload: 'నాకు టోకెన్ ఉంది',
    signInWarn: 'టోకెన్ సక్రియం చేయడానికి ముందు సైన్-ఇన్ చేయండి',
  },
};

const langLabels: Record<Language, string> = {
  en: 'EN',
  hinglish: 'Hinglish',
  hi: 'हिं',
  bn: 'বাং',
  ta: 'த',
  te: 'తె',
};

export function TokenExpiredPopup() {
  const [lang, setLang] = useState<Language>('en');
  const [reloading, setReloading] = useState(false);
  const navigate = useNavigate();
  const t = translations[lang];

  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        setReloading(false);
        return;
      }
      const { data: usage } = await supabase
        .from('token_usage')
        .select('expires_at')
        .eq('user_id', session.user.id)
        .order('used_at', { ascending: false })
        .limit(1)
        .single();

      const expMs = usage?.expires_at
        ? typeof usage.expires_at === 'number' && usage.expires_at < 1e12
          ? usage.expires_at * 1000
          : Number(usage.expires_at)
        : 0;

      if (expMs > Date.now()) {
        toast.success('Token active! Reloading...');
        window.location.reload();
      } else {
        toast.error('No active token found. Please get a token first.');
        setReloading(false);
      }
    } catch {
      toast.error('Could not verify token. Try again.');
      setReloading(false);
    }
  };

  const perks = [
    { icon: Tv, label: t.feature1, tone: 'text-sky-400 bg-sky-500/10' },
    { icon: Ban, label: t.feature2, tone: 'text-rose-400 bg-rose-500/10' },
    { icon: Globe, label: t.feature3, tone: 'text-emerald-400 bg-emerald-500/10' },
    { icon: Download, label: t.feature4, tone: 'text-violet-400 bg-violet-500/10' },
    { icon: Zap, label: t.feature5, tone: 'text-amber-400 bg-amber-500/10' },
    { icon: Sparkles, label: t.feature6, tone: 'text-pink-400 bg-pink-500/10' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        background:
          'radial-gradient(120% 90% at 50% 0%, hsla(270,70%,25%,0.35) 0%, hsla(0,0%,0%,0.82) 65%)',
        backdropFilter: 'blur(26px) saturate(170%)',
        WebkitBackdropFilter: 'blur(26px) saturate(170%)',
      }}
    >
      <style>{`
        @keyframes tep-float {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(0,-12px,0) scale(1.08); }
        }
        @keyframes tep-sheen {
          0%   { transform: translateX(-120%) rotate(8deg); }
          100% { transform: translateX(220%) rotate(8deg); }
        }
      `}</style>

      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto scrollbar-hide rounded-[28px] border border-white/20 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        style={{
          background:
            'linear-gradient(155deg, hsla(0,0%,100%,0.14) 0%, hsla(0,0%,100%,0.05) 40%, hsla(0,0%,0%,0.42) 100%)',
          backdropFilter: 'blur(40px) saturate(200%)',
          WebkitBackdropFilter: 'blur(40px) saturate(200%)',
          boxShadow:
            '0 40px 100px hsla(0,0%,0%,0.7), 0 0 70px hsla(270,80%,55%,0.22), inset 0 1px 0 hsla(0,0%,100%,0.28), inset 0 -1px 0 hsla(0,0%,0%,0.45)',
          transform: 'translateZ(0)',
        }}
      >
        {/* Liquid highlight sheen */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
          <div
            className="absolute -top-1/2 left-0 h-[200%] w-1/3 opacity-40"
            style={{
              background:
                'linear-gradient(90deg, transparent, hsla(0,0%,100%,0.18), transparent)',
              animation: 'tep-sheen 6s ease-in-out infinite',
            }}
          />
        </div>

        {/* Header */}
        <div className="relative overflow-hidden">
          <div
            className="absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl"
            style={{ background: 'hsla(270,85%,60%,0.35)', animation: 'tep-float 7s ease-in-out infinite' }}
          />
          <div
            className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full blur-3xl"
            style={{ background: 'hsla(330,85%,58%,0.28)', animation: 'tep-float 9s ease-in-out infinite', animationDelay: '1.2s' }}
          />

          <div className="relative px-6 pt-8 pb-5 flex flex-col items-center text-center">
            {/* Glass lock orb */}
            <div className="relative">
              <div
                className="absolute inset-0 -m-5 rounded-full blur-2xl"
                style={{ background: 'hsla(270,85%,60%,0.5)', animation: 'tep-float 4.5s ease-in-out infinite' }}
              />
              <div
                className="relative w-[68px] h-[68px] rounded-[22px] flex items-center justify-center"
                style={{
                  background:
                    'radial-gradient(circle at 32% 26%, hsla(0,0%,100%,0.55), hsla(0,0%,100%,0.06) 55%, hsla(270,80%,55%,0.35))',
                  border: '1px solid hsla(0,0%,100%,0.35)',
                  backdropFilter: 'blur(14px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(14px) saturate(180%)',
                  boxShadow:
                    'inset 0 2px 10px hsla(0,0%,100%,0.5), inset 0 -12px 22px hsla(270,80%,50%,0.4), 0 18px 45px hsla(270,80%,50%,0.35)',
                }}
              >
                <Lock className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2.2} />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400/90 backdrop-blur flex items-center justify-center shadow-lg ring-1 ring-white/40">
                <Sparkles className="h-2.5 w-2.5 text-amber-900" strokeWidth={3} />
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-foreground/80">
                {t.badge}
              </span>
            </div>

            <h2 className="mt-3 text-xl sm:text-2xl font-black text-foreground leading-tight">
              {t.title}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-[320px] leading-relaxed">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="px-4 pb-2 relative">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide rounded-full p-1 border border-white/15 bg-white/[0.06] backdrop-blur-xl">
            {(Object.keys(langLabels) as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  lang === l
                    ? 'bg-white/85 text-black shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Perks */}
        <div className="px-5 pb-3 relative">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Crown className="h-3 w-3 text-amber-400" />
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {t.perksTitle}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {perks.map(({ icon: Icon, label, tone }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/12 bg-white/[0.05] backdrop-blur-xl p-2 flex flex-col items-center gap-1 transition-colors hover:border-white/30 hover:bg-white/[0.09]"
                style={{ boxShadow: 'inset 0 1px 0 hsla(0,0%,100%,0.16)' }}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-bold text-foreground/80 text-center leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign-in warning */}
        <div className="mx-5 mb-3 rounded-xl bg-amber-500/10 border border-amber-400/25 backdrop-blur-md px-3 py-2 flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
          <p className="text-[10px] font-semibold text-amber-300">{t.signInWarn}</p>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 space-y-2 relative">
          <a
            href="https://t.me/getunlocktoken"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-black text-sm text-white overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background:
                'linear-gradient(135deg, hsla(270,80%,58%,0.92) 0%, hsla(300,80%,58%,0.92) 100%)',
              border: '1px solid hsla(0,0%,100%,0.28)',
              boxShadow:
                'inset 0 1px 0 hsla(0,0%,100%,0.4), 0 0 30px hsla(280,80%,55%,0.45), 0 12px 28px hsla(0,0%,0%,0.45)',
            }}
          >
            <span
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsla(0, 0%, 100%, 0.3), transparent)',
              }}
            />
            <Crown className="h-4 w-4 relative z-10" />
            <span className="relative z-10">{t.reactivate}</span>
            <ExternalLink className="h-3.5 w-3.5 relative z-10 opacity-80" />
          </a>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="https://telegra.ph/How-to-Get-token-02-20"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl font-bold text-[11px] text-foreground bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 hover:border-white/30 backdrop-blur-xl transition-all"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {t.howTo}
            </a>
            <button
              onClick={handleReload}
              disabled={reloading}
              aria-busy={reloading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl font-bold text-[11px] text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 hover:border-emerald-400/60 backdrop-blur-xl transition-all disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reloading ? 'animate-spin' : ''}`} />
              {reloading ? 'Checking…' : t.reload}
            </button>
          </div>

          {/* Back to Home — escape hatch */}
          <button
            onClick={() => navigate('/')}
            className="mt-1 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl font-semibold text-[11px] text-muted-foreground hover:text-foreground bg-transparent hover:bg-white/[0.07] border border-white/12 hover:border-white/25 transition-all"
          >
            <Home className="h-3.5 w-3.5" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
