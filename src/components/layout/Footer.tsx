import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Heart, Shield, FileText, ExternalLink } from 'lucide-react';
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
  ],
  support: [
    { label: 'Help Center', href: 'https://t.me/AnimeSaviInhindiDUB', external: true },
    { label: 'Contact Us', href: 'https://t.me/AnimeSaviInhindiDUB', external: true },
    { label: 'Terms of Service', href: '/terms', isTerms: true },
    { label: 'Privacy Policy', href: '/privacy', isPrivacy: true },
  ],
};

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
        <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-border/50" aria-describedby="privacy-policy-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-primary" />
              Privacy Policy
            </DialogTitle>
            <DialogDescription id="privacy-policy-description" className="sr-only">
              Privacy policy and data handling information for Anime Savi
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 text-sm text-muted-foreground pr-4">
              <p className="text-foreground font-medium">Last Updated: February 2026</p>
              
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-foreground font-medium text-center">
                  Anime.Savi.me does not store any files on its own server. We only index links from the internet which are hosted on third-party services. We index links just like Google.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">1. Information We Collect</h3>
                <p>
                  We collect only the minimum information necessary: your email address and username when you create an account. We also store your viewing preferences, watch history, and favorites locally on your device using browser storage.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">2. How We Use Your Information</h3>
                <p>
                  Your account information is used solely for authentication and personalization. We do not sell, rent, or share your personal data with any third parties. Your viewing preferences are used to provide recommendations and improve your experience.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">3. Content & Third-Party Services</h3>
                <p>
                  All video content is hosted on independent third-party platforms. We act as an indexing service and have no control over third-party data practices, content availability, or server reliability. Each third-party service operates under its own privacy policy.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">4. Data Security</h3>
                <p>
                  Passwords are encrypted using industry-standard hashing algorithms. We never store or have access to plain text passwords. All communication between your browser and our servers is encrypted via HTTPS/TLS.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">5. Your Rights</h3>
                <p>
                  You may delete your account and all associated data at any time. You can clear your local viewing history and preferences through your browser settings. For data removal requests, contact us via our official Telegram channel: @AnimeSaviInhindiDUB
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">6. Children's Privacy</h3>
                <p>
                  Our service is not intended for children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us immediately.
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setOpen(false)} className="anime-button">
              <span>I Understand</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border/50" aria-describedby="terms-of-service-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              Terms of Service
            </DialogTitle>
            <DialogDescription id="terms-of-service-description" className="sr-only">
              Terms of service and usage conditions for Anime Savi
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 text-sm text-muted-foreground pr-4">
              <p className="text-foreground font-medium">Last Updated: February 2026</p>
              
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-foreground font-medium text-center">
                  Anime.Savi.me does not store any files on its own server. We only index links from the internet which are hosted on third-party services. We index links just like Google.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">1. Acceptance of Terms</h3>
                <p>
                  By accessing and using Anime Savi ("the Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, discontinue use immediately. These Terms constitute a legally binding agreement between you and Anime Savi.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">2. Nature of Service</h3>
                <p>
                  Anime Savi is a content indexing and discovery platform. We aggregate and index publicly available links to anime content hosted on independent third-party servers. We do not host, upload, store, or have any control over video files. Our role is functionally equivalent to a search engine.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">3. Eligibility & Accounts</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>You must be at least 13 years old to use this Service</li>
                  <li>You are responsible for all activity under your account</li>
                  <li>Account sharing or transfer is prohibited</li>
                  <li>We reserve the right to suspend accounts at our sole discretion</li>
                  <li>Providing false information may result in permanent ban</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">4. Acceptable Use</h3>
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use the Service for any unlawful or unauthorized purpose</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Upload malicious code, spam, or harmful content</li>
                  <li>Harass, abuse, or threaten other users</li>
                  <li>Use automated tools, bots, or scrapers without written permission</li>
                  <li>Circumvent security measures or access restrictions</li>
                  <li>Redistribute or commercially exploit any part of the Service</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">5. Third-Party Content</h3>
                <p>
                  All video content accessible through Anime Savi is hosted on independent third-party platforms over which we have no control. We do not verify, endorse, or assume responsibility for third-party content including its accuracy, legality, quality, or availability. Your interaction with third-party content is entirely at your own risk.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">6. Intellectual Property</h3>
                <p>
                  The Anime Savi name, logo, design, and original code are our exclusive property. All anime titles, characters, and artwork belong to their respective copyright holders. We make no ownership claim over any indexed content.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">7. User Content</h3>
                <p>
                  By posting comments, reviews, or other content, you grant Anime Savi a non-exclusive, royalty-free license to display and distribute such content on the platform. You retain ownership and are solely responsible for ensuring your content does not violate any laws or third-party rights.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">8. Disclaimer & Limitation of Liability</h3>
                <p>
                  THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE ARE NOT LIABLE FOR ANY DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. USE THE SERVICE AT YOUR OWN RISK.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">9. DMCA & Copyright</h3>
                <p>
                  We respect intellectual property rights. If you believe indexed content infringes your copyright, submit a DMCA notice via our Telegram channel: @AnimeSaviInhindiDUB. We will respond to legitimate claims promptly.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">10. Changes & Termination</h3>
                <p>
                  We may modify these Terms at any time. Continued use after changes constitutes acceptance. We may terminate or restrict access to the Service at any time without prior notice or liability.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">11. Contact</h3>
                <p>
                  For questions, concerns, or DMCA notices, contact us via Telegram: @AnimeSaviInhindiDUB
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
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
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4 group">
              <img 
                src={logo} 
                alt="Anime Savi" 
                className="h-12 w-12 rounded-xl object-contain transition-transform duration-300 group-hover:scale-110" 
              />
              <span className="text-xl font-heading font-bold anime-gradient-text">
                Anime Savi
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Your ultimate destination for streaming the best anime content. Discover, watch, and enjoy thousands of anime series and movies.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://t.me/AnimeSaviInhindiDUB"
                target="_blank"
                rel="noopener noreferrer"
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
        <div className="border-t border-border/30 mt-10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            ©{new Date().getFullYear()} Anime Savi all rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
