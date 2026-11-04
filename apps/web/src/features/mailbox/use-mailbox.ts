"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMailbox } from "./api";
import type { MailboxStatus } from "./types";

/**
 * Whether the mailbox automation is connected for this workspace. While it is unknown (loading or failed) the page
 * behaves exactly as before: manual copy / paste only.
 */
export function useMailbox() {
  const [mailbox, setMailbox] = useState<MailboxStatus | null>(null);
  const reload = useCallback(async () => {
    try { setMailbox(await fetchMailbox()); } catch { /* keep the last known value; manual flow still works */ }
  }, []);
  useEffect(() => {
    let current = true;
    fetchMailbox().then((next) => { if (current) setMailbox(next); }).catch(() => {});
    return () => { current = false; };
  }, []);
  const ready = mailbox?.connected === true && mailbox.status === "connected";
  return { mailbox, ready, reload, setMailbox };
}
