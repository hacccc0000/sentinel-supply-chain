import { createFileRoute } from "@tanstack/react-router";
import { InstallWizardPage } from "@/features/dashboard/workers";

export const Route = createFileRoute("/dashboard/workers/install")({ component: InstallWizardPage });
