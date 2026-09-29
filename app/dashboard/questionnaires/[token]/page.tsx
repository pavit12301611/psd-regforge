import type { Metadata } from 'next';
import AnswerDetail from '@/components/AnswerDetail';

export const metadata: Metadata = {
  title: 'Client answers — RegForge',
  description: 'Creator-only view of every answer in one questionnaire, with AI-ready export.',
  robots: { index: false, follow: false },
};

/**
 * Creator-only answer detail: /dashboard/questionnaires/{token}
 *
 * The component reads `users/{currentAuthUid}/questionnaires/{token}` directly
 * from the signed-in Google user's workspace. It never resolves the token
 * through the public `shareTokens/{token}` index, so an anonymous shared-link
 * client cannot open this page (Firestore rules deny that path without a Google
 * UID that matches the owner).
 */
export default async function AnswerDetailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AnswerDetail token={token} />;
}
