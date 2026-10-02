import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-form";

export const Route = createFileRoute("/login")({ head: () => ({ meta: [{ title: "Sign in — BuildBouncer" }] }), component: () => <AuthPage mode="login" /> });
