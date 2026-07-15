import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  // orders
  "Pending":         "bg-warning/15 text-warning border-warning/30",
  "Preparing":       "bg-info/15 text-info border-info/30",
  "Ready":           "bg-primary/15 text-primary border-primary/30",
  "Out for Delivery":"bg-gold/20 text-gold-foreground border-gold/40",
  "Completed":       "bg-success/15 text-success border-success/30",
  "Cancelled":       "bg-destructive/15 text-destructive border-destructive/30",
  // stock
  "In Stock":        "bg-success/15 text-success border-success/30",
  "Low":             "bg-warning/15 text-warning border-warning/40",
  "Out":             "bg-destructive/15 text-destructive border-destructive/30",
  // tables
  "Available":       "bg-success/15 text-success border-success/30",
  "Occupied":        "bg-destructive/15 text-destructive border-destructive/30",
  "Reserved":        "bg-warning/15 text-warning border-warning/40",
  // staff
  "Active":          "bg-success/15 text-success border-success/30",
  "Pending Approval":"bg-warning/15 text-warning border-warning/40",
  // driver
  "Online":          "bg-success/15 text-success border-success/30",
  "On Delivery":     "bg-info/15 text-info border-info/30",
  "Offline":         "bg-muted text-muted-foreground border-border",
  // loyalty
  "Silver":          "bg-muted text-muted-foreground border-border",
  "Gold":            "bg-gold/20 text-gold-foreground border-gold/40",
  "Platinum":        "bg-primary/15 text-primary border-primary/30",
  // vendor
  "Upcoming":        "bg-info/15 text-info border-info/30",
  "Overdue":         "bg-destructive/15 text-destructive border-destructive/30",
  "Paid":            "bg-success/15 text-success border-success/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
      map[status] ?? "bg-muted text-muted-foreground border-border",
      className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
