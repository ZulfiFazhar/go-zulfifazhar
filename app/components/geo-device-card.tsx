import * as React from "react";
import { Globe, Smartphone, Laptop, Tablet, Bot, Share2 } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import type { GeoAndDeviceAnalytics, MetricStatItem } from "../../workers/db/queries";

interface GeoDeviceProps {
  analytics: GeoAndDeviceAnalytics;
}

function StatBar({ item, color = "bg-[#ff5e1f]" }: { item: MetricStatItem; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[#262626] truncate max-w-[140px] sm:max-w-[180px]">
          {item.name}
        </span>
        <span className="font-mono text-neutral-500">
          {item.count} ({item.percentage}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f5f5f5]">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.max(item.percentage, 4)}%` }}
        />
      </div>
    </div>
  );
}

export function GeoDeviceCard({ analytics }: GeoDeviceProps) {
  const hasData =
    analytics.countries.length > 0 ||
    analytics.devices.length > 0 ||
    analytics.referrers.length > 0;

  if (!hasData) {
    return null;
  }

  const getDeviceIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-3.5 w-3.5 text-[#ff5e1f]" />;
      case "tablet":
        return <Tablet className="h-3.5 w-3.5 text-[#ff5e1f]" />;
      case "bot / crawler":
        return <Bot className="h-3.5 w-3.5 text-neutral-400" />;
      default:
        return <Laptop className="h-3.5 w-3.5 text-[#ff5e1f]" />;
    }
  };

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* Top Countries */}
      <Card className="p-5 border-[#f0f0f0] shadow-xs bg-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffefe8] text-[#ff5e1f]">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Top Geographies
            </h4>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-neutral-400">
            Cloudflare CF
          </Badge>
        </div>

        <div className="space-y-3">
          {analytics.countries.length > 0 ? (
            analytics.countries.map((c) => (
              <StatBar key={c.name} item={c} color="bg-[#ff5e1f]" />
            ))
          ) : (
            <p className="text-xs text-neutral-400 py-2">No country data yet</p>
          )}
        </div>
      </Card>

      {/* Device Breakdown */}
      <Card className="p-5 border-[#f0f0f0] shadow-xs bg-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffefe8] text-[#ff5e1f]">
              <Laptop className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Devices
            </h4>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-neutral-400">
            User-Agent
          </Badge>
        </div>

        <div className="space-y-3">
          {analytics.devices.length > 0 ? (
            analytics.devices.map((d) => (
              <div key={d.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-[#262626]">
                    {getDeviceIcon(d.name)}
                    <span>{d.name}</span>
                  </span>
                  <span className="font-mono text-neutral-500">
                    {d.count} ({d.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f5f5f5]">
                  <div
                    className="h-full rounded-full bg-[#262626] transition-all duration-500"
                    style={{ width: `${Math.max(d.percentage, 4)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-neutral-400 py-2">No device data yet</p>
          )}
        </div>
      </Card>

      {/* Top Referrers */}
      <Card className="p-5 border-[#f0f0f0] shadow-xs bg-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ffefe8] text-[#ff5e1f]">
              <Share2 className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Top Referrers
            </h4>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono text-neutral-400">
            Source
          </Badge>
        </div>

        <div className="space-y-3">
          {analytics.referrers.length > 0 ? (
            analytics.referrers.map((r) => (
              <StatBar key={r.name} item={r} color="bg-emerald-500" />
            ))
          ) : (
            <p className="text-xs text-neutral-400 py-2">No referrer data yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}
