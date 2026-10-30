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
    { label: 'Help Center · @AnimeSaviInhindiDUB', href: 'https://t.me/AnimeSaviInhindiDUB', external: true },
    { label: 'Contact Us · @Lv_Savi', href: 'https://t.me/Lv_Savi', external: true },
    { label: 'Terms of Service', href: '/terms', isTerms: true },
    { label: 'Privacy Policy', href: '/privacy', isPrivacy: true },
  ],
};

const privacySections = [
  { icon: Database, title: 'Information We Collect', tone: 'text-primary', body: 'Account data includes your email, username and optional avatar. Watch history, favorites, saved lists, reviews, comments, genre preferences and notification subscriptions may be stored with your account. Your browser also stores sign-in sessions, viewing settings, resume checkpoints and any videos you choose to save offline. Requests may generate operational logs used for security and reliability.' },
  { icon: UserCheck, title: 'How We Use Your Information', tone: 'text-primary', body: 'We use account and viewing information to sign you in, sync progress, personalize recommendations, deliver requested notifications, manage access and prevent abuse. Service providers supporting authentication, storage, delivery and monitoring may process data to provide these functions. We do not sell your personal information.' },
  { icon: Server, title: 'Content & Third-Party Services', tone: 'text-primary', body: 'The service uses cloud storage and may also load third-party media, embeds and external links. Those providers receive information needed to process requests, such as your IP address and browser information, and apply their own policies. A catalogue label naming a distributor does not establish an official partnership. External players and links are outside our control.' },
  { icon: Lock, title: 'Data Security', tone: 'text-amber-400', body: 'Passwords are encrypted using industry-standard hashing algorithms. We never store or have access to plain text passwords. All communication between your browser and our servers is encrypted via HTTPS/TLS. Account sessions are managed securely with automatic expiration.' },
  { icon: Cookie, title: 'Cookies & Local Storage', tone: 'text-orange-400', body: 'We use browser local storage to save your preferences, watch history checkpoints, referral cooldowns, and session tokens. We do not use third-party cookies for advertising or tracking purposes. You may clear this data at any time through your browser settings.' },
  { icon: Sparkles, title: 'Cleanup & Your Choices', tone: 'text-primary', body: 'After confirmation, Clear cached images & data removes the named image caches on this device and your account-wide Continue Watching history, including Shadow entries and local resume checkpoints. It preserves favorites, saved lists, offline videos, sign-in and catalogue metadata. Browser-level storage clearing is different and may remove offline videos and sessions. Data Saver limits supported streams to 1080p or below; the Mature Content Filter is a display preference, not parental access control.' },
  { icon: UserCheck, title: 'Retention & Account Removal', tone: 'text-primary', body: 'Account data is retained while needed to provide the service, meet legal obligations and handle security incidents. Use Delete my Account in Settings or contact @Lv_Savi to request removal or ask about access and correction. Operational backups or legally required records may remain for a limited period; this page does not promise a fixed deletion deadline. Offline copies on your device must be removed separately.' },
  { icon: Baby, title: "Children's Privacy", tone: 'text-rose-400', body: 'Our service is not intended for children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.' },
];

function PrivacyPolicyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost"
        onClick={() => setOpen(true)}
        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors text-left flex items-center justify-start gap-1"
      >
        <Shield className="h-3 w-3" />
        Privacy Policy
      </Button>
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
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">October 30, 2026</span>
                  </div>
                  <DialogTitle className="text-2xl font-heading">
                    Your <span className="anime-gradient-text">Privacy</span>, Respected
                  </DialogTitle>
                  <DialogDescription id="privacy-policy-description" className="mt-1.5 text-sm text-muted-foreground">
                    Account information, viewing data and your privacy choices.
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
                  This policy covers AnimeSavi accounts, viewing activity, cloud services and device storage. External services have their own policies.
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
  { icon: Globe2, title: 'Nature of Service', tone: 'text-primary', body: 'AnimeSavi provides catalogue discovery, playback where available, account lists, viewing history, reviews and supported offline saving. Media may be delivered through cloud storage or external providers. Availability and supported quality vary by source, device and network. Distributor names in the catalogue do not imply an official partnership or a grant of rights.' },
  { icon: UserCheck, title: 'Eligibility & Accounts', tone: 'text-emerald-400', list: ['You must be at least 13 years old to use this Service', 'You are responsible for all activity under your account', 'Account sharing or transfer is prohibited', 'A maximum of 5 accounts may be created per user', 'Referral rewards are limited to one friend per user; repeated abuse can trigger temporary bans or account restrictions', 'We reserve the right to suspend accounts at our sole discretion', 'Providing false information may result in permanent ban'] },
  { icon: Ban, title: 'Acceptable Use', tone: 'text-rose-400', intro: 'You agree not to:', list: ['Use the Service for any unlawful or unauthorized purpose', 'Attempt to gain unauthorized access to our systems', 'Upload malicious code, spam, or harmful content', 'Harass, abuse, or threaten other users', 'Use automated tools, bots, or scrapers without written permission', 'Circumvent security measures or access restrictions', 'Redistribute or commercially exploit any part of the Service', 'Abuse the token access system, referral system, or share access tokens'] },
  { icon: Server, title: 'Playback, Downloads & External Content', tone: 'text-primary', body: 'Only access, upload or save content when you have the necessary rights and permission under applicable law. A download or embed option is not a copyright license. External content and services may change or disappear. Adaptive bitrate may reduce quality to keep playback stable; Data Saver caps supported renditions at 1080p or below and cannot transcode a single-resolution file or control an external iframe.' },
  { icon: Database, title: 'Storage & Cleanup', tone: 'text-primary', body: 'Confirmed image cleanup removes cached images and account-wide Continue Watching, not favorites, saved lists or offline videos. Offline videos use device storage and remain until separately deleted or browser storage is removed. Access tokens expire under their displayed terms; offline availability does not grant redistribution rights. The Mature Content Filter changes discovery display and is not an age-verification or parental security mechanism.' },
  { icon: Copyright, title: 'Intellectual Property', tone: 'text-amber-400', body: 'The AnimeSavi name, logo, design, and original code are our exclusive property. All anime titles, characters, and artwork belong to their respective copyright holders. We make no ownership claim over any indexed content.' },
  { icon: MessagesSquare, title: 'User Content & Reviews', tone: 'text-fuchsia-400', body: 'By posting comments, reviews, or other content, you grant AnimeSavi a non-exclusive, royalty-free license to display and distribute such content on the platform. All reviews are displayed anonymously to protect user privacy. You retain ownership and are solely responsible for ensuring your content does not violate any laws or third-party rights.' },
  { icon: AlertTriangle, title: 'Disclaimer & Liability', tone: 'text-primary', body: 'To the extent permitted by applicable law, the service is provided as available without a guarantee of uninterrupted playback, particular quality or permanent availability. Nothing in these terms excludes rights, remedies or liabilities that cannot lawfully be excluded, including applicable consumer protections.' },
  { icon: Scale, title: 'Copyright Reports', tone: 'text-primary', body: 'If you believe content infringes your rights, contact @Lv_Savi with the content URL, identification of the protected work, your contact information and a description of your authority to report it. We review reports and may remove or restrict content. This contact process does not claim a particular legal safe-harbor status.' },
  { icon: RefreshCw, title: 'Changes & Termination', tone: 'text-teal-400', body: 'We may modify these Terms at any time. Continued use after changes constitutes acceptance. We may terminate or restrict access to the Service at any time without prior notice or liability.' },
  { icon: Mail, title: 'Contact', tone: 'text-blue-400', body: 'For questions, concerns, or DMCA notices, contact us via Telegram: @Lv_Savi' },
];

function TermsOfServiceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost"
        onClick={() => setOpen(true)}
        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors text-left flex items-center justify-start gap-1"
      >
        <FileText className="h-3 w-3" />
        Terms of Service
      </Button>
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
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Updated October 30, 2026</span>
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
                  Use AnimeSavi lawfully and respect creators’ rights. These terms describe available features, not permission to access or redistribute protected content.
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
                        <ul className="space-y-2 mt-1">
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
  return <footer className="footer-v6 mt-auto border-t border-border">
    <div className="container py-7 md:py-9">
      <div className="flex flex-wrap items-center justify-between gap-5 pb-6 border-b border-border">
        <div><Link to="/" className="inline-flex items-center gap-2.5"><img src={logo} alt="" className="h-9 w-9 object-contain" /><span className="text-xl font-bold"><span className="text-primary">Anime</span> Savi</span></Link><p className="text-xs text-muted-foreground mt-2">Hindi · English · Japanese</p></div>
        <Button asChild variant="glass" size="sm"><a href="https://t.me/AnimeSaviInhindiDUB" target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Join the community<ExternalLink className="h-3.5 w-3.5" /></a></Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6 py-6">
        <nav aria-label="Footer browse"><h3 className="text-xs font-semibold mb-3">Browse</h3><ul className="space-y-2">{footerLinks.browse.map(link => <li key={link.href}><Link to={link.href} className="text-xs text-muted-foreground hover:text-foreground">{link.label}</Link></li>)}</ul></nav>
        <nav aria-label="Footer genres"><h3 className="text-xs font-semibold mb-3">Genres</h3><ul className="space-y-2">{footerLinks.genres.map(link => <li key={link.href}><Link to={link.href} className="text-xs text-muted-foreground hover:text-foreground">{link.label}</Link></li>)}</ul></nav>
        <nav aria-label="Footer support" className="col-span-2 md:col-span-1"><h3 className="text-xs font-semibold mb-3">Legal & support</h3><ul className="space-y-2">{footerLinks.support.map(link => <li key={link.label}>{link.external ? <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">{link.label}<ExternalLink className="h-3 w-3 shrink-0" /></a> : link.isPrivacy ? <PrivacyPolicyButton /> : link.isTerms ? <TermsOfServiceButton /> : <Link to={link.href}>{link.label}</Link>}</li>)}</ul></nav>
      </div>
      <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground"><span>©{new Date().getFullYear()} Anime Savi · All rights reserved</span><Link to="/release-notes" className="inline-flex items-center gap-1 hover:text-foreground"><Sparkles className="h-3 w-3" />Release notes<ExternalLink className="h-3 w-3" /></Link></div>
    </div>
  </footer>;
}
