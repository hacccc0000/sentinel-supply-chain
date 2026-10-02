import { createFileRoute } from "@tanstack/react-router";
import { AllowlistPage } from "@/features/dashboard/governance";

export const Route = createFileRoute("/dashboard/allowlist")({ component: AllowlistPage });
