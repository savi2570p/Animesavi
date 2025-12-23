import { Link } from 'react-router-dom';
import { Github, Twitter, Mail } from 'lucide-react';
import logo from '@/assets/logo.png';

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
    { label: 'Help Center', href: '/help' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50 mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={logo} alt="Anime.Savi.me" className="h-10 w-10 rounded-lg object-contain" />
              <span className="text-xl font-heading font-bold anime-gradient-text">
                Anime.Savi.me
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Your ultimate destination for streaming the best anime content.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-muted hover:bg-primary/20 transition-colors"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Browse */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Browse</h3>
            <ul className="space-y-2">
              {footerLinks.browse.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Genres */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Genres</h3>
            <ul className="space-y-2">
              {footerLinks.genres.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-heading font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border/50 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Anime.Savi.me. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with ❤️ for anime lovers
          </p>
        </div>
      </div>
    </footer>
  );
}
