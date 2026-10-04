import { motion } from "framer-motion";
import { Zap, BarChart3, KeyRound } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";

export interface FeatureItem {
  icon: typeof Zap;
  title: string;
  description: string;
  highlight: string;
}

const features: FeatureItem[] = [
  {
    icon: Zap,
    title: "Sub-millisecond KV redirect",
    description:
      "Backed by Cloudflare Workers and globally replicated KV storage across 300+ edge locations. Near-zero cold starts and lightning redirects.",
    highlight: "< 5ms global latency",
  },
  {
    icon: BarChart3,
    title: "Analytics & Tracking",
    description:
      "Real-time click telemetry without intrusive tracking cookies. Monitor link performance, referrer domains, and visitor metrics.",
    highlight: "Real-time edge stats",
  },
  {
    icon: KeyRound,
    title: "Google Auth & Custom Slugs",
    description:
      "Sign in securely with your Google account to create memorable vanity links, manage redirections, and audit click history.",
    highlight: "Branded vanity URLs",
  },
];

export function FeaturesGrid() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="mb-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-[#262626]">
          Engineered for Enterprise Performance
        </h2>
        <p className="mt-2 text-base text-neutral-500 max-w-xl mx-auto">
          Fast, resilient infrastructure powered by Cloudflare edge compute and modern security standards.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: idx * 0.12 }}
            >
              <Card className="h-full rounded-2xl border border-[#f0f0f0] bg-white p-6 sm:p-8 transition-all duration-200 hover:border-[#ff5e1f]/30 hover:shadow-md">
                <CardHeader className="p-0 mb-4">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffefe8] text-[#ff5e1f]">
                    <Icon className="h-6 w-6 stroke-[2]" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#ff5e1f]">
                    {feature.highlight}
                  </span>
                  <CardTitle className="mt-1 text-lg font-medium text-[#262626]">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-sm leading-relaxed text-neutral-600">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
