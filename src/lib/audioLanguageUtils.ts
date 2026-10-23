/**
 * Advanced Multilingual Audio Detection and Labeling System
 * Supports: Hindi, Tamil, Telugu, English, Japanese, Chinese (Mandarin), Cantonese
 * Handles: ISO-639 codes, embedded metadata, third-party corruption, Donghua detection
 */

// Complete ISO-639 language code mapping with all variations
export const LANGUAGE_CODE_MAP: Record<string, {
  name: string;
  flag: string;
  priority: number;
  aliases: string[];
}> = {
  // Hindi
  'hi': { name: 'Hindi', flag: '🇮🇳', priority: 1, aliases: ['hin', 'hindi', 'हिंदी', 'hnd'] },
  'hin': { name: 'Hindi', flag: '🇮🇳', priority: 1, aliases: ['hi', 'hindi'] },
  
  // Tamil
  'ta': { name: 'Tamil', flag: '🇮🇳', priority: 2, aliases: ['tam', 'tamil', 'தமிழ்'] },
  'tam': { name: 'Tamil', flag: '🇮🇳', priority: 2, aliases: ['ta', 'tamil'] },
  
  // Telugu
  'te': { name: 'Telugu', flag: '🇮🇳', priority: 3, aliases: ['tel', 'telugu', 'తెలుగు'] },
  'tel': { name: 'Telugu', flag: '🇮🇳', priority: 3, aliases: ['te', 'telugu'] },
  
  // English
  'en': { name: 'English', flag: '🇬🇧', priority: 4, aliases: ['eng', 'english'] },
  'eng': { name: 'English', flag: '🇬🇧', priority: 4, aliases: ['en', 'english'] },
  
  // Japanese
  'ja': { name: 'Japanese', flag: '🇯🇵', priority: 5, aliases: ['jpn', 'jap', 'japanese', '日本語'] },
  'jpn': { name: 'Japanese', flag: '🇯🇵', priority: 5, aliases: ['ja', 'jap', 'japanese'] },
  'jap': { name: 'Japanese', flag: '🇯🇵', priority: 5, aliases: ['ja', 'jpn', 'japanese'] },
  
  // Chinese (Mandarin) - Primary Chinese language
  'zh': { name: 'Chinese (Mandarin)', flag: '🇨🇳', priority: 6, aliases: ['cmn', 'chi', 'chinese', 'mandarin', '普通话', '國語'] },
  'cmn': { name: 'Chinese (Mandarin)', flag: '🇨🇳', priority: 6, aliases: ['zh', 'chi', 'chinese', 'mandarin'] },
  'chi': { name: 'Chinese (Mandarin)', flag: '🇨🇳', priority: 6, aliases: ['zh', 'cmn', 'chinese'] },
  'zho': { name: 'Chinese (Mandarin)', flag: '🇨🇳', priority: 6, aliases: ['zh', 'cmn', 'chi'] },
  'zh-cn': { name: 'Chinese (Mandarin)', flag: '🇨🇳', priority: 6, aliases: ['cmn', 'chinese'] },
  'zh-hans': { name: 'Chinese (Mandarin)', flag: '🇨🇳', priority: 6, aliases: ['cmn', 'chinese'] },
  
  // Chinese (Cantonese) - Important for Hong Kong content
  'yue': { name: 'Chinese (Cantonese)', flag: '🇭🇰', priority: 7, aliases: ['cantonese', '粵語', '广东话'] },
  'zh-hk': { name: 'Chinese (Cantonese)', flag: '🇭🇰', priority: 7, aliases: ['yue', 'cantonese'] },
  'zh-hant': { name: 'Chinese (Traditional)', flag: '🇹🇼', priority: 8, aliases: ['chinese-traditional'] },
  
  // Korean
  'ko': { name: 'Korean', flag: '🇰🇷', priority: 9, aliases: ['kor', 'korean', '한국어'] },
  'kor': { name: 'Korean', flag: '🇰🇷', priority: 9, aliases: ['ko', 'korean'] },
  
  // Spanish
  'es': { name: 'Spanish', flag: '🇪🇸', priority: 10, aliases: ['spa', 'spanish', 'español'] },
  'spa': { name: 'Spanish', flag: '🇪🇸', priority: 10, aliases: ['es', 'spanish'] },
  
  // French
  'fr': { name: 'French', flag: '🇫🇷', priority: 11, aliases: ['fra', 'fre', 'french', 'français'] },
  'fra': { name: 'French', flag: '🇫🇷', priority: 11, aliases: ['fr', 'french'] },
  
  // German
  'de': { name: 'German', flag: '🇩🇪', priority: 12, aliases: ['deu', 'ger', 'german', 'deutsch'] },
  'deu': { name: 'German', flag: '🇩🇪', priority: 12, aliases: ['de', 'german'] },
  
  // Italian
  'it': { name: 'Italian', flag: '🇮🇹', priority: 13, aliases: ['ita', 'italian', 'italiano'] },
  'ita': { name: 'Italian', flag: '🇮🇹', priority: 13, aliases: ['it', 'italian'] },
  
  // Portuguese
  'pt': { name: 'Portuguese', flag: '🇧🇷', priority: 14, aliases: ['por', 'portuguese', 'português'] },
  'por': { name: 'Portuguese', flag: '🇧🇷', priority: 14, aliases: ['pt', 'portuguese'] },
  
  // Thai
  'th': { name: 'Thai', flag: '🇹🇭', priority: 15, aliases: ['tha', 'thai', 'ไทย'] },
  'tha': { name: 'Thai', flag: '🇹🇭', priority: 15, aliases: ['th', 'thai'] },
  
  // Vietnamese
  'vi': { name: 'Vietnamese', flag: '🇻🇳', priority: 16, aliases: ['vie', 'vietnamese', 'tiếng việt'] },
  'vie': { name: 'Vietnamese', flag: '🇻🇳', priority: 16, aliases: ['vi', 'vietnamese'] },
  
  // Indonesian
  'id': { name: 'Indonesian', flag: '🇮🇩', priority: 17, aliases: ['ind', 'indonesian', 'bahasa'] },
  'ind': { name: 'Indonesian', flag: '🇮🇩', priority: 17, aliases: ['id', 'indonesian'] },
  
  // Arabic
  'ar': { name: 'Arabic', flag: '🇸🇦', priority: 18, aliases: ['ara', 'arabic', 'العربية'] },
  'ara': { name: 'Arabic', flag: '🇸🇦', priority: 18, aliases: ['ar', 'arabic'] },
  
  // Russian
  'ru': { name: 'Russian', flag: '🇷🇺', priority: 19, aliases: ['rus', 'russian', 'русский'] },
  'rus': { name: 'Russian', flag: '🇷🇺', priority: 19, aliases: ['ru', 'russian'] },
};

