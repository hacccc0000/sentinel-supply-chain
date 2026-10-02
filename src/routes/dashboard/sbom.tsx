import { createFileRoute } from "@tanstack/react-router";
import { SbomPage } from "@/features/dashboard/evidence";

export const Route = createFileRoute("/dashboard/sbom")({ component: SbomPage });
