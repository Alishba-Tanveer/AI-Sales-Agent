import type { Metadata } from "next";
import { LEGAL, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: `Terms of Service | ${LEGAL.product}` };

// 8 sections; the page balances them into two equal columns.
const sections: LegalSection[] = [
  {
    title: "Accepting these terms",
    body: <p>By creating an account or using {LEGAL.product} you agree to these terms. If you do not agree, please do not use the service.</p>,
  },
  {
    title: "What the service does",
    body: <p>{LEGAL.product} helps sales teams find opportunities, manage leads and draft outreach with AI. <strong>You stay in control:</strong> it never sends messages for you. You review, edit and send every draft yourself.</p>,
  },
  {
    title: "Your account",
    body: <p>Keep your sign-in details secret and give accurate information. You are responsible for activity under your account, including teammates you invite.</p>,
  },
  {
    title: "Your content and AI output",
    body: <p>You own the content you add. AI drafts and scores can be wrong, so check them before use. We do not guarantee any results.</p>,
  },
  {
    title: "Acceptable use",
    body: (
      <ul className="list-disc space-y-1 pl-4">
        <li>No spam, and respect opt-out requests.</li>
        <li>Follow the rules of LinkedIn and other sites you use.</li>
        <li>Do not disrupt or gain unauthorised access to the service.</li>
      </ul>
    ),
  },
  {
    title: "Ending your use",
    body: <p>You can delete your account at any time in Settings. We may suspend accounts that break these terms.</p>,
  },
  {
    title: "Liability",
    body: <p>The service is provided &quot;as is&quot;, and to the extent the law allows we are not liable for indirect loss.</p>,
  },
  {
    title: "Changes to these terms",
    body: <p>We may update these terms from time to time. Continued use of the service means you accept the changes.</p>,
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of Service" sections={sections} />;
}
