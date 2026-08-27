"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Input, Label, PageHeader } from "@/components/ui";
import { useConfirm } from "@/lib/confirm";
import { useAuth } from "@/lib/auth";
import { useWsEvent } from "@/components/WebSocketProvider";

export default function AdminDevelopersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [developers, setDevelopers] = useState<User[]>([]);
  const usersVersion = useWsEvent("users");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const confirm = useConfirm();

  const [form, setForm] = useState({ email: "", password: "", full_name: "" });

  async function load() {
    const data = await apiRequest<User[]>("/api/admin/developers");
    setDevelopers(data);
  }

  useEffect(() => {
    load();
  }, [usersVersion]);

  // Developers cannot manage other developer accounts.
  useEffect(() => {
    if (user?.role === "developer") router.replace("/admin");
  }, [user, router]);

  const filteredDevelopers = useMemo(() => {
    if (!search) return developers;
    return developers.filter(
      (d) => d.full_name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [developers, search]);

  async function createDeveloper(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/api/admin/developers", { method: "POST", body: form });
      setShowForm(false);
      setForm({ email: "", password: "", full_name: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create developer");
    }
  }

  async function deactivateDeveloper(id: number) {
    const ok = await confirm({ message: "Deactivate this developer's account?", confirmLabel: "Deactivate", danger: true });
    if (!ok) return;
    await apiRequest(`/api/admin/developers/${id}/deactivate`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Developer Accounts"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New Developer"}</Button>}
      />

      {showForm && (
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--shadow-strong)] p-6 md:p-8">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Create Developer Account
          </h3>
          <form onSubmit={createDeveloper} className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {error && (
              <div className="md:col-span-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field>
              <Label>Temporary Password</Label>
              <Input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field>
              <Label>Full Name</Label>
              <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <div className="md:col-span-3 mt-4 pt-6 border-t-4 border-border-strong border-dashed flex justify-end">
              <Button type="submit">Create Developer</Button>
            </div>
          </form>
        </div>
      )}

      <div>
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <input
            type="text"
            placeholder="Search developers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-1/3 bg-bg-base border-2 border-border-strong p-3 font-data-mono text-sm focus:outline-none focus:border-text-main placeholder:text-text-muted/60"
          />
          <div className="font-data-mono text-xs text-text-muted uppercase tracking-widest">
            Showing {filteredDevelopers.length} of {developers.length} developers
          </div>
        </div>

        {developers.length === 0 ? (
          <EmptyState>No developers yet.</EmptyState>
        ) : filteredDevelopers.length === 0 ? (
          <EmptyState>No developers found matching your search.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredDevelopers.map((d) => {
              const initial = d.full_name ? d.full_name[0].toUpperCase() : "?";
              return (
                <div key={d.id} className="relative overflow-hidden bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--shadow-strong)] h-full flex flex-col p-6">
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-10 h-10 bg-brand-green border-2 border-border-strong flex items-center justify-center font-bold text-on-brand-green shadow-[3px_3px_0px_0px_var(--shadow-strong)] text-xl">
                      {initial}
                    </div>
                    <div className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase text-white ${d.is_active ? "bg-brand-green" : "bg-coral-red"}`}>
                      {d.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>

                  <div className="mb-10">
                    <h2 className="font-headline-lg text-2xl font-black uppercase text-text-main mb-1 truncate">{d.full_name}</h2>
                    <p className="font-data-mono text-xs text-text-muted">{d.email}</p>
                  </div>

                  {d.is_active && (
                    <div className="mt-auto border-t-2 border-border-strong pt-4">
                      <Button variant="ghost" className="text-coral-red hover:bg-coral-red/10" onClick={() => deactivateDeveloper(d.id)}>
                        Deactivate
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
