import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getCompanyAllowedEmails,
  getPrivilegedEmailRole,
  isCompanyEmailAllowed,
} from '../../lib/company-policy';

describe('company policy', () => {
  it('maps privileged emails to role', () => {
    assert.equal(getPrivilegedEmailRole('m.vinay.sagar21@gmail.com'), 'admin');
    assert.equal(getPrivilegedEmailRole('ravali1952@gmail.com'), 'manager');
    assert.equal(getPrivilegedEmailRole('someone@example.com'), null);
  });

  it('allowlist includes privileged emails', () => {
    const allowed = getCompanyAllowedEmails();
    assert.ok(allowed.includes('m.vinay.sagar21@gmail.com'));
    assert.ok(allowed.includes('ravali1952@gmail.com'));
  });

  it('validates email based on allowlist', () => {
    assert.equal(isCompanyEmailAllowed('m.vinay.sagar21@gmail.com'), true);
    assert.equal(isCompanyEmailAllowed('unknown@example.com'), false);
  });
});
