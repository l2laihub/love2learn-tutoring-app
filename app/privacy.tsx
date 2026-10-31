/**
 * Privacy Policy (public)
 * Served in the app and at https://dalesson.app/privacy.
 * Content: docs/PRIVACY_POLICY.md (run `npm run legal` after editing).
 */
import { LegalPage } from '../src/components/LegalPage';
import { MarkdownView } from '../src/components/MarkdownView';
import { PRIVACY_POLICY_MD } from '../src/content/legal';

export default function PrivacyPolicyScreen() {
  return (
    <LegalPage>
      <MarkdownView markdown={PRIVACY_POLICY_MD} />
    </LegalPage>
  );
}
