const ADMIN_EMAIL = 'm.vinay.sagar21@gmail.com';
const MANAGER_EMAIL = 'ravali1952@gmail.com';

export const COMPANY_ACCESS_ERROR =
  'Access restricted: only approved company members can use this application.';

export type PrivilegedRole = 'admin' | 'manager' | null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseEnvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function getPrivilegedEmailRole(email?: string | null): PrivilegedRole {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  if (normalized === ADMIN_EMAIL) return 'admin';
  if (normalized === MANAGER_EMAIL) return 'manager';
  return null;
}

export function getCompanyAllowedEmails(): string[] {
  const envAllowed = parseEnvList(process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS);
  const merged = new Set<string>([ADMIN_EMAIL, MANAGER_EMAIL, ...envAllowed]);
  return Array.from(merged);
}

export function isCompanyEmailAllowed(email?: string | null): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  const allowed = getCompanyAllowedEmails();
  return allowed.includes(normalized);
}

export function companyPolicySummary(): string {
  const allowed = getCompanyAllowedEmails();
  return `Company access mode: allowlist (${allowed.length} approved email(s)).`;
}
