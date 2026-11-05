import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listCustomers, formatCustomerPhone } from "@/lib/api/customers";
import { withAuthRetry } from "@/lib/api/with-auth";
import type { Customer } from "@/lib/api/types";

export type PickedCustomer = { public_id: string; name: string; phone: string };

function toPicked(c: Customer): PickedCustomer {
  return {
    public_id: c.public_id,
    name: c.full_name?.trim() || "Unnamed",
    phone: formatCustomerPhone(c),
  };
}

/** Multi-select customer search. Selection persists across searches. */
export function CustomerPicker({
  value,
  onChange,
}: {
  value: PickedCustomer[];
  onChange: (next: PickedCustomer[]) => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const term = debounced.length >= 2 ? debounced : "";

  useEffect(() => {
    setPage(1);
  }, [term]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    withAuthRetry((token) =>
      listCustomers(token, { search: term || undefined, page, page_size: 20 }),
    )
      .then((data) => {
        if (cancelled) return;
        setTotal(data.count);
        setResults((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load customers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [term, page]);

  const selected = new Set(value.map((v) => v.public_id));

  function toggle(c: Customer) {
    if (selected.has(c.public_id)) onChange(value.filter((v) => v.public_id !== c.public_id));
    else onChange([...value, toPicked(c)]);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v.public_id}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-1 text-xs"
            >
              {v.name}
              {v.phone ? <span className="text-muted-foreground">· {v.phone}</span> : null}
              <button
                type="button"
                aria-label={`Remove ${v.name}`}
                onClick={() => onChange(value.filter((x) => x.public_id !== v.public_id))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone"
          className="rounded-xl pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!loading && !error && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No customers found.</p>
      )}
      {results.length > 0 && (
        <ul className="max-h-52 overflow-y-auto rounded-xl border">
          {results.map((c) => {
            const on = selected.has(c.public_id);
            return (
              <li key={c.public_id}>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${on ? "bg-muted" : ""}`}
                >
                  <span>
                    {c.full_name?.trim() || "Unnamed"}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatCustomerPhone(c)}
                    </span>
                  </span>
                  {on && <span className="text-xs font-medium">Selected</span>}
                </button>
              </li>
            );
          })}
          {results.length < total && (
            <li>
              <button
                type="button"
                disabled={loading}
                onClick={() => setPage((p) => p + 1)}
                className="w-full px-3 py-2 text-center text-xs text-muted-foreground hover:bg-muted"
              >
                Load more ({results.length} of {total})
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
