import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/features/marketing/pages";

export const Route = createFileRoute("/customers")({ component: CustomersPage });
