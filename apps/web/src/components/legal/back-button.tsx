"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Returns to the page the visitor came from (sign up, accept invite), or to sign up if there is no history. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/signup"))}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#818CF8] transition-colors hover:text-[#C7D2FE]"
    >
      <ArrowLeft size={16} />
      Back
    </button>
  );
}
