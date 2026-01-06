/**
 * Library Screen (Redirect)
 * Library functionality is now integrated into the Worksheets screen.
 * This file redirects to Worksheets with the Library tab selected.
 */

import { Redirect } from 'expo-router';

export default function LibraryScreen() {
  // Library is now part of Worksheets - redirect there
  return <Redirect href="/(tabs)/worksheets" />;
}
