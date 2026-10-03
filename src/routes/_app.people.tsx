import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  formatPartnerDate,
  formatPartnerPhone,
  listPartners,
  partnerStatusLabel,
} from "@/lib/api/partners";
import {
  formatAssignedStore,
  formatStoreKeeperDate,
  formatStoreKeeperPhone,
  listStoreKeepers,
  storeKeeperStatusLabel,
} from "@/lib/api/store-keepers";
import { ApiError } from "@/lib/api/types";
import type {
  PartnerListItem,
  PartnerStatus,
  StoreKeeperListItem,
  StoreKeeperStatus,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Mail,
  Phone,
  Store,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const peopleSearchSchema = z.object({
  role: z.enum(["partners", "store_keepers", "managers"]).catch("partners"),
  status: z.enum(["pending", "approved", "rejected", "all", "draft"]).catch("pending"),
});

export type PeopleRole = z.infer<typeof peopleSearchSchema>["role"];
export type PeopleStatusFilter = z.infer<typeof peopleSearchSchema>["status"];

export const Route = createFileRoute("/_app/people")({
  component: PeoplePage,
  validateSearch: peopleSearchSchema,
  head: () => ({ meta: [{ title: "People — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;

const ROLE_TABS: {
  id: PeopleRole;
  label: string;
  icon: typeof Bike;
  description: string;
}[] = [
  {
    id: "partners",
    label: "Partners",
    icon: Bike,
    description: "Delivery partner applications and directory.",
  },
  {
    id: "store_keepers",
    label: "Store Keepers",
    icon: Store,
    description: "Store keeper onboarding — profile, docs, and assignment.",
  },
  {
    id: "managers",
    label: "Managers",
    icon: UserCog,
    description: "Manager applications will appear here soon.",
  },
];

const STATUS_TABS: { id: PeopleStatusFilter; label: string; roles?: PeopleRole[] }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "draft", label: "Draft", roles: ["store_keepers"] },
  { id: "all", label: "All" },
];

function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PeoplePage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { role, status } = Route.useSearch();
  const [partners, setPartners] = useState<PartnerListItem[]>([]);
  const [storeKeepers, setStoreKeepers] = useState<StoreKeeperListItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);

  const activeRole = ROLE_TABS.find((r) => r.id === role) ?? ROLE_TABS[0];
  const statusTabs = STATUS_TABS.filter((tab) => !tab.roles || tab.roles.includes(role));

  useEffect(() => {
    setPage(1);
  }, [role, status]);

  useEffect(() => {
    if (role !== "store_keepers" && status === "draft") {
      void navigate({
        search: (prev) => ({ ...prev, status: "pending" }),
        replace: true,
      });
    }
  }, [role, status, navigate]);

  const handleAuthError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const refresh = useCallback(
    async (options?: { showLoading?: boolean }) => {
      if (role === "managers") {
        setPartners([]);
        setStoreKeepers([]);
        setCount(0);
        setLoadError("");
        setLoading(false);
        return;
      }

      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        if (role === "partners") {
          const data = await withAuthRetry((token) =>
            listPartners(token, {
              status: status === "all" || status === "draft" ? undefined : (status as PartnerStatus),
              page,
              page_size: PAGE_SIZE,
            }),
          );
          setPartners(data.results ?? []);
          setStoreKeepers([]);
          setCount(data.count ?? 0);
          const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
          if (page > maxPage) setPage(maxPage);
        } else {
          const data = await withAuthRetry((token) =>
            listStoreKeepers(token, {
              status: status === "all" ? undefined : (status as StoreKeeperStatus),
              page,
              page_size: PAGE_SIZE,
            }),
          );
          setStoreKeepers(data.results ?? []);
          setPartners([]);
          setCount(data.count ?? 0);
          const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
          if (page > maxPage) setPage(maxPage);
        }
      } catch (err) {
        if (handleAuthError(err)) return;
        const message =
          err instanceof ApiError
            ? err.message
            : role === "partners"
              ? "Unable to load partners."
              : "Unable to load store keepers.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [role, status, page, handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rangeStart = count === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, count);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="People"
        crumbs={["Admin", "People"]}
        description="One place to review and check partners, store keepers, and managers."
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => {
            const active = role === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  void navigate({
                    search: (prev) => ({
                      ...prev,
                      role: tab.id,
                      status: prev.status === "draft" && tab.id !== "store_keepers" ? "pending" : prev.status,
                    }),
                  })
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="card-elevated overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => {
                const active = status === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      void navigate({
                        search: (prev) => ({ ...prev, status: tab.id }),
                      })
                    }
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground sm:max-w-xs sm:text-right">
              {activeRole.description}
            </p>
          </div>

          {role === "managers" ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center text-muted-foreground">
              <UserCog className="h-10 w-10 opacity-40" />
              <div>
                <p className="font-medium text-foreground">Managers coming soon</p>
                <p className="mt-1 text-sm">
                  Manager applications will use the same review and directory flow.
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading {activeRole.label.toLowerCase()}…</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {loadError}
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void refresh({ showLoading: true })}
              >
                Try again
              </Button>
            </div>
          ) : role === "partners" ? (
            <PeopleTable
              emptyLabel="partners"
              isEmpty={partners.length === 0}
              status={status}
              count={count}
              safePage={safePage}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              colSpan={6}
              headers={
                <>
                  <th className="px-4 py-3 text-left font-medium">Partner</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </>
              }
            >
              {partners.map((p) => (
                <tr
                  key={p.public_id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() =>
                    void navigate({
                      to: "/people/partners/$partnerId",
                      params: { partnerId: p.public_id },
                    })
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {initials(p.full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{p.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.public_id.slice(0, 8)}…
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPartnerPhone(p)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="max-w-[200px] truncate">{p.email || "—"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatPartnerDate(p.submitted_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={partnerStatusLabel(p.partner_status)} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant={p.partner_status === "pending" ? "default" : "outline"}
                      className="h-8 rounded-lg text-xs"
                      asChild
                    >
                      <Link
                        to="/people/partners/$partnerId"
                        params={{ partnerId: p.public_id }}
                      >
                        {p.partner_status === "pending" ? "Review" : "View"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </PeopleTable>
          ) : (
            <PeopleTable
              emptyLabel="store keepers"
              isEmpty={storeKeepers.length === 0}
              status={status}
              count={count}
              safePage={safePage}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              colSpan={7}
              headers={
                <>
                  <th className="px-4 py-3 text-left font-medium">Store keeper</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Store</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </>
              }
            >
              {storeKeepers.map((sk) => (
                <tr
                  key={sk.public_id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() =>
                    void navigate({
                      to: "/people/store-keepers/$storeKeeperId",
                      params: { storeKeeperId: sk.public_id },
                    })
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {initials(sk.full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{sk.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {sk.store_keeper_code || `${sk.public_id.slice(0, 8)}…`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatStoreKeeperPhone(sk)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatAssignedStore(sk.assigned_store)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="max-w-[180px] truncate">{sk.email || "—"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatStoreKeeperDate(sk.submitted_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={storeKeeperStatusLabel(sk.store_keeper_status)} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant={sk.store_keeper_status === "pending" ? "default" : "outline"}
                      className="h-8 rounded-lg text-xs"
                      asChild
                    >
                      <Link
                        to="/people/store-keepers/$storeKeeperId"
                        params={{ storeKeeperId: sk.public_id }}
                      >
                        {sk.store_keeper_status === "pending" ? "Review" : "View"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </PeopleTable>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-soft">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Review & directory</p>
            <p className="mt-0.5 text-xs">
              Use Pending for daily approvals. Switch to Approved or All anytime to check existing
              people and their documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PeopleTable({
  emptyLabel,
  isEmpty,
  status,
  count,
  safePage,
  totalPages,
  rangeStart,
  rangeEnd,
  onPrev,
  onNext,
  colSpan,
  headers,
  children,
}: {
  emptyLabel: string;
  isEmpty: boolean;
  status: PeopleStatusFilter;
  count: number;
  safePage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  onPrev: () => void;
  onNext: () => void;
  colSpan: number;
  headers: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>{headers}</tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <UserRound className="h-8 w-8 opacity-50" />
                    <p className="font-medium text-foreground">No {emptyLabel} found</p>
                    <p className="text-xs">
                      {status === "pending"
                        ? "No pending applications to review."
                        : "Try another status filter."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>

      {count > 0 && (
        <div className="flex flex-col gap-2 border-t bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Showing <b className="text-foreground">{rangeStart}</b>–
            <b className="text-foreground">{rangeEnd}</b> of{" "}
            <b className="text-foreground">{count}</b>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl"
              disabled={safePage === 1}
              onClick={onPrev}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl"
              disabled={safePage === totalPages}
              onClick={onNext}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
