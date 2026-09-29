import { redirect } from 'next/navigation';

/** Backwards-compatible route for old bookmarks; authorization lives at /dashboard. */
export default function LegacyWorkspaceRoute() {
  redirect('/dashboard');
}
