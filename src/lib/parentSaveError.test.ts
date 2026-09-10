import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parentSaveErrorMessage } from './parentSaveError.ts';

// The duplicate-email collision is the one a tutor cannot diagnose alone:
// RLS hides the conflicting row, so the raw constraint name explains nothing.

Deno.test('duplicate email (by SQLSTATE) -> explains the invisible conflict', () => {
  const message = parentSaveErrorMessage({
    code: '23505',
    message: 'duplicate key value violates unique constraint "parents_email_unique"',
  });
  assertStringIncludes(message, 'already exists');
});

Deno.test('duplicate email (by constraint name alone) -> same message', () => {
  const message = parentSaveErrorMessage(
    new Error('duplicate key value violates unique constraint "parents_email_unique"')
  );
  assertStringIncludes(message, 'already exists');
});

Deno.test('other Postgres errors pass their message through', () => {
  assertEquals(
    parentSaveErrorMessage({ code: '42501', message: 'new row violates row-level security policy for table "parents"' }),
    'new row violates row-level security policy for table "parents"'
  );
});

Deno.test('messageless failure falls back instead of rendering [object Object]', () => {
  assertEquals(parentSaveErrorMessage({}), 'Something went wrong. Please try again.');
  assertEquals(parentSaveErrorMessage(null), 'Something went wrong. Please try again.');
});
