import { createFileRoute } from "@tanstack/react-router";
import { ArchitecturePage } from "@/features/marketing/architecture";

export const Route = createFileRoute("/architecture")({ component: ArchitecturePage });
