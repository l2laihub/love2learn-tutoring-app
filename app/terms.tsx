/**
 * Terms of Service (public)
 * Served in the app and at https://dalesson.app/terms.
 * Content: docs/TERMS_OF_SERVICE.md (run `npm run legal` after editing).
 */
import { LegalPage } from '../src/components/LegalPage';
import { MarkdownView } from '../src/components/MarkdownView';
import { TERMS_OF_SERVICE_MD } from '../src/content/legal';

export default function TermsOfServiceScreen() {
  return (
    <LegalPage>
      <MarkdownView markdown={TERMS_OF_SERVICE_MD} />
    </LegalPage>
  );
}