// Known Donghua (Chinese Anime) titles for auto-detection
const DONGHUA_TITLES = [
  'the daily life of the immortal king',
  'soul land',
  'battle through the heavens',
  'swallowed star',
  'martial universe',
  'stellar transformations',
  'a will eternal',
  'legend of exorcism',
  'great ruler',
  'perfectworld',
  'xian wang de richang shenghuo',
  'douluo dalu',
  'doupo cangqiong',
  'tunshi xingkong',
  'wu dong qiankun',
  'xing chen bian',
  'yi nian yong heng',
  'tian guan ci fu',
  'mo dao zu shi',
  'heaven official\'s blessing',
  'grandmaster of demonic cultivation',
  'fog hill of five elements',
  'link click',
  'scissor seven',
  'word of honor',
  'thousand autumns',
  'faraway wanderers',
];

// Anime titles that should default to Japanese audio
const JAPANESE_DEFAULT_TITLES = [
  'adam\'s sweet agony',
  'adams sweet agony',
];

// Anime titles with specific quality preferences (height in pixels)
export const ANIME_QUALITY_OVERRIDES: Record<string, number> = {
  'adam\'s sweet agony': 720,
  'adams sweet agony': 720,
};

export interface DetectedLanguageInfo {
  code: string;
  name: string;
  flag: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'iso-code' | 'label-parse' | 'track-title' | 'inferred';
}

/**
 * Normalize language code to standard ISO-639-1 format
 */
export function normalizeLanguageCode(code: string | undefined): string {
  if (!code) return 'und'; // Undetermined
  
  const normalized = code.toLowerCase().trim();
  
  // Direct match
  if (LANGUAGE_CODE_MAP[normalized]) {
    return normalized;
  }
  
  // Check aliases
  for (const [key, value] of Object.entries(LANGUAGE_CODE_MAP)) {
    if (value.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      return key;
    }
  }
  
  return 'und';
}

/**
 * Detect language from track label (handles third-party corrupted metadata)
 */
