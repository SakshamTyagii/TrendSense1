import { motion } from 'framer-motion';
import { ExternalLink, Megaphone } from 'lucide-react';

export interface SponsoredItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
  sponsor: string;
  sponsorLogo?: string;
}

// Demo sponsored content — in production, fetched from ad server
export const DEMO_SPONSORS: SponsoredItem[] = [
  {
    id: 'sponsor-1',
    title: 'Build Smarter Apps with AI',
    description: 'Launch your next project 10x faster with cutting-edge AI tools. Try free for 30 days.',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop',
    ctaText: 'Learn More',
    ctaUrl: '#',
    sponsor: 'TechCorp AI',
  },
  {
    id: 'sponsor-2',
    title: 'The Future of Finance is Here',
    description: 'Smart investing made simple. AI-powered portfolio management for everyone.',
    imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop',
    ctaText: 'Start Investing',
    ctaUrl: '#',
    sponsor: 'FinanceHub',
  },
];

interface SponsoredCardProps {
  item: SponsoredItem;
}

export default function SponsoredCard({ item }: SponsoredCardProps) {
  return (
    <div className="relative w-full h-screen snap-start snap-always flex-shrink-0">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end pb-24 px-5">
        {/* Sponsored badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 mb-3"
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
            <Megaphone className="w-3 h-3" />
            Sponsored · {item.sponsor}
          </span>
        </motion.div>

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3 max-w-lg"
        >
          {item.title}
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-gray-300 text-sm leading-relaxed max-w-lg mb-5"
        >
          {item.description}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
        >
          <a
            href={item.ctaUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all"
          >
            {item.ctaText}
            <ExternalLink className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
