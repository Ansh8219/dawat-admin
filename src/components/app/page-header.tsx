import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface Props {
  title: string;
  crumbs?: string[];
  action?: ReactNode;
  description?: string;
}

export function PageHeader({ title, crumbs = [], action, description }: Props) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border/70 bg-background/60 px-4 py-5 sm:px-6 lg:px-8">
      <div className="min-w-0">
        {crumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
