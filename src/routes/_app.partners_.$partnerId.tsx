import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/partners_/$partnerId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/people/partners/$partnerId",
      params: { partnerId: params.partnerId },
    });
  },
});
