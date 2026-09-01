import type { Metadata } from "next";
import { LegalPageShell } from "@/components/marketing/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — Growth Command Center",
  description:
    "Privacy Policy for Growth Command Center, a multi-tenant financial intelligence platform operated by High Value Capital Group LLC.",
};

const LAST_UPDATED = "September 1, 2026";
const CONTACT_EMAIL = "connect@highvaluecapitalgroup.com";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy describes how <strong>High Value Capital Group LLC</strong> (&quot;HVCG,&quot;
        &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects information when you use{" "}
        <strong>Growth Command Center</strong> (&quot;GCC,&quot; &quot;the Service&quot;), including our website at{" "}
        growthcommandcenter.com and application at app.growthcommandcenter.com.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>Account information</h3>
      <p>
        When you register, we collect information such as your name, email address, company name, role,
        and authentication credentials managed through our identity provider. We do not store your
        account password in plain text.
      </p>
      <h3>Business and financial data</h3>
      <p>
        You or your organization may upload or connect business and financial data, including spreadsheets,
        accounting records, invoices, cash positions, KPIs, pipeline data, and related operational
        information. This data is used to provide dashboards, forecasts, reports, and AI-assisted insights
        within your workspace.
      </p>
      <h3>Connected third-party systems</h3>
      <p>
        If you connect third-party services (such as QuickBooks Online, Plaid, or other integrations),
        we receive data authorized by you through those providers&apos; APIs. The categories of data depend
        on the integration and the permissions you grant.
      </p>
      <h3>OAuth tokens and connection credentials</h3>
      <p>
        When you authorize a third-party integration, we store OAuth access tokens, refresh tokens, and
        related connection metadata (such as company or realm identifiers) on our servers. These credentials
        are used solely to maintain your connection and sync authorized data. They are not displayed in
        the browser and are not shared with other tenants.
      </p>
      <h3>Usage and technical data</h3>
      <p>
        We may collect log data, device and browser information, IP address, pages viewed, and product
        usage events to operate, secure, and improve the Service. Where analytics tools are enabled, they
        may use cookies or similar technologies as described below.
      </p>

      <h2>2. How We Use Information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Provide, maintain, and improve the Service</li>
        <li>Authenticate users and enforce tenant isolation</li>
        <li>Sync and process data from connected integrations you authorize</li>
        <li>Generate forecasts, KPIs, alerts, and AI-assisted insights for your organization</li>
        <li>Process subscriptions and billing for standalone customers</li>
        <li>Respond to support requests and service communications</li>
        <li>Detect, prevent, and address security issues or abuse</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>3. Service Providers</h2>
      <p>
        We use third-party service providers to operate GCC, including hosting, database, authentication,
        payment processing, email delivery, and AI inference providers. These providers process data on our
        behalf under contractual obligations appropriate to their role. We do not sell your personal
        information.
      </p>

      <h2>4. Data Security</h2>
      <p>
        We implement administrative, technical, and organizational measures designed to protect information
        against unauthorized access, alteration, disclosure, or destruction. No method of transmission or
        storage is completely secure; we cannot guarantee absolute security.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain account and business data for as long as your organization maintains an active
        subscription or engagement, and as needed to provide the Service, resolve disputes, enforce
        agreements, and comply with law. Connection tokens are retained while an integration remains
        connected and deleted or invalidated when you disconnect, subject to backup retention cycles.
      </p>

      <h2>6. Deletion Requests</h2>
      <p>
        Organization owners may request deletion of their workspace and associated data by contacting us.
        We will process verified requests within a reasonable timeframe, subject to legal retention
        requirements and backup systems. Disconnecting an integration stops future syncs and removes
        stored connection credentials from active use.
      </p>

      <h2>7. Cookies and Analytics</h2>
      <p>
        We use essential cookies for authentication and session management. If product analytics are
        enabled, we may use additional cookies or local storage to understand feature usage. You can
        control non-essential cookies through your browser settings where applicable.
      </p>

      <h2>8. Communications</h2>
      <p>
        We may send transactional emails (such as invitations, billing notices, and security alerts) and,
        with your consent where required, product updates. You may opt out of non-essential marketing
        communications.
      </p>

      <h2>9. Your Privacy Rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, or restrict processing
        of personal information, or to data portability. To exercise these rights, contact us using the
        information below. We may need to verify your identity before fulfilling a request.
      </p>

      <h2>10. Third-Party Integrations</h2>
      <p>
        Connected services (such as Intuit QuickBooks, Plaid, or Stripe) have their own privacy policies.
        Your use of those services is governed by their terms. We access third-party data only as
        authorized by you through OAuth or similar consent flows.
      </p>

      <h2>11. International Users</h2>
      <p>
        If you access the Service from outside the United States, your information may be processed in
        the United States or other locations where our service providers operate.
      </p>

      <h2>12. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the revised policy on this page
        and update the &quot;Last updated&quot; date. Material changes may be communicated through the Service or
        by email where appropriate.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        For privacy questions or requests, contact{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p className="text-sm">
        High Value Capital Group LLC · Growth Command Center
      </p>
    </LegalPageShell>
  );
}
