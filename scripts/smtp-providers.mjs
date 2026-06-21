/** Shared Supabase Auth SMTP provider presets (Resend default for production). */

export const PRODUCTION_SITE_URL = "https://growth-command-center-lbnt.vercel.app";
export const PRODUCTION_CALLBACK = `${PRODUCTION_SITE_URL}/auth/callback`;
export const SENDER_EMAIL = "connect@highvaluecapitalgroup.com";
export const SENDER_NAME = "Growth Command Center";
export const EMAIL_RATE_LIMIT = 100;

export const SMTP_PROVIDERS = {
  resend: {
    label: "Resend",
    host: "smtp.resend.com",
    port: "465",
    user: "resend",
    adminEmail: SENDER_EMAIL,
    senderName: SENDER_NAME,
    passwordEnv: "RESEND_API_KEY",
  },
  m365: {
    label: "Microsoft 365",
    host: "smtp.office365.com",
    port: "587",
    user: "manny@highvaluecapitalgroup.com",
    adminEmail: SENDER_EMAIL,
    senderName: SENDER_NAME,
    passwordEnv: "SMTP_MAILBOX_PASSWORD",
  },
};

export function resolveSmtpProvider(name = process.env.SMTP_PROVIDER ?? "resend") {
  const base = SMTP_PROVIDERS[name];
  if (!base) {
    throw new Error(`Unknown SMTP_PROVIDER "${name}". Use: ${Object.keys(SMTP_PROVIDERS).join(", ")}`);
  }
  if (name === "m365") {
    return {
      id: name,
      ...base,
      user: process.env.SMTP_USERNAME ?? "manny@highvaluecapitalgroup.com",
      adminEmail: process.env.SMTP_SENDER_EMAIL ?? SENDER_EMAIL,
    };
  }
  return { id: name, ...base };
}

export function buildAuthSmtpPayload(provider, password) {
  return {
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
    site_url: PRODUCTION_SITE_URL,
    uri_allow_list: PRODUCTION_CALLBACK,
    rate_limit_email_sent: EMAIL_RATE_LIMIT,
    smtp_host: provider.host,
    smtp_port: provider.port,
    smtp_user: provider.user,
    smtp_pass: password,
    smtp_admin_email: provider.adminEmail,
    smtp_sender_name: provider.senderName,
  };
}
