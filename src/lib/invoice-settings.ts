import { useQuery } from "@tanstack/react-query";
import { getInvoiceSettings } from "./api/invoices";
import { withAuthRetry } from "./api/with-auth";
import { useAccess } from "./access";

export const invoiceSettingsQueryKey = ["admin", "invoice-settings"] as const;

/**
 * Global invoice-editing switch (super admin only; default off). Cached once for the app;
 * managers never request it. `undefined` while loading, which callers treat as off.
 */
export function useInvoiceEditingEnabled(): boolean | undefined {
  const superAdmin = useAccess().isSuperAdmin;
  const { data } = useQuery({
    queryKey: invoiceSettingsQueryKey,
    enabled: superAdmin,
    staleTime: 60_000,
    queryFn: () => withAuthRetry((token) => getInvoiceSettings(token)),
  });
  return superAdmin ? data?.editing_enabled : false;
}
