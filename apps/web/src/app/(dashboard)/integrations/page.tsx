"use client";

import { useEffect, useState } from "react";
import { can, currentRole } from "@/lib/permissions";

export default function Page() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => setAllowed(can.connectIntegrations(currentRole())), []);

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
