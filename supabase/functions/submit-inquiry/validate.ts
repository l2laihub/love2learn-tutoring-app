// Pure validation + sanitization for the public inquiry form.
// No I/O — easy to unit-test under Deno.

export interface SanitizedInquiry {
  tutor_id: string;
  parent_name: string;
  parent_email: string | null;
  parent_phone: string | null;
  student_name: string | null;
  student_age: number | null;
  student_grade: string | null;
  subjects: string[];
  preferred_availability: string | null;
  message: string | null;
  referral_source: string | null;
}

export type ValidationResult =
  | { ok: true; value: SanitizedInquiry }
  | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

export function validateInquiry(input: Record<string, unknown>): ValidationResult {
  // Honeypot: a hidden "company" field. Bots fill it; humans never see it.
  const honeypot = input.company;
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return { ok: false, error: 'rejected' };
  }

  const tutor_id = typeof input.tutor_id === 'string' ? input.tutor_id.trim() : '';
  if (!UUID_RE.test(tutor_id)) {
    return { ok: false, error: 'invalid tutor' };
  }

  const parent_name = str(input.parent_name, 200);
  if (!parent_name) {
    return { ok: false, error: 'parent_name is required' };
  }

  const parent_email = str(input.parent_email, 320);
  const parent_phone = str(input.parent_phone, 50);
  if (!parent_email && !parent_phone) {
    return { ok: false, error: 'an email or phone is required' };
  }

  const rawSubjects = Array.isArray(input.subjects) ? input.subjects : [];
  const subjects = rawSubjects
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 20);

  return {
    ok: true,
    value: {
      tutor_id,
      parent_name,
      parent_email,
      parent_phone,
      student_name: str(input.student_name, 200),
      student_age: intOrNull(input.student_age),
      student_grade: str(input.student_grade, 50),
      subjects,
      preferred_availability: str(input.preferred_availability, 500),
      message: str(input.message, 2000),
      referral_source: str(input.referral_source, 200),
    },
  };
}
