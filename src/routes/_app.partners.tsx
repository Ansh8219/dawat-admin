import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
import { ApiError } from "@/lib/api/types";
import type { PartnerListItem, PartnerStatus } from "@/lib/api/types";
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
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/partners")({
  component: PartnersPage,
  head: () => ({ meta: [{ title: "Partners — Daawat Baker's" }] }),
});

const PAGE_SIZE = 20;

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PartnersPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<PartnerListItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status]);

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
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) =>
          listPartners(token, {
            status: status === "all" ? undefined : (status as PartnerStatus),
            page,
            page_size: PAGE_SIZE,
          }),
        );
        setResults(data.results ?? []);
        setCount(data.count ?? 0);
        const maxPage = Math.max(1, Math.ceil((data.count ?? 0) / (data.page_size || PAGE_SIZE)));
        if (page > maxPage) {
          setPage(maxPage);
        }
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load partners.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [status, page, handleAuthError],
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
        title="Partners"
        crumbs={["Growth", "Partners"]}
        description="Review delivery partner applications — documents, vehicle, and bank details."
      />

      <div className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="card-elevated overflow-hidden">
          <div className="border-b p-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => {
                const active = status === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatus(tab.id)}
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
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading partners…</p>
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
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Partner</th>
                      <th className="px-4 py-3 text-left font-medium">Phone</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Submitted</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-16 text-center text-sm text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <UserRound className="h-8 w-8 opacity-50" />
                            <p className="font-medium text-foreground">No partners found</p>
                            <p className="text-xs">
                              {status === "pending"
                                ? "No pending applications to review."
                                : "Try another status filter."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      results.map((p) => (
                        <tr
                          key={p.public_id}
                          className="cursor-pointer border-b hover:bg-muted/40"
                          onClick={() =>
                            void navigate({
                              to: "/partners/$partnerId",
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
                              <span className="truncate max-w-[200px]">{p.email || "—"}</span>
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
                                to="/partners/$partnerId"
                                params={{ partnerId: p.public_id }}
                              >
                                {p.partner_status === "pending" ? "Review" : "View"}
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))
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
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-soft">
          <Bike className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-foreground">Partner review</p>
            <p className="mt-0.5 text-xs">
              Open a pending application to verify documents, then approve or reject with specific
              field issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
