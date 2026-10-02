import { createFileRoute } from "@tanstack/react-router";
import { BuildDetailPage } from "@/features/dashboard/build-detail";

export const Route = createFileRoute("/dashboard/builds/$buildId")({ component: BuildDetailPage });
