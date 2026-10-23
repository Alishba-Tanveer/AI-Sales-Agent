"use client";

import { can } from "@/lib/permissions";
import { useRole } from "@/lib/use-role";

export default function Page() {
  const role = useRole();
  const allowed = role === null ? null : can.connectIntegrations(role);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
        {allowed === false ? (
          <p className="text-muted-foreground">Only the workspace Owner or an Admin can connect integrations. Ask one of them if you need something connected.</p>
        ) : (
          <p className="text-muted-foreground">Configure external services and connected accounts.</p>
        )}
      </div>
    </main>
  );
}
