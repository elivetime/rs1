import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function Login() {
  if (await isAdmin()) redirect('/admin');
  return (
    <main className="wrap" style={{ maxWidth: 460 }}>
      <a className="brand" href="/">AIUniverse.one</a>
      <section className="card">
        <div className="eyebrow">Management</div>
        <h1 style={{ fontSize: 32 }}>Sign in to review call requests</h1>
        <LoginForm />
      </section>
    </main>
  );
}
