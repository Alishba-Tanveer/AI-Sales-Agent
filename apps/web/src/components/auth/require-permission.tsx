"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { can, currentRole, type Permission } from "@/features/auth/permissions";

/** Wrap a page that only some roles may open. Everyone else sees a short explanation instead of the page. */
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  if (can(currentRole(), permission)) return <>{children}</>;
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
          <Lock className="size-5" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">You don&apos;t have access to this page</h1>
        <p className="text-sm text-muted-foreground">Ask the workspace Owner or an Admin if you need it.</p>
        <Link href="/overview" className="text-sm font-medium text-primary hover:underline">Back to Overview</Link>
      </div>
    </main>
  );
}
