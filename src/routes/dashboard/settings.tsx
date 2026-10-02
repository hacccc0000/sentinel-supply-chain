import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/dashboard/admin";

export const Route = createFileRoute("/dashboard/settings")({ component: SettingsPage });
