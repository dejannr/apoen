import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth';
import DashboardHome from '@/components/dashboard-home';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);
  const user = session?.user ? session.user as { id: string; name?: string | null; role?: string } : null;
  return <DashboardHome user={user} />;
}
