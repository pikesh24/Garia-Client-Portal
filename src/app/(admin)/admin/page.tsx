"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { FeatureRequest, Invoice, Meeting, Ticket, User } from "@/lib/types";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

export default function AdminDashboardPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<Meeting[]>("/api/admin/meetings"),
      apiRequest<Ticket[]>("/api/admin/tickets"),
      apiRequest<FeatureRequest[]>("/api/admin/feature-requests"),
      apiRequest<Invoice[]>("/api/admin/billing/invoices"),
    ]).then(([c, m, t, f, i]) => {
      setClients(c);
      setMeetings(m);
      setTickets(t);
      setFeatureRequests(f);
      setInvoices(i);
    });
  }, []);

  const openTickets = tickets.filter((t) => t.status !== "resolved").length;
  const pendingMeetings = meetings.filter((m) => m.status === "requested" || m.status === "rescheduled").length;
  const pendingQuotes = featureRequests.filter((f) => f.status === "initiated" || f.status === "clarification_requested").length;
  const draftInvoices = invoices.filter((i) => i.status === "draft").length;

  const stats = [
    { label: "Active Clients", value: clients.filter((c) => c.is_active).length },
    { label: "Pending Meeting Actions", value: pendingMeetings },
    { label: "Open Tickets", value: openTickets },
    { label: "Feature Requests Awaiting Quote", value: pendingQuotes },
    { label: "Draft Invoices", value: draftInvoices },
  ];

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center opacity-10">
        <span className="font-bg-numeral text-[40vw] text-bg-panel-dark select-none leading-none tracking-tighter">00</span>
      </div>

      <PageHeader title="GLOBAL DASHBOARD" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8 relative z-10 mb-12">
        {stats.map((s) => (
          <Card key={s.label} className="group hover:-translate-y-1 transition-transform">
            <CardBody className="flex flex-col items-center text-center justify-center py-8">
              <p className="font-label-caps text-label-caps uppercase tracking-[0.1em] text-secondary-fixed-dim mb-4">{s.label}</p>
              <p className="font-display-2xl text-display-2xl font-black text-coral-red leading-none">{s.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 relative z-10">
        <Card className="bg-bg-panel-alt-dark">
          <CardHeader>RECENTLY_FILED_TICKETS</CardHeader>
          <CardBody>
            <ul className="space-y-4">
              {tickets.slice(0, 5).map((t) => (
                <li key={t.id} className="font-data-mono text-data-mono text-white flex items-start gap-4 border-b-2 border-bg-panel-dark pb-4 last:border-0 last:pb-0">
                  <span className="bg-coral-red text-black font-bold px-2 py-1">#{t.id}</span>
                  <span className="opacity-80 mt-1">{t.description.slice(0, 80)}</span>
                </li>
              ))}
              {tickets.length === 0 && (
                <li className="font-data-mono text-data-mono text-secondary-fixed-dim uppercase tracking-widest text-center py-8">NO_TICKETS_FOUND</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

