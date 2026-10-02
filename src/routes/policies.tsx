import { createFileRoute } from "@tanstack/react-router";
import { PoliciesPage } from "@/features/marketing/pages";

export const Route = createFileRoute("/policies")({ component: PoliciesPage });
