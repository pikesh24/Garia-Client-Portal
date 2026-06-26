"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { User } from "@/lib/types";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Input, Button } from "@/components/ui";

export default function AdminBaseFeaturesClientPickerPage() {
  const [clients, setClients] = useState<User[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    apiRequest<User[]>("/api/admin/users").then(setClients);
  }, []);

  const filteredClients = clients?.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base + Extra Features"
        action={
          <Link href="/admin/feature-requests" className="text-amber underline">
            ← Back to Features
          </Link>
        }
      />

      {(!clients || clients.length === 0) && !searchQuery ? (
        <Card>
          <CardHeader>Select a Client</CardHeader>
          <CardBody>
            {!clients ? (
              <p className="text-text-muted">Loading clients...</p>
            ) : (
              <EmptyState>No clients yet.</EmptyState>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="w-full md:w-1/3">
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <p className="font-data-mono text-sm text-text-muted">
              Showing {filteredClients.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, filteredClients.length)} of {filteredClients.length} clients
            </p>
          </div>

          {filteredClients.length === 0 ? (
            <EmptyState>No clients match your search.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {paginatedClients.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/admin/feature-requests/base-features/${c.id}`}
                  className="group block relative bg-bg-base border-4 border-border-strong p-card-padding overflow-hidden shadow-[8px_8px_0px_0px_var(--border-strong)] hover:-translate-y-2 hover:-translate-x-2 hover:shadow-[16px_16px_0px_0px_var(--border-strong)] transition-all duration-300"
                >
                  <span className="absolute -right-4 -bottom-10 opacity-[0.03] group-hover:opacity-10 pointer-events-none font-bg-numeral text-[10rem] text-text-main leading-none select-none transition-opacity duration-300">
                    {String.fromCharCode(65 + (i % 26))}
                  </span>

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div className="w-14 h-14 bg-coral-red border-2 border-border-strong flex items-center justify-center font-display-xl text-white font-black text-2xl shadow-[4px_4px_0px_0px_var(--border-strong)] group-hover:-translate-y-1 group-hover:-translate-x-1 group-hover:shadow-[6px_6px_0px_0px_var(--border-strong)] transition-all">
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                      
                      {c.is_active ? (
                        <span className="font-data-mono text-[10px] uppercase tracking-widest bg-positive text-text-inverse border border-positive px-2 py-1">Active</span>
                      ) : (
                        <span className="font-data-mono text-[10px] uppercase tracking-widest bg-text-muted text-text-inverse border border-text-muted px-2 py-1">Inactive</span>
                      )}
                    </div>

                    <div className="mb-8">
                      <h3 className="font-headline-lg text-2xl font-black uppercase text-text-main mb-2 leading-tight group-hover:text-coral-red transition-colors">
                        {c.full_name}
                      </h3>
                      <p className="font-data-mono text-sm text-text-muted truncate">
                        {c.email}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t-2 border-border-strong pt-4 group-hover:border-coral-red transition-colors">
                      <span className="font-label-caps text-[10px] tracking-[0.1em] uppercase font-bold text-text-main group-hover:text-coral-red transition-colors">
                        Manage Features
                      </span>
                      <span className="material-symbols-outlined text-text-main group-hover:text-coral-red transition-colors transform group-hover:translate-x-2">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-8 border-t-4 border-border-strong mt-8">
              <Button
                variant="ghost"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="font-data-mono font-bold text-text-main">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
