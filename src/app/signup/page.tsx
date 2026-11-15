'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { signUpAction, type AuthState } from '@/app/auth/actions';
import { Container } from '@/components/brand/Container';
import { buttonClasses } from '@/components/ui/button';
const initial: AuthState = {};
export default function SignupPage() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  return <main className="db-page py-(--section-y)"><Container className="max-w-lg"><section className="db-auth-panel rounded-[2.5rem] border-[5px] border-white bg-[#dff5fc] p-6 shadow-pop sm:p-9">
    <p className="db-kicker inline-flex rounded-full bg-[#ffd329] px-4 py-2 text-sm font-extrabold text-[#284967]">Join Dairybuy</p><h1 className="mt-2 text-3xl">Create your account</h1>
    <form action={action} className="mt-7 space-y-5">
      <div><label htmlFor="full_name" className="mb-2 block text-sm font-semibold">Full name</label><input id="full_name" name="full_name" autoComplete="name" maxLength={100} required className="min-h-12 w-full rounded-full border-2 border-white bg-white px-5" /></div>
      <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="min-h-12 w-full rounded-control border border-border bg-background px-4" /></div>
      <div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="min-h-12 w-full rounded-control border border-border bg-background px-4" /><p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters.</p></div>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.message && <p role="status" className="text-sm text-green-800">{state.message}</p>}
      <button disabled={pending} className={buttonClasses('primary','w-full justify-center disabled:opacity-60')}>{pending ? 'Creating account…' : 'Create account'}</button>
    </form><p className="mt-6 text-center text-sm text-muted-foreground">Already registered? <Link href="/login" className="font-semibold text-highlight-ink underline">Login</Link></p>
  </section></Container></main>;
}
