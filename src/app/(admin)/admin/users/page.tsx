"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Alert, Button, EmptyState, Field, Input, Label, PageHeader } from "@/components/ui";

export default function AdminUsersPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    can_book_offline_meeting: false,
    hourly_rate_frontend: "",
    hourly_rate_backend: "",
    hourly_rate_production: "",
    maintenance_price: "",
    project_start_date: "",
  });

  async function load() {
    const data = await apiRequest<User[]>("/api/admin/users");
    setClients(data);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredClients = useMemo(() => {
    if (!search) return clients;
    return clients.filter(c => 
      c.full_name.toLowerCase().includes(search.toLowerCase()) || 
      c.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          can_book_offline_meeting: form.can_book_offline_meeting,
          hourly_rate_frontend: form.hourly_rate_frontend ? Number(form.hourly_rate_frontend) : null,
          hourly_rate_backend: form.hourly_rate_backend ? Number(form.hourly_rate_backend) : null,
          hourly_rate_production: form.hourly_rate_production ? Number(form.hourly_rate_production) : null,
          maintenance_price: form.maintenance_price ? Number(form.maintenance_price) : null,
          project_start_date: form.project_start_date || null,
        },
      });
      setShowForm(false);
      setForm({ ...form, email: "", password: "", full_name: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not create client");
    }
  }

  return (
    <div className="space-y-12">
      <PageHeader
        title="Client Accounts Configuration Matrix"
        action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New Client"}</Button>}
      />

      {showForm && (
        <div className="border-4 border-border-strong bg-bg-panel-alt shadow-[8px_8px_0px_0px_var(--border-strong)] p-6 md:p-8">
          <h3 className="font-display-xl text-3xl font-black uppercase text-text-main mb-6 border-b-4 border-border-strong pb-4">
            Create Client Account
          </h3>
          <form onSubmit={createClient} className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {error && (
              <div className="md:col-span-3">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Temporary Password</Label>
              <Input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Full Name</Label>
              <Input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Hourly Rate (Frontend)</Label>
              <Input
                type="number"
                value={form.hourly_rate_frontend}
                onChange={(e) => setForm({ ...form, hourly_rate_frontend: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Hourly Rate (Backend)</Label>
              <Input
                type="number"
                value={form.hourly_rate_backend}
                onChange={(e) => setForm({ ...form, hourly_rate_backend: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Hourly Rate (Production)</Label>
              <Input
                type="number"
                value={form.hourly_rate_production}
                onChange={(e) => setForm({ ...form, hourly_rate_production: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Annual Maintenance Price</Label>
              <Input
                type="number"
                value={form.maintenance_price}
                onChange={(e) => setForm({ ...form, maintenance_price: e.target.value })}
              />
            </Field>
            <Field>
              <Label>Project Start Date</Label>
              <Input
                type="date"
                value={form.project_start_date}
                onChange={(e) => setForm({ ...form, project_start_date: e.target.value })}
              />
            </Field>
            <Field className="flex items-center gap-3 md:col-span-1 pt-8">
              <input
                type="checkbox"
                className="w-5 h-5 border-2 border-border-strong rounded-none text-text-main focus:ring-0 cursor-pointer"
                checked={form.can_book_offline_meeting}
                onChange={(e) => setForm({ ...form, can_book_offline_meeting: e.target.checked })}
              />
              <Label className="!mb-0 cursor-pointer select-none font-bold uppercase tracking-widest text-sm">
                Can Book Offline Meetings
              </Label>
            </Field>
            <div className="md:col-span-3 mt-4 pt-6 border-t-4 border-border-strong border-dashed flex justify-end">
              <Button type="submit">Create Client</Button>
            </div>
          </form>
        </div>
      )}

      <div>
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-1/3 bg-bg-base border-2 border-border-strong p-3 font-data-mono text-sm focus:outline-none focus:border-text-main placeholder:text-text-muted/60"
          />
          <div className="font-data-mono text-xs text-text-muted uppercase tracking-widest">
            Showing {filteredClients.length > 0 ? 1 : 0} to {filteredClients.length} of {clients.length} clients
          </div>
        </div>

        {clients.length === 0 ? (
          <EmptyState>No clients yet.</EmptyState>
        ) : filteredClients.length === 0 ? (
          <EmptyState>No clients found matching your search.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredClients.map((c, index) => {
              const watermark = String.fromCharCode(65 + index); // A, B, C...
              const initial = c.full_name ? c.full_name[0].toUpperCase() : "?";
              return (
                <Link key={c.id} href={`/admin/users/${c.id}`} className="group block h-full">
                  <div className="relative overflow-hidden bg-bg-panel-alt border-4 border-border-strong shadow-[8px_8px_0px_0px_var(--border-strong)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_var(--border-strong)] h-full flex flex-col p-6">
                    {/* Watermark */}
                    <div className="absolute bottom-2 right-6 text-[100px] font-black text-border-strong/10 select-none z-0 leading-none pointer-events-none">
                      {watermark}
                    </div>

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-10">
                        <div className="w-10 h-10 bg-coral-red border-2 border-border-strong flex items-center justify-center font-bold text-white shadow-[3px_3px_0px_0px_var(--border-strong)] text-xl">
                          {initial}
                        </div>
                        <div className={`px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${c.is_active ? 'bg-forest-green text-white' : 'bg-border-muted text-white'}`}>
                          {c.is_active ? "Active" : "Inactive"}
                        </div>
                      </div>

                      <div className="mb-10">
                        <h2 className="font-headline-lg text-2xl font-black uppercase text-text-main mb-1 truncate">
                          {c.full_name}
                        </h2>
                        <p className="font-data-mono text-xs text-text-muted">
                          {c.email}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto relative z-10 border-t-2 border-border-strong pt-4 flex justify-between items-center group-hover:border-text-main transition-colors">
                      <span className="font-label-caps text-[10px] font-black uppercase tracking-widest text-text-main">
                        Manage Features
                      </span>
                      <span className="material-symbols-outlined text-text-main transition-transform group-hover:translate-x-1 text-sm font-bold">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
