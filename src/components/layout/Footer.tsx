import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Mail, MessageCircle, Heart, Shield, FileText, ExternalLink } from 'lucide-react';
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
        <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-primary" />
              Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 text-sm text-muted-foreground pr-4">
              <p className="text-foreground font-medium">Last Updated: January 2026</p>
              
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-foreground font-medium text-center">
                  Anime.Savi.me does not store any files on own server. We only index links from internet which are hosted on third-party services. We Index Links Just Like Google.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Content Indexing</h3>
                <p>
                  Anime Savi functions as a search engine and content aggregator. We do not host, upload, or store any video files on our servers. All content is indexed from publicly available third-party sources.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Local Storage & Cookies</h3>
                <p>
                  We use local storage to save your preferences including watch history, favorites, theme settings, and playback preferences. This data remains on your device and is never transmitted to external servers.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Third-Party Content</h3>
                <p>
                  All video content accessible through our platform is hosted by independent third-party services. Each service operates under its own privacy policy. We have no control over their data practices.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Account Information</h3>
                <p>
                  When you create an account, we collect your email address and username for authentication. Passwords are encrypted using industry-standard methods. We never store or have access to plain text passwords.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Analytics</h3>
                <p>
                  We may collect anonymous usage statistics to improve our service. This includes page views and general interaction patterns. No personally identifiable information is collected without consent.
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
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-primary" />
              Terms of Service
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 text-sm text-muted-foreground pr-4">
              <p className="text-foreground font-medium">Last Updated: January 2026</p>
              
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-foreground font-medium text-center">
                  Anime.Savi.me does not store any files on own server. We only index links from internet which are hosted on third-party services. We Index Links Just Like Google.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">1. Acceptance of Terms</h3>
                <p>
                  By accessing and using Anime Savi ("the Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, you must discontinue use immediately.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">2. Nature of Service</h3>
                <p>
                  Anime Savi operates as a content indexing and discovery platform, similar to search engines like Google. We aggregate and index links to anime content hosted on independent third-party servers. We do not host, upload, store, or control any video files on our servers.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">3. User Accounts & Eligibility</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>You must be at least 13 years old to create an account</li>
                  <li>You are solely responsible for maintaining account security</li>
                  <li>Account sharing is prohibited</li>
                  <li>You are liable for all activities conducted under your account</li>
                  <li>We reserve the right to suspend or terminate accounts without notice</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">4. Prohibited Activities</h3>
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use the Service for any unlawful purpose</li>
                  <li>Attempt unauthorized access to our systems or user data</li>
                  <li>Interfere with or disrupt Service functionality</li>
                  <li>Upload malicious code, spam, or harmful content</li>
                  <li>Harass, threaten, or abuse other users</li>
                  <li>Scrape, crawl, or collect data without authorization</li>
                  <li>Deploy automated tools or bots without written permission</li>
                  <li>Circumvent any security measures or access restrictions</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">5. Third-Party Content Disclaimer</h3>
                <p>
                  All video content accessible through Anime Savi is hosted on independent third-party platforms. We do not control, verify, endorse, or assume any responsibility for third-party content, including its accuracy, legality, or quality. Your use of third-party content is at your own risk.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">6. Intellectual Property Rights</h3>
                <p>
                  The Anime Savi brand, logo, website design, and original content are our exclusive intellectual property. All anime titles, characters, artwork, and related media are the property of their respective copyright holders. We make no claim of ownership over indexed content.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">7. User-Generated Content</h3>
                <p>
                  By submitting content (comments, reviews, profile information), you grant Anime Savi a non-exclusive, royalty-free, worldwide license to display, reproduce, and distribute such content. You retain ownership and are responsible for ensuring your content does not infringe on third-party rights.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">8. Disclaimer of Warranties</h3>
                <p>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">9. Limitation of Liability</h3>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, ANIME SAVI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">10. DMCA & Copyright Claims</h3>
                <p>
                  We respect intellectual property rights. If you believe any indexed content infringes your copyright, please submit a valid DMCA takedown notice via our Telegram channel. We will review and respond to legitimate claims in accordance with applicable law.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">11. Modifications to Terms</h3>
                <p>
                  We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the Service after modifications constitutes acceptance of the updated Terms.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">12. Contact</h3>
                <p>
                  For questions, concerns, or DMCA notices, contact us via our official Telegram channel: @AnimeSaviInhindiDUB
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
                href="#"
                className="p-2.5 rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2.5 rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://t.me/AnimeSaviInhindiDUB"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2.5 rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all duration-300"
              >
                <Mail className="h-4 w-4" />
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
