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
        background:
          'radial-gradient(ellipse at center, hsla(0, 65%, 12%, 0.6) 0%, hsla(0, 0%, 0%, 0.94) 70%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden border border-primary/30 bg-card shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
        style={{
          boxShadow: '0 0 80px hsla(0, 70%, 40%, 0.25), 0 30px 60px hsla(0, 0%, 0%, 0.6)',
        }}
      >
        {/* Cinematic header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-rose-500/15 to-transparent" />
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full blur-3xl bg-primary/40 animate-pulse" />
          <div
            className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full blur-3xl bg-rose-500/30 animate-pulse"
            style={{ animationDelay: '0.6s' }}
          />

          <div className="relative px-6 pt-7 pb-5 flex flex-col items-center text-center">
            {/* Animated lock badge */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-rose-500 to-primary flex items-center justify-center shadow-2xl rotate-3">
                <Lock className="h-8 w-8 text-white drop-shadow-lg" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-lg ring-2 ring-card">
                <Sparkles className="h-2.5 w-2.5 text-amber-900" strokeWidth={3} />
              </div>
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-destructive">
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
        <div className="px-4 pb-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide bg-muted/40 rounded-full p-1 border border-border/40">
            {(Object.keys(langLabels) as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  lang === l
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {langLabels[l]}
              </button>
            ))}
          </div>
        </div>

        {/* Perks */}
        <div className="px-5 pb-3">
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
                className="rounded-xl bg-muted/30 border border-border/30 p-2 flex flex-col items-center gap-1 hover:border-primary/30 transition-colors"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
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
        <div className="mx-5 mb-3 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2 flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
          <p className="text-[10px] font-semibold text-amber-300">{t.signInWarn}</p>
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 space-y-2">
          <a
            href="https://t.me/getunlocktoken"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm text-white overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, hsl(270, 75%, 55%) 0%, hsl(290, 75%, 55%) 100%)',
              boxShadow: '0 0 25px hsla(0, 72%, 50%, 0.45), 0 8px 20px hsla(0, 0%, 0%, 0.4)',
            }}
          >
            <span
              className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
              style={{
                background:
                  'linear-gradient(90deg, transparent, hsla(0, 0%, 100%, 0.25), transparent)',
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
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[11px] text-foreground bg-muted/40 hover:bg-muted/70 border border-border/50 hover:border-primary/40 transition-all"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {t.howTo}
            </a>
            <button
              onClick={handleReload}
              disabled={reloading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-[11px] text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/60 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reloading ? 'animate-spin' : ''}`} />
              {reloading ? '...' : t.reload}
            </button>
          </div>

          {/* Back to Home — escape hatch */}
          <button
            onClick={() => navigate('/')}
            className="mt-1 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-[11px] text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted/30 border border-border/40 hover:border-border transition-all"
          >
            <Home className="h-3.5 w-3.5" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
