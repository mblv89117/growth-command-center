import type { Metadata } from "next";
import { LegalPageShell } from "@/components/marketing/legal-page-shell";
import { STANDALONE_PRICE_MONTHLY } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Terms of Service — Growth Command Center",
  description:
    "Terms of Service and End User License Agreement for Growth Command Center operated by High Value Capital Group LLC.",
};

const LAST_UPDATED = "September 1, 2026";
const CONTACT_EMAIL = "connect@highvaluecapitalgroup.com";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of{" "}
        <strong>Growth Command Center</strong> (&quot;GCC,&quot; &quot;the Service&quot;) provided by{" "}
        <strong>High Value Capital Group LLC</strong> (&quot;HVCG,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
        By creating an account or using the Service, you agree to these Terms.
      </p>

      <h2>1. Service Description</h2>
      <p>
        Growth Command Center is a multi-tenant software platform that helps businesses understand cash
        position, financial KPIs, forecasts, risks, and value-creation opportunities by unifying data from
        imports and authorized third-party integrations. Features may include dashboards, reports,
        scenario planning, alerts, and AI-assisted analysis.
      </p>

      <h2>2. Account Responsibilities</h2>
      <p>
        You are responsible for maintaining the confidentiality of your login credentials, for all activity
        under your account, and for ensuring that users you invite comply with these Terms. You must provide
        accurate registration information and keep it current. You must promptly notify us of unauthorized
        access to your account.
      </p>

      <h2>3. Authorized Use</h2>
      <p>
        You may use the Service only for lawful business purposes and in accordance with these Terms. You
        must have the authority to connect any third-party systems and to upload any data you provide to
        GCC.
      </p>

      <h2>4. Third-Party Integrations</h2>
      <p>
        The Service may connect to third-party platforms (such as QuickBooks Online, Plaid, or Stripe).
        Those connections require your authorization. Third-party services are not controlled by HVCG;
        their availability, terms, and data practices are governed by the respective providers. You are
        responsible for complying with third-party terms when enabling integrations.
      </p>

      <h2>5. Financial Data Disclaimer</h2>
      <p>
        GCC displays and analyzes financial and operational data you provide or authorize. Calculations,
        forecasts, and KPIs depend on the quality, completeness, and timeliness of source data. The Service
        does not replace professional accounting, tax, legal, or investment advice. You should verify
        material figures with qualified professionals before making business decisions.
      </p>

      <h2>6. AI-Generated Insights Disclaimer</h2>
      <p>
        AI-assisted features may produce summaries, explanations, or recommendations based on available
        data. AI outputs may be incomplete or inaccurate. They are provided for informational purposes only
        and should not be relied upon as the sole basis for financial, legal, or operational decisions.
      </p>

      <h2>7. Subscription, Trial, and HVCG Client Access</h2>
      <h3>Standalone subscription</h3>
      <p>
        Standalone access is offered as a monthly subscription currently priced at{" "}
        <strong>${STANDALONE_PRICE_MONTHLY} USD per month</strong>, subject to change with notice as
        described in Section 15. New standalone customers may receive a <strong>14-day trial</strong> as
        offered at signup. Billing is processed through our payment provider (Stripe). Fees are charged in
        advance for each billing period unless otherwise stated.
      </p>
      <h3>HVCG client access</h3>
      <p>
        Qualifying active High Value Capital Group advisory clients may receive GCC access as part of their
        engagement at no separate GCC software subscription charge while that engagement remains active and
        eligible. This is not lifetime free access — entitlement is tied to active engagement status and
        may be modified when engagement ends or eligibility changes.
      </p>

      <h2>8. Billing and Cancellation</h2>
      <p>
        Standalone subscribers authorize recurring charges through the payment method on file. You may
        manage or cancel your subscription through the billing portal where available. Cancellation stops
        future charges but does not retroactively refund prior periods unless required by law or stated in
        a specific offer. Upon cancellation or expiration, access may be limited according to our data
        retention practices.
      </p>

      <h2>9. Data Ownership</h2>
      <p>
        You retain ownership of data you upload or authorize GCC to access. You grant HVCG a limited
        license to host, process, transmit, and display that data solely to provide and improve the Service
        for your organization. We do not claim ownership of your underlying business records.
      </p>

      <h2>10. License to Use the Service</h2>
      <p>
        Subject to these Terms and your applicable entitlement, HVCG grants you a limited, non-exclusive,
        non-transferable, revocable license to access and use the Service for your internal business
        purposes during the subscription or engagement term.
      </p>

      <h2>11. Prohibited Conduct</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Access or attempt to access another tenant&apos;s data or connections</li>
        <li>Reverse engineer, scrape, or probe the Service except as permitted by law</li>
        <li>Introduce malware or interfere with Service operation or security</li>
        <li>Use the Service to violate applicable law or third-party rights</li>
        <li>Resell or sublicense the Service without written authorization</li>
        <li>Misrepresent your identity or affiliation</li>
      </ul>

      <h2>12. Service Availability</h2>
      <p>
        We strive to maintain reliable availability but do not guarantee uninterrupted or error-free
        operation. Maintenance, updates, third-party outages, or events beyond our reasonable control may
        affect access. Features may change over time as the product evolves.
      </p>

      <h2>13. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, HVCG and its affiliates will not be liable for
        indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue,
        data, or business opportunities arising from your use of the Service. Our aggregate liability for
        claims relating to the Service is limited to the fees you paid to HVCG for the Service in the
        twelve (12) months preceding the claim, or one hundred U.S. dollars if no fees were paid, whichever
        is greater.
      </p>

      <h2>14. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access for violation of
        these Terms, non-payment, security risk, or as required by law. Provisions that by nature should
        survive termination (including disclaimers, limitations of liability, and data ownership) will
        survive.
      </p>

      <h2>15. Changes to Terms</h2>
      <p>
        We may modify these Terms from time to time. Updated Terms will be posted on this page with a
        revised &quot;Last updated&quot; date. Continued use after changes become effective constitutes acceptance
        of the revised Terms. Material changes may be communicated through the Service or by email.
      </p>

      <h2>16. Governing Agreement</h2>
      <p>
        These Terms, together with our Privacy Policy and any order or entitlement applicable to your
        organization, constitute the entire agreement regarding the Service. If any provision is found
        unenforceable, the remaining provisions remain in effect.
      </p>
      <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
        <strong>Owner review:</strong> Governing law and dispute resolution venue have not been finalized in
        this public document. HVCG should confirm preferred jurisdiction with counsel before Intuit
        production approval if a specific governing law clause is required.
      </p>

      <h2>17. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p className="text-sm">
        High Value Capital Group LLC · Growth Command Center
      </p>
    </LegalPageShell>
  );
}
