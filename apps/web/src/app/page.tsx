"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasValidSession } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(hasValidSession() ? "/overview" : "/login");
  }, [router]);
  return null;
}
