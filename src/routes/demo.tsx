import { createFileRoute } from "@tanstack/react-router";
import { DemoPage } from "@/features/marketing/pages";

export const Route = createFileRoute("/demo")({ component: DemoPage });
