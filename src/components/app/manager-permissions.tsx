import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_MANAGER_PERMISSIONS,
  MANAGER_PERMISSION_MODULES,
  permissionKey,
} from "@/lib/api/managers";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  idPrefix: string;
}

/** Module × (View / Manage) grid. "Manage" implies "View". */
export function ManagerPermissions({ value, onChange, idPrefix }: Props) {
  const set = new Set(value);
  const allSelected = ALL_MANAGER_PERMISSIONS.every((k) => set.has(k));

  const emit = (next: Set<string>) => onChange(ALL_MANAGER_PERMISSIONS.filter((k) => next.has(k)));

  const toggleView = (module: string, checked: boolean) => {
    const next = new Set(set);
    const view = permissionKey(module, "view");
    const manage = permissionKey(module, "manage");
    if (checked) next.add(view);
    else {
      next.delete(view);
      next.delete(manage);
    }
    emit(next);
  };

  const toggleManage = (module: string, checked: boolean) => {
    const next = new Set(set);
    const view = permissionKey(module, "view");
    const manage = permissionKey(module, "manage");
    if (checked) {
      next.add(view);
      next.add(manage);
    } else {
      next.delete(manage);
    }
    emit(next);
  };

  return (
    <div className="rounded-xl border border-border/70">
      <div className="grid grid-cols-[minmax(0,1fr)_64px_72px] items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <label className="flex cursor-pointer items-center gap-2 normal-case tracking-normal">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(c) => emit(c === true ? new Set(ALL_MANAGER_PERMISSIONS) : new Set())}
            aria-label="Select all permissions"
          />
          <span className="text-xs font-medium text-foreground">Select all</span>
        </label>
        <span className="text-center">View</span>
        <span className="text-center">Manage</span>
      </div>
      <ul className="divide-y divide-border/60">
        {MANAGER_PERMISSION_MODULES.map((m) => {
          const view = permissionKey(m.key, "view");
          const manage = permissionKey(m.key, "manage");
          return (
            <li
              key={m.key}
              className="grid grid-cols-[minmax(0,1fr)_64px_72px] items-center gap-2 px-3 py-2"
            >
              <span className="truncate text-sm">{m.label}</span>
              <span className="grid place-items-center">
                <Checkbox
                  id={`${idPrefix}-${view}`}
                  checked={set.has(view)}
                  onCheckedChange={(c) => toggleView(m.key, c === true)}
                  aria-label={`${m.label} view`}
                />
              </span>
              <span className="grid place-items-center">
                <Checkbox
                  id={`${idPrefix}-${manage}`}
                  checked={set.has(manage)}
                  onCheckedChange={(c) => toggleManage(m.key, c === true)}
                  aria-label={`${m.label} manage`}
                />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
