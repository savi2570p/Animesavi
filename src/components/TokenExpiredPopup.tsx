import { useState } from 'react';
import { Lock, Ban, Globe, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-orange-500/30 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Language Switcher */}
        <div className="flex flex-wrap gap-1 p-3 bg-black/40 border-b border-orange-500/20">
          {(Object.keys(langLabels) as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                lang === l
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {langLabels[l]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-white">{t.title}</h2>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-sm">{t.feature1}</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                <Ban className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-sm">{t.feature2}</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-sm">{t.feature3}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <a
              href="https://t.me/getunlocktoken"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              {t.skipAds}
            </a>
            <a
              href="https://telegra.ph/How-to-Get-token-02-20"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500/10 font-semibold transition-all"
            >
              {t.howTo}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
