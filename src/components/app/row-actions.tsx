import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access";

export type RowActionItem = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  separator?: boolean;
  disabled?: boolean;
  /** Module whose `:manage` permission is needed to show this item. */
  requires?: string;
};

export function RowActions({
  items,
  align = "end",
  className,
  label = "Open actions",
}: {
  items: RowActionItem[];
  align?: "start" | "end" | "center";
  className?: string;
  label?: string;
}) {
  const { canManage } = useAccess();
  const allowed = items.filter((i) => i.separator || !i.requires || canManage(i.requires));
  // Drop leading/trailing/duplicate separators left by filtering.
  const visible = allowed.filter(
    (it, i, arr) => !it.separator || (i > 0 && i < arr.length - 1 && !arr[i - 1].separator),
  );
  if (visible.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground",
            className,
          )}
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48" onClick={(e) => e.stopPropagation()}>
        {visible.map((item, i) =>
          item.separator ? (
            <DropdownMenuSeparator key={`sep-${i}`} />
          ) : (
            <DropdownMenuItem
              key={`${item.label}-${i}`}
              disabled={item.disabled}
              className={cn(item.destructive && "text-destructive focus:text-destructive")}
              onSelect={(e) => {
                e.preventDefault();
                item.onClick();
              }}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
