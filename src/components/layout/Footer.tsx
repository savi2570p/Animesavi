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
              <p className="text-foreground font-medium">Last Updated: December 2024</p>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Data Collection</h3>
                <p>
                  Anime.Savi.me does not store any video files on our servers. We only index links from the internet which are hosted on third-party services, similar to how search engines operate.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Cookies & Local Storage</h3>
                <p>
                  We use local storage to save your preferences such as watch history, favorites, and theme settings. This data is stored locally on your device and is never transmitted to our servers.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Third-Party Services</h3>
                <p>
                  Video content is provided by third-party hosting services. Each service has its own privacy policy that governs how they handle data. We recommend reviewing their policies.
                </p>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-foreground font-semibold">Account Data</h3>
                <p>
                  If you create an account, we store your email address and username for authentication purposes. Your password is encrypted and we never have access to it in plain text.
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
              <p className="text-foreground font-medium">Last Updated: December 2024</p>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">1. Acceptance of Terms</h3>
                <p>
                  By accessing and using Anime.Savi.me ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">2. Description of Service</h3>
                <p>
                  Anime.Savi.me is a streaming index platform that aggregates anime content links from various third-party sources. We do not host, upload, or store any video content on our servers. Our Service functions as a content discovery and indexing platform only.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">3. User Accounts</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>You must be at least 13 years old to create an account</li>
                  <li>You are responsible for maintaining the security of your account</li>
                  <li>You must not share your account credentials with others</li>
                  <li>You are responsible for all activities under your account</li>
                  <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">4. Acceptable Use Policy</h3>
                <p>You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use the Service for any illegal purposes</li>
                  <li>Attempt to gain unauthorized access to our systems</li>
                  <li>Interfere with the proper functioning of the Service</li>
                  <li>Upload malicious content or spam</li>
                  <li>Harass or abuse other users</li>
                  <li>Scrape or collect user data without authorization</li>
                  <li>Use bots or automated scripts without permission</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">5. Content Disclaimer</h3>
                <p>
                  All anime content accessible through our Service is hosted by third-party providers. We do not control, endorse, or assume responsibility for any third-party content. We respect intellectual property rights and will respond to valid DMCA takedown requests.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">6. Intellectual Property</h3>
                <p>
                  The Anime.Savi.me name, logo, and website design are our intellectual property. Anime titles, characters, and related media remain the property of their respective owners.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">7. User-Generated Content</h3>
                <p>
                  By uploading content (comments, profile information, etc.), you grant us a non-exclusive license to display and use that content. You retain ownership of your content and are responsible for ensuring it doesn't violate others' rights.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">8. Limitation of Liability</h3>
                <p>
                  The Service is provided "as is" without warranties. We are not liable for any damages arising from your use of the Service, including but not limited to direct, indirect, incidental, or consequential damages.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">9. Service Modifications</h3>
                <p>
                  We reserve the right to modify, suspend, or discontinue the Service at any time without prior notice. We may also update these terms periodically, and continued use constitutes acceptance of changes.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">10. DMCA & Copyright</h3>
                <p>
                  We respect copyright holders' rights. If you believe content indexed on our platform infringes your copyright, please contact us with a valid DMCA notice and we will take appropriate action.
                </p>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-foreground font-semibold text-base">11. Contact Information</h3>
                <p>
                  For questions regarding these Terms of Service, please contact us through our Telegram channel or email.
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
                alt="Anime.Savi.me" 
                className="h-12 w-12 rounded-xl object-contain transition-transform duration-300 group-hover:scale-110" 
              />
              <span className="text-xl font-heading font-bold anime-gradient-text">
                Anime.Savi.me
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
            ©{new Date().getFullYear()} Anime.Savi.Me all rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
