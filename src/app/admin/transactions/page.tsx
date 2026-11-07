import { guardPage } from "@/lib/server/admin/guard";
import { TransactionsLog } from "@/components/admin/transactions";
import { Forbidden } from "@/components/admin/ui";
import { Suspense } from "react";

export default async function Page() {
  const { allowed } = await guardPage("payments.view");
  return allowed ? (
    <Suspense>
      <TransactionsLog />
    </Suspense>
  ) : (
    <Forbidden />
  );
}
