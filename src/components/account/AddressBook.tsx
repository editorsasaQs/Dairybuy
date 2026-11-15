"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type Address = {
  id: string;
  address_type: string;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
};

const emptyForm = {
  addressType: "Home",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "Kolkata",
  state: "West Bengal",
  pincode: "",
};

export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/addresses", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to load addresses.");
      setAddresses(payload.data.addresses as Address[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editingId ? "/api/addresses/" + editingId : "/api/addresses", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Unable to save address.");
      setForm(emptyForm);
      setEditingId(null);
      setMessage(editingId ? "Address updated." : "Address saved.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save address.");
    } finally {
      setSaving(false);
    }
  }

  async function action(id: string, kind: "default" | "delete") {
    setMessage("");
    try {
      const response = await fetch(kind === "default" ? `/api/addresses/${id}/default` : `/api/addresses/${id}`, {
        method: kind === "default" ? "POST" : "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Address action failed.");
      setMessage(kind === "default" ? "Default address updated." : "Address deleted.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Address action failed.");
    }
  }

  return (
    <section className="mt-8 rounded-[1.75rem] border-2 border-white bg-white/90 p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold">Your delivery addresses</h2>
      <p className="mt-1 text-sm text-muted-foreground">Save an address in an active Dairybuy delivery area.</p>
      {loading ? <p className="mt-4 text-sm" role="status">Loading addresses…</p> : addresses.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No saved addresses yet.</p> : (
        <ul className="mt-4 grid gap-3">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{address.address_type} · {address.recipient_name}</p>
                {address.is_default ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Default</span> : null}
              </div>
              <p className="mt-2 text-sm">{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}{address.landmark ? `, ${address.landmark}` : ""}</p>
              <p className="text-sm text-muted-foreground">{address.city}, {address.state} – {address.pincode} · {address.phone}</p>
              <div className="mt-3 flex gap-4 text-sm font-semibold">
                <button type="button" className="underline" onClick={() => {
                  setEditingId(address.id);
                  setForm({
                    addressType: address.address_type,
                    recipientName: address.recipient_name,
                    phone: address.phone,
                    addressLine1: address.address_line1,
                    addressLine2: address.address_line2 ?? "",
                    landmark: address.landmark ?? "",
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode,
                  });
                  setMessage("");
                }}>Edit</button>
                {!address.is_default ? <button type="button" className="underline" onClick={() => void action(address.id, "default")}>Set as default</button> : null}
                <button type="button" className="text-red-700 underline" onClick={() => void action(address.id, "delete")}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Address label
          <select className="rounded-xl border border-border bg-background p-3" value={form.addressType} onChange={(e) => setForm({ ...form, addressType: e.target.value })}>
            <option>Home</option><option>Work</option><option>Other</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">Recipient name
          <input required maxLength={120} className="rounded-xl border border-border bg-background p-3" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">Phone
          <input required inputMode="tel" maxLength={16} className="rounded-xl border border-border bg-background p-3" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">Pincode
          <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="rounded-xl border border-border bg-background p-3" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">Address line 1
          <input required maxLength={240} className="rounded-xl border border-border bg-background p-3" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">Address line 2
          <input maxLength={240} className="rounded-xl border border-border bg-background p-3" value={form.addressLine2} onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">Landmark
          <input maxLength={160} className="rounded-xl border border-border bg-background p-3" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">City
          <input required maxLength={100} className="rounded-xl border border-border bg-background p-3" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">State
          <input required maxLength={100} className="rounded-xl border border-border bg-background p-3" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button disabled={saving} className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60">{saving ? "Saving…" : editingId ? "Update address" : "Save address"}</button>
          {editingId ? <button type="button" className="rounded-full border border-border px-5 py-3 text-sm font-semibold" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel edit</button> : null}
        </div>
      </form>
      {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
    </section>
  );
}
