"use client";

import { Suspense, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Fixed 240px sidebar + fixed 64px top bar. On < lg screens the sidebar becomes a drawer. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* useSearchParams (LinkedIn tabs) needs a Suspense boundary */}
      <Suspense fallback={null}>
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      </Suspense>

      <div className="lg:pl-60">
        <Topbar onMenuClick={() => setNavOpen(true)} />
        <div className="pt-16">{children}</div>
      </div>
    </div>
  );
}
