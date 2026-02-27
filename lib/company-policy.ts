const ADMIN_EMAIL = 'm.vinay.sagar21@gmail.com';
const MANAGER_EMAIL = 'ravali1952@gmail.com';
const DEFAULT_ACCESS_MODE = 'open';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COMPANY_ACCESS_ERROR =
  'Access restricted: your email must be approved by an admin to use this application.';
export const COMPANY_PRIVILEGED_EMAILS = [ADMIN_EMAIL, MANAGER_EMAIL];

export type PrivilegedRole = 'admin' | 'manager' | null;
export type CompanyAccessMode = 'open' | 'allowlist';
export type CompanyPolicy = {
  mode: CompanyAccessMode;
  allowedEmails: string[];
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAccessMode(value: string | undefined | null): CompanyAccessMode {
  const normalized = (value || DEFAULT_ACCESS_MODE).trim().toLowerCase();
  return normalized === 'allowlist' ? 'allowlist' : 'open';
}

function dedupeEmails(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeEmail(value)).filter(Boolean)));
}

export function parseAllowedEmails(value: unknown): string[] {
  if (Array.isArray(value)) {
    return dedupeEmails(value.filter((item): item is string => typeof item === 'string'));
  }

  if (typeof value === 'string') {
    return dedupeEmails(value.split(','));
  }

  return [];
}

export function mergeAllowedEmails(allowed: string[]): string[] {
  return dedupeEmails([...COMPANY_PRIVILEGED_EMAILS, ...allowed]);
}

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_REGEX.test(normalizeEmail(email));
}

export function getCompanyPolicyFromEnv(): CompanyPolicy {
  const mode = normalizeAccessMode(process.env.NEXT_PUBLIC_COMPANY_ACCESS_MODE);
  const envAllowed = parseAllowedEmails(process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS);

  return {
    mode,
    allowedEmails: mergeAllowedEmails(envAllowed),
  };
}

export function getCompanyPolicyFromSource(input: {
  access_mode?: unknown;
  allowed_emails?: unknown;
} | null | undefined): CompanyPolicy {
  if (!input) {
    return getCompanyPolicyFromEnv();
  }

  const mode = normalizeAccessMode(typeof input.access_mode === 'string' ? input.access_mode : undefined);
  const allowedEmails = mergeAllowedEmails(parseAllowedEmails(input.allowed_emails));

  return {
    mode,
    allowedEmails,
  };
}

export function isMissingCollectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const typed = error as { status?: number; code?: number; type?: string; message?: string };
  const message = typed.message?.toLowerCase() || '';
  const type = typed.type?.toLowerCase() || '';

  return (
    typed.status === 404 ||
    typed.code === 404 ||
    type.includes('collection_not_found') ||
    message.includes('collection with the requested id') ||
    message.includes('could not be found')
  );
}

export function getPrivilegedEmailRole(email?: string | null): PrivilegedRole {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  if (normalized === ADMIN_EMAIL) return 'admin';
  if (normalized === MANAGER_EMAIL) return 'manager';
  return null;
}

export function getCompanyAccessMode(): CompanyAccessMode {
  return getCompanyPolicyFromEnv().mode;
}

export function getCompanyAllowedEmails(): string[] {
  return getCompanyPolicyFromEnv().allowedEmails;
}

export function isCompanyEmailAllowed(email?: string | null, policy?: CompanyPolicy): boolean {
  if (!email) return false;
  const activePolicy = policy || getCompanyPolicyFromEnv();
  if (activePolicy.mode === 'open') return true;
  const normalized = normalizeEmail(email);
  return activePolicy.allowedEmails.includes(normalized);
}

export function companyPolicySummary(): string {
  const policy = getCompanyPolicyFromEnv();
  if (policy.mode === 'open') {
    return 'Company access mode: open (all emails can sign in).';
  }

  return `Company access mode: allowlist (${policy.allowedEmails.length} approved email(s)).`;
}
