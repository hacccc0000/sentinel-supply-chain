import { createFileRoute } from "@tanstack/react-router";
import { IdentityPage } from "@/features/dashboard/admin";

export const Route = createFileRoute("/dashboard/identity")({ component: IdentityPage });
