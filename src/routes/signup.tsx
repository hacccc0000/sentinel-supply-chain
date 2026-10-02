import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-form";

export const Route = createFileRoute("/signup")({ head: () => ({ meta: [{ title: "Create account — BuildBouncer" }] }), component: () => <AuthPage mode="signup" /> });
