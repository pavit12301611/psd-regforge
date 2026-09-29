import type { Metadata } from 'next';
import QuestionnaireForm from '@/components/QuestionnaireForm';
import { TopBar } from '@/components/Shell';

export const metadata: Metadata = { title: 'Shared questionnaire — RegForge' };

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen">
      <TopBar />
      <QuestionnaireForm token={token} />
    </div>
  );
}
