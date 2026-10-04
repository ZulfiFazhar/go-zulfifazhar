import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Activity, Globe2, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

export type TimeRange = "24h" | "7d" | "30d";

export interface ChartPoint {
  timestamp: number;
  label: string;
  clicks: number;
}

interface LineChartProps {
  data: ChartPoint[];
  title?: string;
  subtitle?: string;
  initialRange?: TimeRange;
}

const COMMON_TIMEZONES = [
  { value: "LOCAL", label: "Local (Browser)" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Jakarta", label: "WIB (Jakarta)" },
  { value: "Asia/Singapore", label: "SGT (Singapore)" },
  { value: "America/New_York", label: "EST (New York)" },
  { value: "Europe/London", label: "GMT (London)" },
  { value: "Asia/Tokyo", label: "JST (Tokyo)" },
];

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

export function LineChart({
  data: initialData = [],
  title = "Click Traffic Analytics",
  subtitle = "Edge click distribution across your active shortlinks",
  initialRange = "24h",
}: LineChartProps) {
  const [range, setRange] = React.useState<TimeRange>(initialRange);
  const [data, setData] = React.useState<ChartPoint[]>(initialData);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activePoint, setActivePoint] = React.useState<ChartPoint | null>(null);

  // Timezone state
  const [selectedTz, setSelectedTz] = React.useState<string>("LOCAL");
  const [effectiveTz, setEffectiveTz] = React.useState<string>("UTC");

  React.useEffect(() => {
    try {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setEffectiveTz(selectedTz === "LOCAL" ? local : selectedTz);
    } catch {
      setEffectiveTz("UTC");
    }
  }, [selectedTz]);

  // Sync with initialData changes
  React.useEffect(() => {
    if (range === initialRange) {
      setData(initialData);
    }
  }, [initialData, range, initialRange]);

  // Fetch when range changes
  const handleRangeChange = async (newRange: TimeRange) => {
    if (newRange === range) return;
    setRange(newRange);
    setIsLoading(true);
    setActivePoint(null);

    try {
      const res = await fetch(`/api/user/links/trend?range=${newRange}`);
      if (res.ok) {
        const json = (await res.json()) as any;
        if (Array.isArray(json.trend)) {
          setData(json.trend);
        }
      }
    } catch (err) {
      console.error("Failed to fetch trend:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Format label for point on X axis
  const formatAxisLabel = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      if (range === "24h") {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: effectiveTz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(d);
      } else {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: effectiveTz,
          month: "numeric",
          day: "numeric",
        }).format(d);
      }
    } catch {
      return new Date(timestamp).toISOString().slice(11, 16);
    }
  };

  // Format detailed tooltip string
  const formatTooltipLabel = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return new Intl.DateTimeFormat("en-US", {
        timeZone: effectiveTz,
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
      }).format(d);
    } catch {
      return new Date(timestamp).toUTCString();
    }
  };

  const maxClicks = Math.max(...data.map((d) => d.clicks), 5);
  const totalPeriodClicks = data.reduce((acc, d) => acc + d.clicks, 0);

  // SVG Chart Dimensions
  const width = 640;
  const height = 140;
  const paddingX = 24;
  const paddingTop = 20;
  const paddingBottom = 28;

  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;

  const points = data.map((d, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.clicks / maxClicks) * chartHeight;
    return { x, y, data: d };
  });

  const activePt = points.find((p) => p.data.timestamp === activePoint?.timestamp);
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const linePath = generateSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)} ${(paddingTop + chartHeight).toFixed(1)} Z`
      : "";

  return (
    <Card className="mb-8 p-5 sm:p-6 border-[#f0f0f0] shadow-xs bg-white">
      {/* Header with Title and Range + Timezone controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f5f5f5] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffefe8] text-[#ff5e1f]">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#262626]">{title}</h3>
              {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#ff5e1f]" />}
            </div>
            <p className="text-xs text-neutral-400">{subtitle}</p>
          </div>
        </div>

        {/* Range toggles & Timezone selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Timezone Dropdown */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#f0f0f0] bg-[#fafafa] px-2.5 py-1 text-xs text-neutral-600">
            <Globe2 className="h-3 w-3 text-neutral-400" />
            <select
              value={selectedTz}
              onChange={(e) => setSelectedTz(e.target.value)}
              className="bg-transparent text-[11px] font-medium text-[#262626] outline-none cursor-pointer"
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Time Range Pills */}
          <div className="flex items-center rounded-full border border-[#f0f0f0] bg-[#fafafa] p-0.5">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRangeChange(r)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  range === r
                    ? "bg-white text-[#ff5e1f] shadow-2xs font-semibold"
                    : "text-neutral-500 hover:text-[#262626]"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Period Clicks Badge */}
          <Badge
            variant="outline"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border-[#f0f0f0] bg-[#fafafa] px-2.5 py-1 text-[11px] text-neutral-600"
          >
            <Activity className="h-3 w-3 text-[#ff5e1f]" />
            <span>{totalPeriodClicks.toLocaleString()} clicks</span>
          </Badge>
        </div>
      </div>

      {/* SVG Interactive Line Chart */}
      <div className="mt-4 relative">
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
          <span>Click trend ({range.toUpperCase()})</span>
          {activePoint ? (
            <span className="font-mono text-[#ff5e1f] font-semibold">
              {formatTooltipLabel(activePoint.timestamp)} • {activePoint.clicks}{" "}
              {activePoint.clicks === 1 ? "click" : "clicks"}
            </span>
          ) : (
            <span>Hover points along vertical slice for breakdown</span>
          )}
        </div>

        <div className="w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#fafafa] to-white p-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            onMouseLeave={() => setActivePoint(null)}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="dashboardAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff5e1f" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ff5e1f" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Grid horizontal guidelines */}
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

            {/* Active vertical straight guideline */}
            {activePt && (
              <line
                x1={activePt.x}
                y1={paddingTop}
                x2={activePt.x}
                y2={paddingTop + chartHeight}
                stroke="#ff5e1f"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.6"
                className="pointer-events-none transition-all duration-150"
              />
            )}

            {/* Area fill under curve */}
            {areaPath && (
              <path d={areaPath} fill="url(#dashboardAreaGrad)" className="transition-all" />
            )}

            {/* Smooth stroke line */}
            {linePath && (
              <motion.path
                key={linePath}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                d={linePath}
                fill="none"
                stroke="#ff5e1f"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Full vertical column hit-test slices */}
            {points.map((pt, i) => {
              const sliceX = i === 0 ? 0 : pt.x - step / 2;
              const sliceW =
                i === 0
                  ? paddingX + step / 2
                  : i === points.length - 1
                    ? step / 2 + paddingX
                    : step;

              return (
                <rect
                  key={`hit-${pt.data.timestamp}`}
                  x={sliceX}
                  y={0}
                  width={sliceW}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActivePoint(pt.data)}
                />
              );
            })}

            {/* Visual Data points & X Labels */}
            {points.map((pt) => {
              const isActive = activePoint?.timestamp === pt.data.timestamp;
              return (
                <g key={pt.data.timestamp} className="pointer-events-none">
                  {/* Subtle active glow ring */}
                  {isActive && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="10"
                      fill="#ff5e1f"
                      opacity="0.18"
                      className="animate-pulse"
                    />
                  )}

                  {/* Visual Circle dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? "5.5" : "3.5"}
                    className="transition-all duration-150"
                    fill={isActive ? "#ff5e1f" : "#ffffff"}
                    stroke="#ff5e1f"
                    strokeWidth={isActive ? "2.5" : "2"}
                  />

                  {/* X axis hour / date label */}
                  <text
                    x={pt.x}
                    y={height - 6}
                    textAnchor="middle"
                    className={`text-[10px] font-mono select-none transition-colors ${
                      isActive ? "fill-[#ff5e1f] font-semibold" : "fill-neutral-400"
                    }`}
                  >
                    {formatAxisLabel(pt.data.timestamp)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </Card>
  );
}
