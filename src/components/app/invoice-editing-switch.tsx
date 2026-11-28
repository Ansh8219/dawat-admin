import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getInvoiceSettings, updateInvoiceSettings } from "@/lib/api/invoices";
import { ApiError, type InvoiceSettings } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { invoiceSettingsQueryKey } from "@/lib/invoice-settings";

/**
 * Hidden super-admin switch for invoice editing. Deliberately unlabeled: it is opened by a
 * secret gesture on the Invoices page and shows no text about what it controls.
 */
export function InvoiceEditingSwitch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: invoiceSettingsQueryKey,
    enabled: open,
    staleTime: 60_000,
    queryFn: () => withAuthRetry((token) => getInvoiceSettings(token)),
  });

  async function change(next: boolean) {
    const previous = queryClient.getQueryData<InvoiceSettings>(invoiceSettingsQueryKey);
    queryClient.setQueryData<InvoiceSettings>(invoiceSettingsQueryKey, { editing_enabled: next });
    setSaving(true);
    try {
      const saved = await withAuthRetry((token) =>
        updateInvoiceSettings(token, { editing_enabled: next }),
      );
      queryClient.setQueryData(invoiceSettingsQueryKey, saved);
      toast.success("Saved");
    } catch (err) {
      queryClient.setQueryData(invoiceSettingsQueryKey, previous);
      toast.error(err instanceof ApiError ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: invoiceSettingsQueryKey });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        aria-describedby={undefined}
        className="w-[calc(100%-2rem)] max-w-[15rem] rounded-2xl p-0 sm:rounded-2xl print:hidden"
      >
        <DialogTitle className="sr-only">Options</DialogTitle>
        {/* Right padding keeps the dialog's close (X) button clear of the switch. */}
        <div className="flex items-center gap-3 py-5 pl-5 pr-12">
          {isLoading || !data ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              id="hidden-options-switch"
              aria-label="Options"
              checked={data.editing_enabled}
              disabled={saving}
              onCheckedChange={(v) => void change(v)}
            />
          )}
          <label
            htmlFor="hidden-options-switch"
            className="flex items-center gap-2 text-sm font-medium tabular-nums"
          >
            {data ? (data.editing_enabled ? "On" : "Off") : ""}
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
