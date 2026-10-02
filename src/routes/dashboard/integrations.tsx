import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/features/dashboard/admin";

export const Route = createFileRoute("/dashboard/integrations")({ component: IntegrationsPage });
