import { useState } from 'react';
import { Lock, Ban, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Language = 'en' | 'hinglish' | 'hi' | 'bn' | 'ta' | 'te';

const translations: Record<Language, {
  title: string;
  feature1: string;
  feature2: string;
  feature3: string;
  skipAds: string;
  howTo: string;
}> = {
  en: {
    title: 'Access Expired or Restricted',
    feature1: 'Unlock High-Quality Player',
    feature2: 'Ad-Free Viewing Experience',
    feature3: 'Multi-Language Audio Support',
    skipAds: 'Skip Ads',
    howTo: 'How to Skip Ads',
  },
  hinglish: {
    title: 'Access Khatam ya Restricted Hai',
    feature1: 'High-Quality Player Unlock Karo',
    feature2: 'Ad-Free Dekhne Ka Maza',
    feature3: 'Multi-Language Audio Support',
    skipAds: 'Ads Skip Karo',
    howTo: 'Ads Kaise Skip Kare',
  },
  hi: {
    title: 'एक्सेस समाप्त या प्रतिबंधित',
    feature1: 'उच्च गुणवत्ता प्लेयर अनलॉक करें',
    feature2: 'विज्ञापन-मुक्त अनुभव',
    feature3: 'बहु-भाषा ऑडियो सपोर्ट',
    skipAds: 'विज्ञापन छोड़ें',
    howTo: 'विज्ञापन कैसे छोड़ें',
  },
  bn: {
    title: 'অ্যাক্সেস মেয়াদ শেষ বা সীমাবদ্ধ',
    feature1: 'উচ্চ-মানের প্লেয়ার আনলক করুন',
    feature2: 'বিজ্ঞাপন-মুক্ত দেখার অভিজ্ঞতা',
    feature3: 'বহু-ভাষা অডিও সাপোর্ট',
    skipAds: 'বিজ্ঞাপন এড়িয়ে যান',
    howTo: 'কিভাবে বিজ্ঞাপন এড়াবেন',
  },
  ta: {
    title: 'அணுகல் காலாவதியானது அல்லது கட்டுப்படுத்தப்பட்டது',
    feature1: 'உயர்தர பிளேயரை அன்லாக் செய்',
    feature2: 'விளம்பரமில்லா பார்வை அனுபவம்',
    feature3: 'பல-மொழி ஆடியோ ஆதரவு',
    skipAds: 'விளம்பரங்களைத் தவிர்',
    howTo: 'எப்படி விளம்பரத்தைத் தவிர்ப்பது',
  },
  te: {
    title: 'యాక్సెస్ గడువు ముగిసింది లేదా పరిమితం',
    feature1: 'హై-క్వాలిటీ ప్లేయర్ అన్‌లాక్',
    feature2: 'యాడ్-ఫ్రీ వీక్షణ అనుభవం',
    feature3: 'మల్టీ-లాంగ్వేజ్ ఆడియో సపోర్ట్',
    skipAds: 'యాడ్స్ స్కిప్ చేయండి',
    howTo: 'యాడ్స్ ఎలా స్కిప్ చేయాలి',
  },
};

const langLabels: Record<Language, string> = {
  en: 'English',
  hinglish: 'Hinglish',
  hi: 'हिंदी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
};

export function TokenExpiredPopup() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at center, rgba(180,0,0,0.15) 0%, rgba(0,0,0,0.85) 70%)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'linear-gradient(165deg, rgba(30,0,0,0.92) 0%, rgba(10,10,10,0.96) 100%)',
          border: '1px solid rgba(220,38,38,0.3)',
          boxShadow: '0 0 60px rgba(220,38,38,0.15), 0 0 120px rgba(220,38,38,0.05), 0 25px 50px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Sign-in Notice */}
        <div
          className="px-4 py-2.5 text-center text-sm font-semibold"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.1) 100%)',
            color: 'rgb(251,191,36)',
            borderBottom: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          ⚠️ Please Sign-in before the Skip Ads
        </div>

        {/* Language Switcher */}
        <div className="flex flex-wrap gap-1 p-3 border-b" style={{ borderColor: 'rgba(220,38,38,0.15)', background: 'rgba(0,0,0,0.4)' }}>
          {(Object.keys(langLabels) as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200"
              style={
                lang === l
                  ? { background: 'rgb(220,38,38)', color: 'white', boxShadow: '0 0 12px rgba(220,38,38,0.4)' }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }
              }
              onMouseEnter={(e) => { if (lang !== l) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={(e) => { if (lang !== l) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            >
              {langLabels[l]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                background: 'radial-gradient(circle, rgba(220,38,38,0.25) 0%, rgba(220,38,38,0.08) 100%)',
                boxShadow: '0 0 30px rgba(220,38,38,0.2)',
              }}
            >
              <Lock className="h-8 w-8" style={{ color: 'rgb(239,68,68)' }} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{t.title}</h2>
          </div>

          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: Lock, text: t.feature1 },
              { icon: Ban, text: t.feature2 },
              { icon: Globe, text: t.feature3 },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(220,38,38,0.12)' }}
                >
                  <Icon className="h-4 w-4" style={{ color: 'rgb(248,113,113)' }} />
                </div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <a
              href="https://t.me/getunlocktoken"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all duration-200 text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(220,38,38) 0%, rgb(185,28,28) 100%)',
                boxShadow: '0 0 20px rgba(220,38,38,0.3), 0 4px 12px rgba(0,0,0,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(220,38,38,0.5), 0 4px 16px rgba(0,0,0,0.4)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 20px rgba(220,38,38,0.3), 0 4px 12px rgba(0,0,0,0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <ExternalLink className="h-4 w-4" />
              {t.skipAds}
            </a>
            <a
              href="https://telegra.ph/How-to-Get-token-02-20"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all duration-200"
              style={{
                border: '2px solid rgba(220,38,38,0.6)',
                color: 'rgb(248,113,113)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220,38,38,0.1)';
                e.currentTarget.style.borderColor = 'rgba(220,38,38,0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(220,38,38,0.6)';
              }}
            >
              {t.howTo}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
