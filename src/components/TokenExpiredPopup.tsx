import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ExternalLink, RefreshCw, Crown, BookOpen, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { TokenPerks } from '@/components/TokenPerks';

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

  const overlay = (
    <div className="token-watch-overlay-v7 utility-overlay-v6 fixed inset-0 flex items-center justify-center p-4" data-scroll-lock="active">
      <section role="dialog" aria-modal="true" aria-labelledby="watch-token-title" aria-describedby="watch-token-description" className="token-panel-v7 utility-glass-v6">
        <header className="token-header-v7" data-status="expired">
          <div className="token-status-icon-v7"><Lock /></div>
          <span className="token-eyebrow-v7">{t.badge}</span>
          <h2 id="watch-token-title">{t.title}</h2>
          <p id="watch-token-description">{t.subtitle}</p>
        </header>
        <div className="token-body-v7">
          <div className="token-language-v7" aria-label="Language">
            {(Object.keys(langLabels) as Language[]).map((l) => (
              <Button key={l} variant="ghost" size="sm" aria-pressed={lang === l} onClick={() => setLang(l)}>{langLabels[l]}</Button>
            ))}
          </div>
          <section className="token-section-v7">
            <h3>{t.perksTitle}</h3>
            <TokenPerks labels={[t.feature1, t.feature2, t.feature3, t.feature4, t.feature5, t.feature6]} />
          </section>
          <p className="token-note-v7"><Lock className="h-3.5 w-3.5 shrink-0" />{t.signInWarn}</p>
        </div>
        <footer className="token-actions-v7">
          <Button asChild className="w-full"><a href="https://t.me/getunlocktoken" target="_blank" rel="noopener noreferrer"><Crown />{t.reactivate}<ExternalLink /></a></Button>
          <Button variant="glass" className="w-full" onClick={handleReload} disabled={reloading} aria-busy={reloading}><RefreshCw className={reloading ? 'animate-spin' : ''} />{reloading ? 'Checking…' : t.reload}</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" asChild><a href="https://telegra.ph/How-to-Get-token-02-20" target="_blank" rel="noopener noreferrer"><BookOpen />{t.howTo}</a></Button>
            <Button variant="ghost" onClick={() => navigate('/')}><Home />Back to Home</Button>
          </div>
        </footer>
      </section>
    </div>
  );

  if (typeof document === 'undefined') return overlay;
  return createPortal(overlay, document.body);
}
