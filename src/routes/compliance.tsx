import { createFileRoute } from "@tanstack/react-router";
import { ComplianceMarketingPage } from "@/features/marketing/pages";

export const Route = createFileRoute("/compliance")({ component: ComplianceMarketingPage });
