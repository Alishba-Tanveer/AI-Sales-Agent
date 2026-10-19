"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/api";

function isExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true; // unreadable token = treat as invalid
  }
}

/** Wrap any page/layout that needs a logged-in user. Redirects to /login otherwise. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token || isExpired(token)) {
      tokenStore.clear();
      router.replace("/login");
      return;
    }
    setOk(true);
  }, [router]);

  return ok ? <>{children}</> : null;
}
