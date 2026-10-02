import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/features/dashboard/projects";

export const Route = createFileRoute("/dashboard/projects")({ component: ProjectsPage });
