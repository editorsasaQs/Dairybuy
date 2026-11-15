'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { signInAction, type AuthState } from '@/app/auth/actions';
import { Container } from '@/components/brand/Container';
import { buttonClasses } from '@/components/ui/button';
const initial: AuthState = {};
export default function LoginPage() {
  const [state, action, pending] = useActionState(signInAction, initial);
  return <main className="db-page py-(--section-y)"><Container className="max-w-lg"><section className="db-auth-panel rounded-[2.5rem] border-[5px] border-white bg-[#dff5fc] p-6 shadow-pop sm:p-9">
    <p className="db-kicker inline-flex rounded-full bg-[#ffd329] px-4 py-2 text-sm font-extrabold text-[#284967]">Welcome back</p><h1 className="mt-2 text-3xl">Login to Dairybuy</h1>
    <form action={action} className="mt-7 space-y-5">
      <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="min-h-12 w-full rounded-full border-2 border-white bg-white px-5" /></div>
      <div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="min-h-12 w-full rounded-control border border-border bg-background px-4" /></div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className={buttonClasses('primary','w-full justify-center disabled:opacity-60')}>{pending ? 'Signing in…' : 'Login'}</button>
    </form><p className="mt-6 text-center text-sm text-muted-foreground">New to Dairybuy? <Link href="/signup" className="font-semibold text-highlight-ink underline">Create account</Link></p>
  </section></Container></main>;
}