export function detectLanguageFromLabel(label: string | undefined): DetectedLanguageInfo | null {
  if (!label) return null;
  
  const lowerLabel = label.toLowerCase().trim();
  
  // Direct language name detection (handles corrupted third-party labels)
  const languagePatterns: Array<{ pattern: RegExp; code: string }> = [
    // Hindi variations
    { pattern: /\bhindi\b|\bhind\b|\bhin\b|\bhnd\b/i, code: 'hi' },
    
    // Tamil variations
    { pattern: /\btamil\b|\btam\b/i, code: 'ta' },
    
    // Telugu variations
    { pattern: /\btelugu\b|\btel\b/i, code: 'te' },
    
    // English variations
    { pattern: /\benglish\b|\beng\b/i, code: 'en' },
    
    // Japanese variations
    { pattern: /\bjapanese\b|\bjap\b|\bjpn\b/i, code: 'ja' },
    
    // Chinese/Mandarin variations (critical for Donghua)
    { pattern: /\bchinese\b|\bmandarin\b|\bchi\b|\bcmn\b|\bputonghua\b|\bguoyu\b/i, code: 'zh' },
    
    // Cantonese
    { pattern: /\bcantonese\b|\byue\b|\bguangdong\b/i, code: 'yue' },
    
    // Korean
    { pattern: /\bkorean\b|\bkor\b/i, code: 'ko' },
    
    // Spanish
    { pattern: /\bspanish\b|\bespanol\b|\bespa[ñn]ol\b|\bspa\b/i, code: 'es' },
    
    // French
    { pattern: /\bfrench\b|\bfrançais\b|\bfra\b/i, code: 'fr' },
    
    // German
    { pattern: /\bgerman\b|\bdeutsch\b|\bger\b|\bdeu\b/i, code: 'de' },
    
    // Portuguese
    { pattern: /\bportuguese\b|\bportugues\b|\bpor\b/i, code: 'pt' },
    
    // Italian
    { pattern: /\bitalian\b|\bitaliano\b|\bita\b/i, code: 'it' },
    
    // Thai
    { pattern: /\bthai\b|\btha\b/i, code: 'th' },
    
    // Vietnamese
    { pattern: /\bvietnamese\b|\bviet\b|\bvie\b/i, code: 'vi' },
    
    // Arabic
    { pattern: /\barabic\b|\bara\b/i, code: 'ar' },
    
    // Russian
    { pattern: /\brussian\b|\brus\b/i, code: 'ru' },
  ];
  
  for (const { pattern, code } of languagePatterns) {
    if (pattern.test(lowerLabel)) {
      const langInfo = LANGUAGE_CODE_MAP[code];
      if (langInfo) {
        return {
          code,
          name: langInfo.name,
          flag: langInfo.flag,
          confidence: 'high',
          source: 'label-parse',
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if content is likely Donghua (Chinese Anime)
 */
export function isDonghua(animeTitle: string | undefined): boolean {
  if (!animeTitle) return false;
  
  const lowerTitle = animeTitle.toLowerCase().trim();
  return DONGHUA_TITLES.some(title => 
    lowerTitle.includes(title) || title.includes(lowerTitle)
  );
}

/**
 * Get the display label for an audio track with advanced detection
 */
export function getAudioTrackLabel(
  trackLabel: string | undefined,
  langCode: string | undefined,
  trackIndex: number,
  animeTitle?: string
): string {
  // Step 1: Try ISO code lookup
  const normalizedCode = normalizeLanguageCode(langCode);
  if (normalizedCode !== 'und' && LANGUAGE_CODE_MAP[normalizedCode]) {
    const langInfo = LANGUAGE_CODE_MAP[normalizedCode];
    return `${langInfo.flag} ${langInfo.name}`;
  }
  
  // Step 2: Try label parsing (handles corrupted third-party metadata)
  const labelDetection = detectLanguageFromLabel(trackLabel);
  if (labelDetection) {
    return `${labelDetection.flag} ${labelDetection.name}`;
  }
  
  // Step 3: Use clean label if available (but not generic ones)
  if (trackLabel && trackLabel.trim()) {
    const cleanLabel = trackLabel.trim();
    // Skip generic labels like "Audio 1", "Track 1", "und", "Unknown"
    if (!/^(audio|track|und|unknown|stereo|surround|\d+\.?\d*)/i.test(cleanLabel)) {
      return cleanLabel;
    }
  }
  
  // Step 4: Infer from anime type (Donghua = Chinese primary)
  if (isDonghua(animeTitle)) {
    // For Donghua, if we can't detect language, assume Chinese Mandarin for first track
    if (trackIndex === 0) {
      const chineseInfo = LANGUAGE_CODE_MAP['zh'];
      return `${chineseInfo.flag} ${chineseInfo.name}`;
    }
  }
  
  // Step 5: Default fallback with track number
  return `🔊 Audio ${trackIndex + 1}`;
}

/**
 * Get subtitle track label with detection
 */
export function getSubtitleTrackLabel(
  trackLabel: string | undefined,
  langCode: string | undefined,
  trackIndex: number
): string {
  // Step 1: Try ISO code lookup
  const normalizedCode = normalizeLanguageCode(langCode);
  if (normalizedCode !== 'und' && LANGUAGE_CODE_MAP[normalizedCode]) {
    const langInfo = LANGUAGE_CODE_MAP[normalizedCode];
    return `${langInfo.flag} ${langInfo.name}`;
  }
  
  // Step 2: Try label parsing
  const labelDetection = detectLanguageFromLabel(trackLabel);
  if (labelDetection) {
    return `${labelDetection.flag} ${labelDetection.name}`;
  }
  
  // Step 3: Use clean label if available
  if (trackLabel && trackLabel.trim()) {
    const cleanLabel = trackLabel.trim();
    if (!/^(subtitle|caption|text|track|und|unknown|\d+)/i.test(cleanLabel)) {
      return cleanLabel;
    }
  }
  
  // Step 4: Default fallback
  return `📝 Subtitle ${trackIndex + 1}`;
}

/**
 * Determine preferred audio track based on user preferences and content type
 */
export function getPreferredAudioTrack(
  tracks: Array<{ label: string; lang: string; index: number }>,
  animeTitle?: string,
  userPreference?: string,
  isSubOnly = false
): number {
  if (tracks.length === 0) return 0;
  if (isSubOnly) {
    const japanese = tracks.find(track => ['ja', 'jpn', 'jap'].includes(normalizeLanguageCode(track.lang)) || detectLanguageFromLabel(track.label)?.code === 'ja');
    return japanese?.index ?? tracks[0].index;
  }
  
  // Check for saved user preference from localStorage
  const savedPreference = typeof window !== 'undefined' 
    ? localStorage.getItem('preferred_audio_language') 
    : null;
  
  const effectivePreference = userPreference || savedPreference;
  
  // For Donghua, prioritize Chinese
  if (isDonghua(animeTitle)) {
    const chineseTrack = tracks.find(t => {
      const normalized = normalizeLanguageCode(t.lang);
      const labelDetection = detectLanguageFromLabel(t.label);
      return normalized === 'zh' || normalized === 'cmn' || normalized === 'chi' ||
             (labelDetection && (labelDetection.code === 'zh' || labelDetection.code === 'cmn'));
    });
    if (chineseTrack) return chineseTrack.index;
  }
  
  // For anime with Japanese default override (e.g., Adam's Sweet Agony)
  if (animeTitle && JAPANESE_DEFAULT_TITLES.some(t => animeTitle.toLowerCase().includes(t))) {
    const japaneseTrack = tracks.find(t => {
      const normalized = normalizeLanguageCode(t.lang);
      const labelDetection = detectLanguageFromLabel(t.label);
      return normalized === 'ja' || normalized === 'jpn' ||
             (labelDetection && (labelDetection.code === 'ja' || labelDetection.code === 'jpn'));
    });
    if (japaneseTrack) return japaneseTrack.index;
  }
  
  // Priority order: Hindi first (default for Indian anime platform), then others
  // User preference overrides default order
  const priorityOrder = effectivePreference 
    ? [effectivePreference, 'hi', 'hin', 'ja', 'jpn', 'en', 'eng', 'zh']
    : ['hi', 'hin', 'ja', 'jpn', 'en', 'eng', 'zh'];
  
  // Find track by priority - check both lang code and label
  for (const preferredLang of priorityOrder) {
    const track = tracks.find(t => {
      const normalized = normalizeLanguageCode(t.lang);
      const labelDetection = detectLanguageFromLabel(t.label);
      return normalized === preferredLang || 
             normalizeLanguageCode(preferredLang) === normalized ||
             (labelDetection && (labelDetection.code === preferredLang || labelDetection.code === normalizeLanguageCode(preferredLang)));
    });
    if (track) return track.index;
  }
  
  // Fallback to first track
  return 0;
}

/** Content language when a browser exposes no native track metadata. */
export function getContentAudioLabel(isSubOnly: boolean, language?: string): string {
  if (isSubOnly) return '🇯🇵 Japanese';
  const code = normalizeLanguageCode(language);
  return code !== 'und' ? getAudioTrackLabel('', code, 0) : 'Audio';
}

/**
 * Validate and repair audio metadata for storage
 */
export function validateAudioMetadata(
  langCode: string | undefined,
  trackTitle: string | undefined
): { code: string; name: string } {
  // Try to get valid language info
  const normalizedCode = normalizeLanguageCode(langCode);
  if (normalizedCode !== 'und' && LANGUAGE_CODE_MAP[normalizedCode]) {
    const langInfo = LANGUAGE_CODE_MAP[normalizedCode];
    return { code: normalizedCode, name: langInfo.name };
  }
  
  // Try label parsing
  const labelDetection = detectLanguageFromLabel(trackTitle);
  if (labelDetection) {
    return { code: labelDetection.code, name: labelDetection.name };
  }
  
  // Return original with fallback
  return { code: langCode || 'und', name: 'Unknown' };
}
