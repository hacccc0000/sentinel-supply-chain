import { createFileRoute } from "@tanstack/react-router";
import { DocsPage } from "@/features/marketing/pages";

export const Route = createFileRoute("/docs")({ component: DocsPage });
