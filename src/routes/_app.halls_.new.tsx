import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  buildCreatePayload,
  EMPTY_HALL_FORM,
  HallForm,
  validateHallForm,
  type HallFormState,
} from "@/components/app/hall-form";
import { PageHeader } from "@/components/app/page-header";
import { apiFieldErrors } from "@/lib/api/client";
import { createHall } from "@/lib/api/halls";
import { ApiError } from "@/lib/api/types";
import { withAuthRetry } from "@/lib/api/with-auth";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/halls_/new")({
  component: NewHallPage,
  head: () => ({ meta: [{ title: "Add Hall — Daawat Baker's" }] }),
});

function NewHallPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<HallFormState>(EMPTY_HALL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    const local = validateHallForm(form, "create");
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      const hall = await withAuthRetry((t) => createHall(t, buildCreatePayload(form)));
      toast.success(`${hall.name} created. Now add images, slots and blackout dates.`);
      void navigate({ to: "/halls/$hallId", params: { hallId: hall.public_id } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        useAuth.getState().logout();
        void navigate({ to: "/login" });
        return;
      }
      setErrors(apiFieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : "Unable to create hall.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Add Hall" crumbs={["Banquet", "Halls", "New"]} />
      <div className="max-w-4xl p-4 sm:p-6 lg:p-8">
        <HallForm
          mode="create"
          value={form}
          onChange={setForm}
          errors={errors}
          saving={saving}
          onSubmit={() => void submit()}
          submitLabel="Create hall"
        />
      </div>
    </div>
  );
}
