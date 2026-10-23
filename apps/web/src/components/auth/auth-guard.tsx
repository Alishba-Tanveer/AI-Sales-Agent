"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { tokenStore, TOKEN_STORE_EVENT } from "@/lib/api";

function isExpired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true; // unreadable token = treat as invalid
  }
}

const hasLiveToken = () => {
  const token = tokenStore.get();
  return !!token && !isExpired(token);
};
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(TOKEN_STORE_EVENT, cb);

  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(TOKEN_STORE_EVENT, cb);
  };
};

/** Wrap any page/layout that needs a logged-in user. Redirects to /login otherwise. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // false on the server and during hydration (nothing is rendered until the token has been checked in the browser)
  const ok = useSyncExternalStore(subscribe, hasLiveToken, () => false);

  useEffect(() => {
    if (!hasLiveToken()) {
      tokenStore.clear();
      router.replace("/login");
    }
  }, [router]);

  return ok ? <>{children}</> : null;
}
