import { Ban, Download, Globe, Sparkles, Tv, Zap } from 'lucide-react';

const icons = [Tv, Ban, Globe, Download, Zap, Sparkles];
const defaultLabels = ['4K Ultra HD', 'Ad-Free', 'Multi-Audio', '4K Downloads', 'Priority Servers', 'Early Access'];

export function TokenPerks({ labels = defaultLabels }: { labels?: string[] }) {
  return (
    <div className="token-perks-v7">
      {labels.map((label, index) => {
        const Icon = icons[index % icons.length];
        if (!Icon) return null;
        return <div key={label} className="token-perk-v7"><Icon aria-hidden="true" /><span>{label}</span></div>;
      })}
    </div>
  );
}