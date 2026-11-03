import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: `Terms of Service | ${LEGAL.product}` };

const sections: LegalSection[] = [
  {
    id: "acceptance",
    title: "Accepting these terms",
    body: (
      <>
        <p>By creating an account or using {LEGAL.product} you agree to these Terms of Service. If you use it on behalf of a company, you confirm you are allowed to bind that company to these terms.</p>
        <p>If you do not agree, do not create an account or use the service.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "What the service does",
    body: (
      <>
        <p>{LEGAL.product} helps sales teams find opportunities, keep a lead pipeline, draft outreach and manage LinkedIn activity. AI features research companies and write drafts for you to review.</p>
        <p><strong>You stay in control.</strong> The service drafts emails and LinkedIn messages. It does not send them for you: you review, edit and send each one yourself from your own accounts. You agree to read every draft before using it.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account and workspace",
    body: (
      <>
        <ul>
          <li>Give accurate information and keep your password and sign-in details secret.</li>
          <li>You are responsible for everything done under your account, including by teammates you invite.</li>
          <li>The workspace owner controls who is invited, their roles and what they can see. Leads, search results and activity are shared with the workspace team.</li>
          <li>Tell us straight away if you think your account was accessed without your permission.</li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>send spam, or contact people in a way that breaks anti-spam, marketing, privacy or data protection laws that apply to you or to them (for example CAN-SPAM, GDPR and PECR);</li>
          <li>ignore an opt-out or &quot;do not contact&quot; request;</li>
          <li>use the service for anything unlawful, deceptive, harassing or abusive;</li>
          <li>break the rules of the websites, job portals or networks you reach through the service, including LinkedIn&apos;s User Agreement. The service does not automate actions inside LinkedIn on your behalf;</li>
          <li>try to disrupt, reverse engineer or gain unauthorised access to the service, or resell it without our written permission.</li>
        </ul>
      </>
    ),
  },
  {
    id: "your-data",
    title: "Your content and data",
    body: (
      <>
        <p>You keep ownership of the leads, notes, messages and other content you put into the service. You give us the limited right to store and process it only to run the service for you, as described in our <Link href="/privacy">Privacy Policy</Link>.</p>
        <p>You are responsible for having a lawful reason to hold and contact the people in your pipeline, and for the content you choose to send.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI-generated content",
    body: (
      <>
        <p>Drafts, summaries, relevance scores and suggestions are produced by AI and can be wrong, out of date or unsuitable. Check facts, names and claims before you use them. We do not guarantee any result, such as replies, meetings or sales.</p>
        <p>Opportunities come from public third-party sources. We do not control or vouch for their accuracy or availability, and a source can be unavailable at any time.</p>
      </>
    ),
  },
  {
    id: "third-party",
    title: "Third-party services",
    body: <p>The service works with other providers, such as email, AI and search services you connect or we use to run it. Their own terms apply to your use of them, and we are not responsible for their services.</p>,
  },
  {
    id: "fees",
    title: "Plans and fees",
    body: <p>If a paid plan is offered, its price, limits and billing terms are shown when you choose it. Free plans can have usage limits. We will tell you before we change prices that affect you.</p>,
  },
  {
    id: "termination",
    title: "Ending your use",
    body: (
      <>
        <p>You can stop using the service and delete your account at any time from Settings. We can suspend or close accounts that break these terms or put the service or other people at risk.</p>
        <p>When an account is deleted we remove its data as described in the Privacy Policy.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>The service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent the law allows, we do not give any warranty that it will be uninterrupted or error free, and we are not liable for indirect or consequential loss, lost profit or lost data.</p>
        <p>Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim, or to the minimum the law requires if that is higher. Nothing here limits liability that cannot be limited by law.</p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: <p>We may update these terms. If a change is important we will tell you in the app or by email before it applies. Using the service after the change means you accept it.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms? Write to <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms explain the rules for using ${LEGAL.product}. Please read them. They are written in plain language, and we have kept them short.`}
      sections={sections}
      other={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
