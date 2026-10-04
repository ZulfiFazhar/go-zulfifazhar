import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, MousePointerClick, Link2, Zap } from "lucide-react";
import { Badge } from "./ui/badge";

export interface TrendPoint {
  timestamp: number;
  label: string;
  clicks: number;
}

export interface PlatformStats {
  totalClicks: number;
  totalLinks: number;
  trend: TrendPoint[];
}

interface LiveStatsChartProps {
  initialStats?: PlatformStats;
}

function generateSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function LiveStatsChart({ initialStats }: LiveStatsChartProps) {
  const [stats, setStats] = React.useState<PlatformStats>(() => {
    return (
      initialStats ?? {
        totalClicks: 0,
        totalLinks: 0,
        trend: [],
      }
    );
  });

  const [activePoint, setActivePoint] = React.useState<TrendPoint | null>(null);
  const [clickPulse, setClickPulse] = React.useState(false);
  const prevClicksRef = React.useRef(stats.totalClicks);

  // Real-time 5-second polling (active tab only)
  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const fetchStats = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const res = await fetch("/api/stats/public");
        if (res.ok) {
          const data = (await res.json()) as PlatformStats;
          setStats((prev) => {
            if (data.totalClicks > prev.totalClicks) {
              setClickPulse(true);
              setTimeout(() => setClickPulse(false), 1200);
            }
            return data;
          });
        }
      } catch {
        // Ignore network errors in polling loop
      }
    };

    timer = setInterval(fetchStats, 5000);
    return () => clearInterval(timer);
  }, []);

  const trendData = stats.trend && stats.trend.length > 0 ? stats.trend : [];
  const maxClicks = Math.max(...trendData.map((d) => d.clicks), 5);

  // SVG Chart Dimensions
  const width = 640;
  const height = 140;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 28;

  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;

  const points = trendData.map((d, index) => {
    const x = paddingX + (index / Math.max(trendData.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.clicks / maxClicks) * chartHeight;
    return { x, y, data: d };
  });

  const linePath = generateSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="w-full max-w-3xl mx-auto mt-10"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white/95 p-5 sm:p-6 shadow-xs backdrop-blur-xs">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f5f5f5] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffefe8] text-[#ff5e1f]">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#262626]">
                Global Edge Activity
              </h3>
              <p className="text-xs text-neutral-400">
                Real-time click streams routed across Cloudflare edge nodes
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="flex items-center gap-1.5 rounded-full border-emerald-200 bg-emerald-50/60 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Live • 5s edge sync</span>
          </Badge>
        </div>

        {/* Stats Summary Counter Row */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#f5f5f5] bg-[#fafafa]/50 p-3.5 transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <MousePointerClick className="h-3.5 w-3.5 text-[#ff5e1f]" />
              <span>Total Edge Clicks</span>
            </div>
            <motion.div
              key={stats.totalClicks}
              animate={clickPulse ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mt-1 flex items-baseline gap-2 font-mono text-2xl font-bold tracking-tight text-[#262626]"
            >
              <span>{stats.totalClicks.toLocaleString()}</span>
              {clickPulse && (
                <span className="text-xs font-semibold text-emerald-600 animate-pulse">
                  +1
                </span>
              )}
            </motion.div>
          </div>

          <div className="rounded-xl border border-[#f5f5f5] bg-[#fafafa]/50 p-3.5 transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Link2 className="h-3.5 w-3.5 text-neutral-400" />
              <span>Active Shortlinks</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#262626]">
              {stats.totalLinks.toLocaleString()}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-[#f5f5f5] bg-[#fafafa]/50 p-3.5 transition-colors">
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Zap className="h-3.5 w-3.5 text-[#ff5e1f]" />
              <span>24h Peak Activity</span>
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#262626]">
              {Math.max(...(stats.trend?.map((t) => t.clicks) ?? [0]), 0)}{" "}
              <span className="text-xs font-normal text-neutral-400">clicks/slot</span>
            </div>
          </div>
        </div>

        {/* SVG Interactive Line Chart */}
        <div className="mt-6 relative">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
            <span>24h Click Trend</span>
            {activePoint ? (
              <span className="font-mono text-[#ff5e1f] font-semibold">
                {activePoint.label} UTC • {activePoint.clicks}{" "}
                {activePoint.clicks === 1 ? "click" : "clicks"}
              </span>
            ) : (
              <span>Hover chart points for details</span>
            )}
          </div>

          <div className="w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#fafafa] to-white p-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff5e1f" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#ff5e1f" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid guide lines */}
              <line
                x1={paddingX}
                y1={paddingTop + chartHeight / 2}
                x2={width - paddingX}
                y2={paddingTop + chartHeight / 2}
                stroke="#f0f0f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={paddingTop + chartHeight}
                x2={width - paddingX}
                y2={paddingTop + chartHeight}
                stroke="#e8e8e8"
                strokeWidth="1"
              />

              {/* Area fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#areaGradient)" className="transition-all" />
              )}

              {/* Smooth Line Path */}
              {linePath && (
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  d={linePath}
                  fill="none"
                  stroke="#ff5e1f"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points & X Labels */}
              {points.map((pt, i) => {
                const isActive = activePoint?.timestamp === pt.data.timestamp;
                return (
                  <g key={pt.data.timestamp} className="cursor-pointer">
                    {/* Invisible hover area target */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="16"
                      fill="transparent"
                      onMouseEnter={() => setActivePoint(pt.data)}
                      onMouseLeave={() => setActivePoint(null)}
                    />

                    {/* Point circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isActive ? "5" : "3.5"}
                      className="transition-all duration-150"
                      fill={isActive ? "#ff5e1f" : "#ffffff"}
                      stroke="#ff5e1f"
                      strokeWidth="2"
                    />

                    {/* X axis hour label */}
                    <text
                      x={pt.x}
                      y={height - 6}
                      textAnchor="middle"
                      className="text-[10px] font-mono fill-neutral-400 select-none pointer-events-none"
                    >
                      {pt.data.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
