import { createFileRoute } from "@tanstack/react-router";
import { BuildsListPage } from "@/features/dashboard/builds";

export const Route = createFileRoute("/dashboard/builds/")({ component: BuildsListPage });
