import type { Metadata } from "next";
import { LEGAL, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: `Privacy Policy | ${LEGAL.product}` };

// 8 sections; the page balances them into two equal columns.
const sections: LegalSection[] = [
  {
    title: "What we collect",
    body: (
      <ul className="list-disc space-y-1 pl-4">
        <li><strong>Account data:</strong> your name, work email and password (stored only as a secure hash).</li>
        <li><strong>Workspace data:</strong> your company profile, team and settings.</li>
        <li><strong>Lead data:</strong> contact details and notes you add or save.</li>
        <li><strong>Usage data:</strong> activity logs, browser type and IP address.</li>
      </ul>
    ),
  },
  {
    title: "How we use it",
    body: <p>To run and secure the service, send account emails such as verification codes and invitations, show your team shared activity, and improve the product.</p>,
  },
  {
    title: "Cookies and storage",
    body: <p>We use browser storage to keep you signed in and remember your theme. We do not use advertising cookies.</p>,
  },
  {
    title: "Security",
    body: <p>Data is encrypted in transit and access is limited by role. Passwords are stored only as secure hashes.</p>,
  },
  {
    title: "AI processing",
    body: <p>Only the text needed for a task is sent to our AI provider to write drafts and score opportunities. Nothing reaches a lead until you send it.</p>,
  },
  {
    title: "Sharing",
    body: <p>We do not sell personal data. We share it only with your teammates, providers that help run the service, and authorities when the law requires it.</p>,
  },
  {
    title: "Retention",
    body: <p>We keep workspace data while your account is active and delete it when you delete your account, unless the law requires otherwise.</p>,
  },
  {
    title: "Your choices",
    body: <p>You can edit your data and delete your account in Settings. If a lead asks not to be contacted, mark them &quot;Do not contact&quot; or delete them.</p>,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" sections={sections} />;
}
