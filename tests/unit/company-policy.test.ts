import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getCompanyAccessMode,
  getCompanyAllowedEmails,
  getPrivilegedEmailRole,
  isCompanyEmailAllowed,
} from '../../lib/company-policy';

const originalAccessMode = process.env.NEXT_PUBLIC_COMPANY_ACCESS_MODE;
const originalAllowedEmails = process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS;

afterEach(() => {
  if (originalAccessMode === undefined) {
    delete process.env.NEXT_PUBLIC_COMPANY_ACCESS_MODE;
  } else {
    process.env.NEXT_PUBLIC_COMPANY_ACCESS_MODE = originalAccessMode;
  }

  if (originalAllowedEmails === undefined) {
    delete process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS;
  } else {
    process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS = originalAllowedEmails;
  }
});

describe('company policy', () => {
  it('maps privileged emails to role', () => {
    assert.equal(getPrivilegedEmailRole('m.vinay.sagar21@gmail.com'), 'admin');
    assert.equal(getPrivilegedEmailRole('ravali1952@gmail.com'), 'manager');
    assert.equal(getPrivilegedEmailRole('someone@example.com'), null);
  });

  it('allowlist includes privileged emails', () => {
    process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS = '';
    const allowed = getCompanyAllowedEmails();
    assert.ok(allowed.includes('m.vinay.sagar21@gmail.com'));
    assert.ok(allowed.includes('ravali1952@gmail.com'));
  });

  it('defaults to open access mode', () => {
    delete process.env.NEXT_PUBLIC_COMPANY_ACCESS_MODE;
    assert.equal(getCompanyAccessMode(), 'open');
    assert.equal(isCompanyEmailAllowed('unknown@example.com'), true);
  });

  it('validates email based on allowlist mode', () => {
    process.env.NEXT_PUBLIC_COMPANY_ACCESS_MODE = 'allowlist';
    process.env.NEXT_PUBLIC_COMPANY_ALLOWED_EMAILS = 'approved@example.com';
    assert.equal(isCompanyEmailAllowed('m.vinay.sagar21@gmail.com'), true);
    assert.equal(isCompanyEmailAllowed('approved@example.com'), true);
    assert.equal(isCompanyEmailAllowed('unknown@example.com'), false);
  });
});
