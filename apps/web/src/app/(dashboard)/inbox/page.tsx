import { Suspense } from "react";
import { InboxPage } from "@/features/inbox/components/inbox-page";

export default function Page() { return <Suspense fallback={null}><InboxPage /></Suspense>; }
