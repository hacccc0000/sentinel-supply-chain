import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/features/dashboard/policy";

export const Route = createFileRoute("/dashboard/policy")({ component: PolicyPage });
