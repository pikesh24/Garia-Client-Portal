"use client";

import { Fragment, useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { Discount, DiscountType, FeatureRequest, Invoice, User } from "@/lib/types";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";

type Tab = "invoices" | "discounts";

export default function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>("invoices");
  return (
    <div className="space-y-6">
      <PageHeader title="Billing, Invoices & Discounts Matrix" />
      <div className="flex gap-2">
        <Button variant={tab === "invoices" ? "primary" : "secondary"} onClick={() => setTab("invoices")}>
          Invoice Compilation
        </Button>
        <Button variant={tab === "discounts" ? "primary" : "secondary"} onClick={() => setTab("discounts")}>
          Discount Profiles
        </Button>
      </div>
      {tab === "invoices" ? <InvoicesTab /> : <DiscountsTab />}
    </div>
  );
}

function InvoicesTab() {
  const [clients, setClients] = useState<User[]>([]);
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientId, setClientId] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<number[]>([]);
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTax, setEditTax] = useState("0");
  const [editNotes, setEditNotes] = useState("");

  async function loadAll() {
    const [c, f, i] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<FeatureRequest[]>("/api/admin/feature-requests"),
      apiRequest<Invoice[]>("/api/admin/billing/invoices"),
    ]);
    setClients(c);
    setFeatures(f);
    setInvoices(i);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const eligibleFeatures = features.filter(
    (f) => String(f.client_id) === clientId && f.added_by_client && f.status !== "cancelled"
  );

  function toggleFeature(id: number) {
    setSelectedFeatures((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function generateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/api/admin/billing/invoices", {
        method: "POST",
        body: {
          client_id: Number(clientId),
          feature_ids: selectedFeatures,
          tax_amount: Number(taxAmount),
          notes,
        },
      });
      setSelectedFeatures([]);
      setNotes("");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not generate invoice");
    }
  }

  async function finalize(id: number) {
    await apiRequest(`/api/admin/billing/invoices/${id}/finalize`, { method: "POST" });
    await loadAll();
  }

  async function deleteDraft(id: number) {
    if (!confirm("Delete this draft invoice?")) return;
    await apiRequest(`/api/admin/billing/invoices/${id}`, { method: "DELETE" });
    await loadAll();
  }

  function startEdit(inv: Invoice) {
    setEditingId(inv.id);
    setEditTax(String(inv.tax_amount));
    setEditNotes(inv.notes ?? "");
  }

  async function overwriteInvoice(id: number) {
    setError(null);
    try {
      await apiRequest(`/api/admin/billing/invoices/${id}`, {
        method: "PUT",
        body: { tax_amount: Number(editTax), notes: editNotes },
      });
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not overwrite invoice");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>Invoice Compilation Worksheet</CardHeader>
        <CardBody>
          <form onSubmit={generateInvoice} className="space-y-4">
            {error && <Alert>{error}</Alert>}
            <Field>
              <Label>Client</Label>
              <Select value={clientId} onChange={(e) => { setClientId(e.target.value); setSelectedFeatures([]); }} required>
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </Field>

            {clientId && (
              <Field>
                <Label>Eligible Feature Requests</Label>
                {eligibleFeatures.length === 0 ? (
                  <p className="text-sm text-text-muted">No eligible feature requests for this client.</p>
                ) : (
                  <div className="space-y-1">
                    {eligibleFeatures.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 text-sm text-text-primary">
                        <input
                          type="checkbox"
                          checked={selectedFeatures.includes(f.id)}
                          onChange={() => toggleFeature(f.id)}
                        />
                        {f.name} <StatusBadge status={f.status} />
                      </label>
                    ))}
                  </div>
                )}
              </Field>
            )}

            <Field>
              <Label>Tax Amount</Label>
              <Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </Field>
            <Field>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button type="submit">Generate Draft Invoice Record</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Invoices</CardHeader>
        <CardBody>
          {invoices.length === 0 ? (
            <EmptyState>No invoices yet.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <Fragment key={inv.id}>
                    <tr>
                      <Td className="font-mono">INV-{inv.id}</Td>
                      <Td className="font-mono">#{inv.client_id}</Td>
                      <Td>
                        <StatusBadge status={inv.status} />
                      </Td>
                      <Td className="font-mono">${inv.total.toFixed(2)}</Td>
                      <Td>
                        {inv.status === "draft" && (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => finalize(inv.id)}>
                              Finalize
                            </Button>
                            <Button variant="secondary" onClick={() => startEdit(inv)}>
                              Overwrite
                            </Button>
                            <Button variant="danger" onClick={() => deleteDraft(inv.id)}>
                              Delete
                            </Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                    {editingId === inv.id && (
                      <tr>
                        <Td colSpan={5}>
                          <div className="flex flex-wrap items-end gap-2 rounded-sm border border-amber/40 p-2">
                            <Field>
                              <Label>Tax Amount</Label>
                              <Input type="number" value={editTax} onChange={(e) => setEditTax(e.target.value)} />
                            </Field>
                            <Field>
                              <Label>Notes</Label>
                              <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                            </Field>
                            <Button onClick={() => overwriteInvoice(inv.id)}>
                              Complete Overwrite Overhaul
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function DiscountsTab() {
  const [clients, setClients] = useState<User[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<DiscountType>("percentage");
  const [editValue, setEditValue] = useState("");
  const [editActive, setEditActive] = useState(true);

  async function loadAll() {
    const [c, d] = await Promise.all([
      apiRequest<User[]>("/api/admin/users"),
      apiRequest<Discount[]>("/api/admin/discounts"),
    ]);
    setClients(c);
    setDiscounts(d);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function deploy(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest("/api/admin/discounts", {
        method: "POST",
        body: { client_id: Number(clientId), name, discount_type: discountType, value: Number(value), is_active: isActive },
      });
      setName("");
      setValue("");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not deploy discount");
    }
  }

  async function deleteDiscount(id: number) {
    if (!confirm("Delete this discount rule?")) return;
    await apiRequest(`/api/admin/discounts/${id}`, { method: "DELETE" });
    await loadAll();
  }

  function startEditDiscount(d: Discount) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditType(d.discount_type);
    setEditValue(String(d.value));
    setEditActive(d.is_active);
  }

  async function overwriteDiscount(id: number) {
    setError(null);
    try {
      await apiRequest(`/api/admin/discounts/${id}`, {
        method: "PUT",
        body: { name: editName, discount_type: editType, value: Number(editValue), is_active: editActive },
      });
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Could not overwrite discount");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>Configure Client Discount Configuration</CardHeader>
        <CardBody>
          <form onSubmit={deploy} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {error && (
              <div className="md:col-span-2">
                <Alert>{error}</Alert>
              </div>
            )}
            <Field>
              <Label>Target Customer Mapping</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Promotional Rule Tag</Label>
              <Input required placeholder="e.g. Strategic Retainer Alleviation" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <Label>Math Evaluation Logic</Label>
              <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
                <option value="percentage">Percentage Rule</option>
                <option value="fixed_amount">Flat Dollar Value</option>
              </Select>
            </Field>
            <Field>
              <Label>Operational Reduction</Label>
              <Input type="number" required value={value} onChange={(e) => setValue(e.target.value)} />
            </Field>
            <Field>
              <Label className="flex items-center gap-2">Active</Label>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit">Deploy New Discount Rule</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Existing Discount Rules</CardHeader>
        <CardBody>
          {discounts.length === 0 ? (
            <EmptyState>No discount rules configured.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Client</Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Value</Th>
                  <Th>Active</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((d) => (
                  <Fragment key={d.id}>
                    <tr>
                      <Td className="font-mono">#{d.client_id}</Td>
                      <Td>{d.name}</Td>
                      <Td>{d.discount_type}</Td>
                      <Td className="font-mono">{d.value}</Td>
                      <Td>{d.is_active ? "Yes" : "No"}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => startEditDiscount(d)}>
                            Overwrite
                          </Button>
                          <Button variant="danger" onClick={() => deleteDiscount(d.id)}>
                            Delete
                          </Button>
                        </div>
                      </Td>
                    </tr>
                    {editingId === d.id && (
                      <tr>
                        <Td colSpan={6}>
                          <div className="flex flex-wrap items-end gap-2 rounded-sm border border-amber/40 p-2">
                            <Field>
                              <Label>Name</Label>
                              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </Field>
                            <Field>
                              <Label>Type</Label>
                              <Select value={editType} onChange={(e) => setEditType(e.target.value as DiscountType)}>
                                <option value="percentage">Percentage Rule</option>
                                <option value="fixed_amount">Flat Dollar Value</option>
                              </Select>
                            </Field>
                            <Field>
                              <Label>Value</Label>
                              <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                            </Field>
                            <Field>
                              <Label className="flex items-center gap-2">Active</Label>
                              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                            </Field>
                            <Button onClick={() => overwriteDiscount(d.id)}>Overwrite Active Rules</Button>
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
