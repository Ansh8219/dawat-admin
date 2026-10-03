import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/partners")({
  beforeLoad: () => {
    throw redirect({
      to: "/people",
      search: { role: "partners", status: "pending" },
    });
  },
});
