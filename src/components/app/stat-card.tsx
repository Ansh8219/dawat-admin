import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta: number; // percent
  icon: LucideIcon;
  spark: number[];
  tone?: "brand" | "gold" | "info" | "success";
}

export function StatCard({ label, value, delta, icon: Icon, spark, tone = "brand" }: Props) {
  const up = delta >= 0;
  const toneMap = {
    brand: "text-primary bg-primary/10",
    gold: "text-gold-foreground bg-gold/20",
    info: "text-info bg-info/10",
    success: "text-success bg-success/10",
  };
  const strokeMap = {
    brand: "var(--color-primary)",
    gold: "var(--color-gold)",
    info: "var(--color-info)",
    success: "var(--color-success)",
  };
  const data = spark.map((v, i) => ({ i, v }));
  return (
    <div className="card-elevated group relative overflow-hidden p-5 transition-shadow hover:shadow-[var(--shadow-elevated)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
          <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", up ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {up ? "+" : ""}{delta}% vs yesterday
          </div>
        </div>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-2 h-12 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="v" stroke={strokeMap[tone]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
