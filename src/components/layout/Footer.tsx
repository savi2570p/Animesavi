import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Heart, Shield, FileText, ExternalLink, Lock, Database, Cookie, UserCheck, Baby, Server, Sparkles, Scale, AlertTriangle, Copyright, MessagesSquare, Ban, RefreshCw, Mail, BookCheck, Globe2 } from 'lucide-react';
import logo from '@/assets/logo.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const footerLinks = {
  browse: [
    { label: 'Popular Anime', href: '/browse?sort=popular' },
    { label: 'New Releases', href: '/browse?sort=new' },
    { label: 'Ongoing Series', href: '/browse?status=ongoing' },
    { label: 'Movies', href: '/browse?type=movie' },
  ],
  genres: [
    { label: 'Action', href: '/browse?genre=action' },
    { label: 'Romance', href: '/browse?genre=romance' },
    { label: 'Comedy', href: '/browse?genre=comedy' },
    { label: 'Fantasy', href: '/browse?genre=fantasy' },
    { label: 'Sony YAY', href: '/browse?genre=Sony%20YAY' },
  ],
  support: [
    { label: 'Help Center · @animesaviinhindidub', href: 'https://t.me/animesaviinhindidub', external: true },
    { label: 'Contact Us · @Lv_Savi', href: 'https://t.me/Lv_Savi', external: true },
    { label: 'Terms of Service', href: '/terms', isTerms: true },
    { label: 'Privacy Policy', href: '/privacy', isPrivacy: true },
  ],
};

const privacySections = [
  { icon: Database, title: 'Information We Collect', tone: 'text-sky-400', body: 'We collect only the minimum information necessary: your email address and username when you create an account. We also store your viewing preferences, watch history, and favorites locally on your device using browser storage. We do not collect device fingerprints or tracking profiles beyond what is essential for authentication, abuse prevention, security, and service reliability.' },
  { icon: UserCheck, title: 'How We Use Your Information', tone: 'text-emerald-400', body: 'Your account information is used for authentication, personalization, watch history sync, recommendations, referral access, and security abuse prevention. We do not sell, rent, or share your personal data with any third parties. Your viewing preferences are used to provide recommendations and improve your experience. We do not run third-party analytics or advertising scripts.' },
  { icon: Server, title: 'Content & Third-Party Services', tone: 'text-violet-400', body: 'All video content is hosted on independent third-party platforms including but not limited to services affiliated with Crunchyroll, Muse India, Sony YAY, and Amazon Prime. We act as an indexing service and have no control over third-party data practices, content availability, or server reliability. Each third-party service operates under its own privacy policy.' },
  { icon: Lock, title: 'Data Security', tone: 'text-amber-400', body: 'Passwords are encrypted using industry-standard hashing algorithms. We never store or have access to plain text passwords. All communication between your browser and our servers is encrypted via HTTPS/TLS. Account sessions are managed securely with automatic expiration.' },
  { icon: Cookie, title: 'Cookies & Local Storage', tone: 'text-orange-400', body: 'We use browser local storage to save your preferences, watch history checkpoints, referral cooldowns, and session tokens. We do not use third-party cookies for advertising or tracking purposes. You may clear this data at any time through your browser settings.' },
  { icon: Sparkles, title: 'Your Rights', tone: 'text-fuchsia-400', body: 'You may request account/data removal at any time. You can clear your local viewing history and preferences through your browser settings. For data removal requests, contact us via our official Telegram channel: @Lv_Savi' },
  { icon: Baby, title: "Children's Privacy", tone: 'text-rose-400', body: 'Our service is not intended for children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.' },
];

function PrivacyPolicyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-1"
      >
        <Shield className="h-3 w-3" />
        Privacy Policy
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden" aria-describedby="privacy-policy-description">
          {/* Cinematic Header */}
          <div className="relative overflow-hidden border-b border-border/40">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-card/50 to-fuchsia-500/15" />
            <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-8 h-44 w-44 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
            <DialogHeader className="relative p-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-xl" />
                  <div className="relative p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
                    <Shield className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Updated
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">May 2026</span>
                  </div>
                  <DialogTitle className="text-2xl font-heading">
                    Your <span className="anime-gradient-text">Privacy</span>, Respected
                  </DialogTitle>
                  <DialogDescription id="privacy-policy-description" className="mt-1.5 text-sm text-muted-foreground">
                    No selling. No tracking pixels. Just an indexing service that keeps your data lean.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[60vh] px-6 py-5">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/25">
                <BookCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium">
                  AnimeSavi does not store any files on its own server. We only index links from the internet which are hosted on third-party services — we index links just like Google.
                </p>
              </div>

              {privacySections.map((s, i) => (
                <div key={s.title} className="group relative overflow-hidden rounded-xl bg-card/40 border border-border/40 p-4 hover:border-border/70 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 p-2 rounded-lg bg-card/80 ${s.tone}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold tabular-nums ${s.tone}`}>0{i + 1}</span>
                        <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/40 bg-card/40">
            <a href="https://t.me/Lv_Savi" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              @Lv_Savi
            </a>
            <Button onClick={() => setOpen(false)} className="anime-button">
              <span>I Understand</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const termsSections = [
  { icon: BookCheck, title: 'Acceptance of Terms', tone: 'text-primary', body: 'By accessing and using AnimeSavi ("the Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, discontinue use immediately. These Terms constitute a legally binding agreement between you and AnimeSavi.' },
  { icon: Globe2, title: 'Nature of Service', tone: 'text-sky-400', body: 'AnimeSavi is a content indexing and discovery platform. We aggregate and index publicly available links to anime content hosted on independent third-party servers including platforms affiliated with Crunchyroll, Muse India, Sony YAY, Amazon Prime, and others. We do not host, upload, store, or have any control over video files. Our role is functionally equivalent to a search engine.' },
  { icon: UserCheck, title: 'Eligibility & Accounts', tone: 'text-emerald-400', list: ['You must be at least 13 years old to use this Service', 'You are responsible for all activity under your account', 'Account sharing or transfer is prohibited', 'A maximum of 5 accounts may be created per user', 'Referral rewards are limited to one friend per user; repeated abuse can trigger temporary bans or account restrictions', 'We reserve the right to suspend accounts at our sole discretion', 'Providing false information may result in permanent ban'] },
  { icon: Ban, title: 'Acceptable Use', tone: 'text-rose-400', intro: 'You agree not to:', list: ['Use the Service for any unlawful or unauthorized purpose', 'Attempt to gain unauthorized access to our systems', 'Upload malicious code, spam, or harmful content', 'Harass, abuse, or threaten other users', 'Use automated tools, bots, or scrapers without written permission', 'Circumvent security measures or access restrictions', 'Redistribute or commercially exploit any part of the Service', 'Abuse the token access system, referral system, or share access tokens'] },
  { icon: Server, title: 'Third-Party Content', tone: 'text-violet-400', body: 'All video content accessible through AnimeSavi is hosted on independent third-party platforms over which we have no control. Content may originate from services such as Crunchyroll, Muse India, Sony YAY, Amazon Prime, and other distributors. We do not verify, endorse, or assume responsibility for third-party content including its accuracy, legality, quality, or availability. Your interaction with third-party content is entirely at your own risk.' },
  { icon: Copyright, title: 'Intellectual Property', tone: 'text-amber-400', body: 'The AnimeSavi name, logo, design, and original code are our exclusive property. All anime titles, characters, and artwork belong to their respective copyright holders. We make no ownership claim over any indexed content.' },
  { icon: MessagesSquare, title: 'User Content & Reviews', tone: 'text-fuchsia-400', body: 'By posting comments, reviews, or other content, you grant AnimeSavi a non-exclusive, royalty-free license to display and distribute such content on the platform. All reviews are displayed anonymously to protect user privacy. You retain ownership and are solely responsible for ensuring your content does not violate any laws or third-party rights.' },
  { icon: AlertTriangle, title: 'Disclaimer & Liability', tone: 'text-orange-400', body: 'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE ARE NOT LIABLE FOR ANY DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. USE THE SERVICE AT YOUR OWN RISK.' },
  { icon: Scale, title: 'DMCA & Copyright', tone: 'text-yellow-400', body: 'We respect intellectual property rights. If you believe indexed content infringes your copyright, submit a DMCA notice via our Telegram channel: @Lv_Savi. We will respond to legitimate claims promptly.' },
  { icon: RefreshCw, title: 'Changes & Termination', tone: 'text-teal-400', body: 'We may modify these Terms at any time. Continued use after changes constitutes acceptance. We may terminate or restrict access to the Service at any time without prior notice or liability.' },
  { icon: Mail, title: 'Contact', tone: 'text-blue-400', body: 'For questions, concerns, or DMCA notices, contact us via Telegram: @Lv_Savi' },
];

function TermsOfServiceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-1"
      >
        <FileText className="h-3 w-3" />
        Terms of Service
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden" aria-describedby="terms-of-service-description">
          {/* Cinematic Header */}
          <div className="relative overflow-hidden border-b border-border/40">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-card/50 to-primary/15" />
            <div className="absolute -top-16 -right-12 h-44 w-44 rounded-full bg-amber-500/25 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-8 h-44 w-44 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <DialogHeader className="relative p-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl bg-amber-500/40 blur-xl" />
                  <div className="relative p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                    <Scale className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      <FileText className="h-2.5 w-2.5" />
                      Legal
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Updated May 2026</span>
                  </div>
                  <DialogTitle className="text-2xl font-heading">
                    Terms of <span className="anime-gradient-text">Service</span>
                  </DialogTitle>
                  <DialogDescription id="terms-of-service-description" className="mt-1.5 text-sm text-muted-foreground">
                    The ground rules — short, fair, and written so a human can actually read them.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[65vh] px-6 py-5">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <BookCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium">
                  AnimeSavi does not store any files on its own server. We only index links from the internet which are hosted on third-party services — we index links just like Google.
                </p>
              </div>

              {termsSections.map((s, i) => (
                <div key={s.title} className="group relative overflow-hidden rounded-xl bg-card/40 border border-border/40 p-4 hover:border-border/70 transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 p-2 rounded-lg bg-card/80 ${s.tone}`}>
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold tabular-nums ${s.tone}`}>{String(i + 1).padStart(2, '0')}</span>
                        <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                      </div>
                      {s.body && <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>}
                      {s.intro && <p className="text-xs text-muted-foreground leading-relaxed mb-2">{s.intro}</p>}
                      {s.list && (
                        <ul className="space-y-1.5 mt-1">
                          {s.list.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className={`shrink-0 mt-1.5 h-1 w-1 rounded-full ${s.tone.replace('text-', 'bg-')}`} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/40 bg-card/40 flex-wrap">
            <a href="https://t.me/Lv_Savi" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              DMCA · @Lv_Savi
            </a>
            <Button onClick={() => setOpen(false)} className="anime-button">
              <span>I Agree</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/30 bg-card/30 backdrop-blur-sm mt-auto">
      <div className="container py-5 md:py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5 md:gap-6">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-2 group">
              <img 
                src={logo} 
                alt="Anime Savi" 
                className="h-8 w-8 rounded-lg object-contain transition-transform duration-300 group-hover:scale-110" 
              />
              <span className="text-base font-heading font-bold anime-gradient-text">
                Anime Savi
              </span>
            </Link>
            <p className="text-xs text-muted-foreground mb-3 leading-snug">
              Anime in 4K — official Hindi dubs, same-day drops, zero ads.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://t.me/animesaviinhindidub"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Telegram group @animesaviinhindidub"
                title="Message the group · @animesaviinhindidub"
                className="p-2.5 rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Browse */}
          <div>
            <h3 className="font-heading font-semibold mb-4 text-foreground">Browse</h3>
            <ul className="space-y-2.5">
              {footerLinks.browse.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-1"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Genres */}
          <div>
            <h3 className="font-heading font-semibold mb-4 text-foreground">Genres</h3>
            <ul className="space-y-2.5">
              {footerLinks.genres.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-heading font-semibold mb-4 text-foreground">Legal & Support</h3>
            <ul className="space-y-2.5">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-1"
                    >
                      {link.label}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : link.isPrivacy ? (
                    <PrivacyPolicyButton />
                  ) : link.isTerms ? (
                    <TermsOfServiceButton />
                  ) : (
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border/30 mt-4 pt-3 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[11px] text-muted-foreground">
            ©{new Date().getFullYear()} Anime Savi all rights reserved
          </p>
      </div>
    </footer>
  );
}
