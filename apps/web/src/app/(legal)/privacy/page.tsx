import type { Metadata } from "next";
import { LEGAL, LegalPage, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: `Privacy Policy | ${LEGAL.product}` };

const sections: LegalSection[] = [
  {
    id: "overview",
    title: "Who we are",
    body: <p>{LEGAL.company} (&quot;we&quot;) runs {LEGAL.product}. This policy explains what personal data we handle, why, and the choices you have. For the people in your lead pipeline, you decide why and how their data is used, and we process it for you.</p>,
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <ul>
          <li><strong>Account data:</strong> your name, work email, password (stored only as a secure hash), role and profile photo.</li>
          <li><strong>Workspace data:</strong> your company profile, services, target industries, team members and settings.</li>
          <li><strong>Lead data you add or save:</strong> names, companies, job titles, emails, LinkedIn and website links, notes, messages you log and pipeline stage.</li>
          <li><strong>Public information we look up:</strong> job and project listings from public sources, and a company&apos;s public contact details from its website when you save an opportunity as a lead.</li>
          <li><strong>Usage data:</strong> activity logs of tasks run in your workspace, notifications, and basic technical data such as browser type and IP address for security.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>to provide and secure the service, including search, the lead pipeline, drafts and analytics;</li>
        <li>to send you account emails such as verification codes, invitations and password resets;</li>
        <li>to show your team shared results, activity and notifications;</li>
        <li>to fix problems and improve the service;</li>
        <li>to meet legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: <p>To write drafts and score opportunities, relevant text (for example a lead&apos;s name, company, role and your notes, plus your business profile) is sent to the AI provider we use. We send only what is needed for the task. Drafts are saved in your workspace for you to review, and nothing is sent to a lead until you send it yourself.</p>,
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We do not sell personal data. We share it only with:</p>
        <ul>
          <li>your workspace teammates, according to their role;</li>
          <li>service providers that help us run the product (hosting, email delivery, AI and web search providers), under agreements that limit their use of the data;</li>
          <li>authorities, when the law requires it.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: <p>We use your browser&apos;s storage to keep you signed in, remember your theme and keep small conveniences such as the filters you last used. We do not use advertising cookies.</p>,
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: <p>We keep workspace data while your account is active. When you delete your account or workspace we delete or anonymise its data, except what we must keep for legal or security reasons, and backups age out on a regular cycle.</p>,
  },
  {
    id: "security",
    title: "Security",
    body: <p>Passwords are hashed, connections use encryption, access is limited by role, and stored integration secrets are encrypted. No system is perfectly secure, so please use a strong, unique password.</p>,
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you may have the right to access, correct, delete or export your personal data, to object to or restrict some uses, and to complain to your data protection authority.</p>
        <p>You can edit most of your data in the app and delete your account in Settings. If a person in a pipeline asks you to remove or stop contacting them, move them to &quot;Do not contact&quot; or delete the lead. To make a request about your own data, write to <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>The service is for businesses and is not meant for anyone under 16. We do not knowingly collect their data.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: <p>We will post changes here and update the date at the top, and tell you in the app if a change matters. Questions? Write to <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`This policy explains how ${LEGAL.product} handles personal data, in plain language.`}
      sections={sections}
      other={{ href: "/terms", label: "Terms of Service" }}
    />
  );
}
