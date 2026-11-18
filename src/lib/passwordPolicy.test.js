import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordError } from './passwordPolicy.js';

test('new passwords must be 8 to 72 characters', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(passwordError('admin'), 'weak_password');
  assert.equal(passwordError('1234567'), 'weak_password');
  assert.equal(passwordError('12345678'), '');
  assert.equal(passwordError('a'.repeat(MAX_PASSWORD_LENGTH)), '');
  assert.equal(passwordError('a'.repeat(MAX_PASSWORD_LENGTH + 1)), 'weak_password');
});
