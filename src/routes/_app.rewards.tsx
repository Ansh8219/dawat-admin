import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFieldErrors } from "@/lib/api/client";
import {
  COINS_PER_STEP_MAX,
  diffRewardSettings,
  getRewardSettings,
  parseRewardSettingsForm,
  previewCoins,
  rewardSettingsToForm,
  updateRewardSettings,
  type RewardSettingsErrors,
  type RewardSettingsField,
  type RewardSettingsForm,
} from "@/lib/api/reward-settings";
import {
  listRewardRules,
  REWARD_RULE_COINS_MAX,
  REWARD_RULE_DESCRIPTION_MAX,
  REWARD_RULE_HELP,
  REWARD_RULE_TITLE_MAX,
  updateRewardRule,
} from "@/lib/api/reward-rules";
import { ApiError } from "@/lib/api/types";
import type {
  EarnCalculation,
  RewardRule,
  RewardSettings,
  UpdateRewardRulePayload,
} from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";
import { inr } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import { Coins, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rewards")({
  component: RewardsPage,
  head: () => ({ meta: [{ title: "Rewards — Daawat Baker's" }] }),
});

const PREVIEW_AMOUNTS = [250, 1000];

function useHandleAuthError() {
  const navigate = useNavigate();
  return useCallback(
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
}

function RewardsPage() {
  const [tab, setTab] = useState("earning");

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <PageHeader
        title="Rewards"
        crumbs={["Growth", "Rewards"]}
        description="How customers earn coins on orders and bonus actions."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="earning">Earning Settings</TabsTrigger>
            <TabsTrigger value="rules">Bonus Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="earning" className="mt-4">
            <EarningSettingsTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <BonusRulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EarningSettingsTab() {
  const handleAuthError = useHandleAuthError();
  const [original, setOriginal] = useState<RewardSettings | null>(null);
  const [form, setForm] = useState<RewardSettingsForm | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RewardSettingsErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const applySettings = useCallback((data: RewardSettings) => {
    setOriginal(data);
    setForm(rewardSettingsToForm(data));
    setFieldErrors({});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await withAuthRetry((token) => getRewardSettings(token));
      applySettings(data);
    } catch (err) {
      if (handleAuthError(err)) return;
      setLoadError(err instanceof ApiError ? err.message : "Unable to load earning settings.");
    } finally {
      setLoading(false);
    }
  }, [applySettings, handleAuthError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function setField<K extends RewardSettingsField>(key: K, value: RewardSettingsForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const preview = useMemo(() => {
    if (!form) return null;
    const step = Number(form.earn_step_amount);
    const coins = Number(form.coins_per_step);
    const minOrder = form.min_order_amount.trim() === "" ? 0 : Number(form.min_order_amount);
    if (!(step > 0) || !Number.isFinite(coins) || coins < 0 || !Number.isFinite(minOrder)) {
      return null;
    }
    const settings = {
      is_enabled: form.is_enabled,
      earn_step_amount: step,
      coins_per_step: Math.floor(coins),
      earn_calculation: form.earn_calculation,
      min_order_amount: minOrder,
    };
    return PREVIEW_AMOUNTS.map((amount) => ({ amount, coins: previewCoins(amount, settings) }));
  }, [form]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form || !original) return;

    const parsed = parseRewardSettingsForm(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      return;
    }
    const patch = diffRewardSettings(parsed.values, original);
    if (Object.keys(patch).length === 0) {
      toast.message("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const updated = await withAuthRetry((token) => updateRewardSettings(token, patch));
      applySettings(updated);
      toast.success("Earning settings saved");
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError) {
        const inline: RewardSettingsErrors = {};
        let hasOther = false;
        for (const [field, message] of Object.entries(apiFieldErrors(err))) {
          if (field in form) inline[field as RewardSettingsField] = message;
          else hasOther = true;
        }
        if (Object.keys(inline).length > 0) setFieldErrors(inline);
        if (hasOther || Object.keys(inline).length === 0) toast.error(err.message);
        return;
      }
      toast.error("Unable to save earning settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card-elevated flex max-w-2xl items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading earning settings…
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="card-elevated max-w-2xl space-y-3 p-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError || "Unable to load earning settings."}
        </div>
        <Button type="button" className="rounded-xl" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card-elevated max-w-2xl space-y-5 p-4">
      <div>
        <div className="text-sm font-semibold">Earning settings</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Coins are calculated on items total after coupon discount. Delivery charge is not
          included. Coins are credited when the order is delivered or collected.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
        <div>
          <Label htmlFor="rw-enabled" className="text-sm font-medium">
            Coins earning enabled
          </Label>
          <p className="text-xs text-muted-foreground">
            When off, no automatic coins (orders and review bonus). Manual admin adjustments still
            work.
          </p>
        </div>
        <Switch
          id="rw-enabled"
          checked={form.is_enabled}
          onCheckedChange={(v) => setField("is_enabled", v)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow id="rw-step" label="For every ₹" error={fieldErrors.earn_step_amount}>
          <Input
            id="rw-step"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.earn_step_amount}
            onChange={(e) => setField("earn_step_amount", e.target.value)}
            placeholder="100"
            aria-invalid={!!fieldErrors.earn_step_amount}
            className={cn("rounded-xl", fieldErrors.earn_step_amount && "border-destructive")}
          />
        </FormRow>
        <FormRow id="rw-coins" label="Customer gets (coins)" error={fieldErrors.coins_per_step}>
          <Input
            id="rw-coins"
            type="number"
            inputMode="numeric"
            min={0}
            max={COINS_PER_STEP_MAX}
            step={1}
            value={form.coins_per_step}
            onChange={(e) => setField("coins_per_step", e.target.value)}
            placeholder="10"
            aria-invalid={!!fieldErrors.coins_per_step}
            className={cn("rounded-xl", fieldErrors.coins_per_step && "border-destructive")}
          />
        </FormRow>
      </div>

      <div className="space-y-2">
        <Label>Calculation</Label>
        <RadioGroup
          value={form.earn_calculation}
          onValueChange={(v) => setField("earn_calculation", v as EarnCalculation)}
          className="gap-2"
        >
          <CalcOption
            value="proportional"
            title="Proportional"
            hint="₹250 → 25 coins"
            active={form.earn_calculation === "proportional"}
          />
          <CalcOption
            value="full_steps"
            title="Full steps only"
            hint="₹250 → 20 coins, only full ₹100 steps count"
            active={form.earn_calculation === "full_steps"}
          />
        </RadioGroup>
        {fieldErrors.earn_calculation ? (
          <p className="text-[11px] font-medium text-destructive">{fieldErrors.earn_calculation}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormRow
          id="rw-min"
          label="Minimum order amount (₹)"
          error={fieldErrors.min_order_amount}
          hint="Orders below this earn 0 coins."
        >
          <Input
            id="rw-min"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={form.min_order_amount}
            onChange={(e) => setField("min_order_amount", e.target.value)}
            placeholder="0"
            aria-invalid={!!fieldErrors.min_order_amount}
            className={cn("rounded-xl", fieldErrors.min_order_amount && "border-destructive")}
          />
        </FormRow>
        <FormRow
          id="rw-value"
          label={
            <>
              1 coin = ₹ <span className="font-normal text-muted-foreground">(optional)</span>
            </>
          }
          error={fieldErrors.coin_value}
          hint="Redemption value. Display only for now. Leave empty to clear."
        >
          <Input
            id="rw-value"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.0001"
            value={form.coin_value}
            onChange={(e) => setField("coin_value", e.target.value)}
            placeholder="Not set"
            aria-invalid={!!fieldErrors.coin_value}
            className={cn("rounded-xl", fieldErrors.coin_value && "border-destructive")}
          />
        </FormRow>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <Coins className="h-3.5 w-3.5 text-primary" /> Preview
        </div>
        {preview ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {preview.map((p) => (
              <div key={p.amount} className="rounded-lg border bg-card p-2 text-center">
                <div className="text-[11px] text-muted-foreground">{inr(p.amount)} order</div>
                <div className="text-lg font-bold tabular-nums">
                  {p.coins.toLocaleString("en-IN")} coins
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Enter valid values to see a preview.</p>
        )}
        {!form.is_enabled ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Earning is off, so orders earn 0 coins.
          </p>
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="rounded-xl" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save settings"
          )}
        </Button>
      </div>
    </form>
  );
}

function CalcOption({
  value,
  title,
  hint,
  active,
}: {
  value: EarnCalculation;
  title: string;
  hint: string;
  active: boolean;
}) {
  const id = `rw-calc-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </label>
  );
}

type RuleField = "title" | "description" | "coins" | "is_active";
type RuleErrors = Partial<Record<RuleField, string>>;
type RuleForm = { title: string; description: string; coins: string; is_active: boolean };

function validateRule(form: RuleForm): RuleErrors {
  const errors: RuleErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = "Title is required.";
  else if (title.length > REWARD_RULE_TITLE_MAX)
    errors.title = `Title must be at most ${REWARD_RULE_TITLE_MAX} characters.`;
  if (form.description.trim().length > REWARD_RULE_DESCRIPTION_MAX)
    errors.description = `Description must be at most ${REWARD_RULE_DESCRIPTION_MAX} characters.`;
  const raw = form.coins.trim();
  const coins = Number(raw);
  if (!raw) errors.coins = "Coins are required.";
  else if (!/^\d+$/.test(raw) || coins < 1 || coins > REWARD_RULE_COINS_MAX)
    errors.coins = `Enter a whole number from 1 to ${REWARD_RULE_COINS_MAX.toLocaleString("en-IN")}.`;
  return errors;
}

function BonusRulesTab() {
  const handleAuthError = useHandleAuthError();
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [togglingTrigger, setTogglingTrigger] = useState<string | null>(null);

  const [editing, setEditing] = useState<RewardRule | null>(null);
  const [form, setForm] = useState<RuleForm>({
    title: "",
    description: "",
    coins: "",
    is_active: false,
  });
  const [fieldErrors, setFieldErrors] = useState<RuleErrors>({});
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (showLoading) {
        setLoading(true);
        setLoadError("");
      }
      try {
        const data = await withAuthRetry((token) => listRewardRules(token));
        setRules(data.results ?? []);
      } catch (err) {
        if (handleAuthError(err)) return;
        const message = err instanceof ApiError ? err.message : "Unable to load bonus rules.";
        if (showLoading) setLoadError(message);
        else toast.error(message);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [handleAuthError],
  );

  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);

  function replaceRule(updated: RewardRule) {
    setRules((prev) => prev.map((r) => (r.trigger === updated.trigger ? updated : r)));
  }

  async function handleNotFound(err: unknown): Promise<boolean> {
    if (err instanceof ApiError && err.code === "reward_rule_not_found") {
      toast.error("Bonus rule not found.");
      await refresh({ showLoading: false });
      return true;
    }
    return false;
  }

  async function toggleActive(rule: RewardRule, next: boolean) {
    setTogglingTrigger(rule.trigger);
    try {
      const updated = await withAuthRetry((token) =>
        updateRewardRule(token, rule.trigger, { is_active: next }),
      );
      replaceRule(updated);
      toast.success(`${updated.title} ${updated.is_active ? "activated" : "turned off"}`);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (await handleNotFound(err)) return;
      toast.error(err instanceof ApiError ? err.message : "Unable to update bonus rule.");
    } finally {
      setTogglingTrigger(null);
    }
  }

  function openEdit(rule: RewardRule) {
    setEditing(rule);
    setForm({
      title: rule.title,
      description: rule.description ?? "",
      coins: String(rule.coins),
      is_active: rule.is_active,
    });
    setFieldErrors({});
  }

  function setField<K extends RuleField>(key: K, value: RuleForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function saveRule() {
    if (!editing) return;
    const errors = validateRule(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const patch: UpdateRewardRulePayload = {};
    const title = form.title.trim();
    const description = form.description.trim();
    const coins = Number(form.coins.trim());
    if (title !== editing.title) patch.title = title;
    if (description !== (editing.description ?? "")) patch.description = description || null;
    if (coins !== editing.coins) patch.coins = coins;
    if (form.is_active !== editing.is_active) patch.is_active = form.is_active;
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }

    setSaving(true);
    try {
      const updated = await withAuthRetry((token) =>
        updateRewardRule(token, editing.trigger, patch),
      );
      replaceRule(updated);
      toast.success(`${updated.title} updated`);
      setEditing(null);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (await handleNotFound(err)) {
        setEditing(null);
        return;
      }
      if (err instanceof ApiError) {
        const inline: RuleErrors = {};
        let hasOther = false;
        for (const [field, message] of Object.entries(apiFieldErrors(err))) {
          if (field in form) inline[field as RuleField] = message;
          else hasOther = true;
        }
        if (Object.keys(inline).length > 0) setFieldErrors(inline);
        if (hasOther || Object.keys(inline).length === 0) toast.error(err.message);
        return;
      }
      toast.error("Unable to save bonus rule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-soft)]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading bonus rules…
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void refresh({ showLoading: true })}
            >
              Retry
            </Button>
          </div>
        ) : rules.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No bonus rules available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3 text-right">Coins</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 text-right">Edit</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr
                    key={rule.trigger}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{rule.title}</div>
                      {REWARD_RULE_HELP[rule.trigger] ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {REWARD_RULE_HELP[rule.trigger]}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {rule.coins.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.is_active}
                          disabled={togglingTrigger === rule.trigger}
                          onCheckedChange={(v) => void toggleActive(rule, v)}
                          aria-label={`${rule.title} active`}
                        />
                        <ActiveBadge active={rule.is_active} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-xl"
                        onClick={() => openEdit(rule)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>Edit bonus rule</SheetTitle>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col overflow-hidden"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void saveRule();
            }}
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {editing && REWARD_RULE_HELP[editing.trigger] ? (
                <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  {REWARD_RULE_HELP[editing.trigger]}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
                <div>
                  <Label htmlFor="rule-active" className="text-sm font-medium">
                    Active
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Customers only earn this bonus while it is active.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ActiveBadge active={form.is_active} />
                  <Switch
                    id="rule-active"
                    checked={form.is_active}
                    onCheckedChange={(v) => setField("is_active", v)}
                  />
                </div>
              </div>

              <FormRow
                id="rule-title"
                label="Title"
                error={fieldErrors.title}
                hint="Shown to customers in the app."
              >
                <Input
                  id="rule-title"
                  value={form.title}
                  maxLength={REWARD_RULE_TITLE_MAX}
                  onChange={(e) => setField("title", e.target.value)}
                  aria-invalid={!!fieldErrors.title}
                  className={cn("rounded-xl", fieldErrors.title && "border-destructive")}
                />
              </FormRow>

              <FormRow id="rule-coins" label="Coins" error={fieldErrors.coins}>
                <Input
                  id="rule-coins"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={REWARD_RULE_COINS_MAX}
                  step={1}
                  value={form.coins}
                  onChange={(e) => setField("coins", e.target.value)}
                  aria-invalid={!!fieldErrors.coins}
                  className={cn("rounded-xl", fieldErrors.coins && "border-destructive")}
                />
              </FormRow>

              <FormRow
                id="rule-description"
                label={
                  <>
                    Description{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </>
                }
                error={fieldErrors.description}
                hint={`${form.description.trim().length}/${REWARD_RULE_DESCRIPTION_MAX}`}
              >
                <Textarea
                  id="rule-description"
                  value={form.description}
                  maxLength={REWARD_RULE_DESCRIPTION_MAX}
                  onChange={(e) => setField("description", e.target.value)}
                  aria-invalid={!!fieldErrors.description}
                  className={cn(
                    "min-h-[80px] rounded-xl",
                    fieldErrors.description && "border-destructive",
                  )}
                />
              </FormRow>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {active ? "On" : "Off"}
    </span>
  );
}

function FormRow({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
