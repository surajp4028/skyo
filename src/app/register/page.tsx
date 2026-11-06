import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterFlow } from "@/components/auth/register-flow";
import { IMAGES } from "@/lib/utils";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function RegisterPage() {
  return (
    <AuthShell image={IMAGES.kashmir} quote="Verified once. Trusted everywhere. Your next trip starts with a single code.">
      <RegisterFlow />
    </AuthShell>
  );
}
