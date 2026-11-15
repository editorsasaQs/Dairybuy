import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Container } from '@/components/brand/Container';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOutAction } from '@/app/auth/actions';
import { AddressBook } from '@/components/account/AddressBook';
import { isAdminOrOwner } from '@/lib/services/auth-service';
import type { UserRole } from '@/lib/supabase/types';
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/login?next=/account');
  const { data: profileData } = await supabase.from('profiles').select('full_name,email,phone').eq('id', user.id).maybeSingle();
  const profile = profileData as { full_name: string | null; email: string | null; phone: string | null } | null;
  const { data: rolesData } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const roles = rolesData as Array<{ role: string }> | null;
  const canManageOrders = (roles ?? []).some((entry) => isAdminOrOwner(entry.role as UserRole));
  const canManageDeliveries = (roles ?? []).some((entry) => ["owner", "admin", "manager", "operations_staff"].includes(entry.role));
  return <main className="db-page py-(--section-y)"><Container className="max-w-3xl"><section className="db-panel rounded-[2.5rem] border-2 border-white bg-[#dff5fc] p-6 shadow-pop sm:p-9">
    <p className="text-sm font-semibold text-highlight-ink">Your Dairybuy account</p><h1 className="mt-2 text-3xl">Hello, {profile?.full_name || user.email || 'there'}!</h1>
    <dl className="mt-7 grid gap-4 sm:grid-cols-2">
      <div className="rounded-[1.5rem] border-2 border-white bg-white/80 p-4"><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all font-semibold">{profile?.email || user.email}</dd></div>
      <div className="rounded-control bg-background p-4"><dt className="text-xs text-muted-foreground">Phone</dt><dd className="mt-1 font-semibold">{profile?.phone || 'Not added yet'}</dd></div>
      <div className="rounded-control bg-background p-4"><dt className="text-xs text-muted-foreground">Role</dt><dd className="mt-1 font-semibold">{(roles || []).map((r) => r.role).join(', ') || 'customer'}</dd></div>
    </dl>
    <p className="mt-6 text-sm text-muted-foreground">Manage your saved addresses and review your recent orders from your account.</p>
    <div className="mt-7 flex flex-wrap gap-4"><Link href="/account/orders" className="text-sm font-semibold text-highlight-ink underline">My orders</Link><Link href="/subscriptions" className="text-sm font-semibold text-highlight-ink underline">Milk subscriptions</Link>{canManageDeliveries ? <Link href="/delivery/subscriptions" className="text-sm font-semibold text-highlight-ink underline">My assigned deliveries</Link> : null}{canManageOrders ? <><Link href="/admin/orders" className="text-sm font-semibold text-highlight-ink underline">Order management</Link><Link href="/admin/subscriptions" className="text-sm font-semibold text-highlight-ink underline">Subscription deliveries</Link><Link href="/admin/inventory/audit" className="text-sm font-semibold text-highlight-ink underline">Inventory audit</Link></> : null}<Link href="/products" className="text-sm font-semibold text-highlight-ink underline">Browse products</Link><form action={signOutAction}><button className="text-sm font-semibold text-highlight-ink underline">Logout</button></form></div>
  </section><AddressBook /></Container></main>;
}
