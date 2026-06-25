"use client";

import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { User } from "@/lib/types";
import { Button, Card, CardBody, CardHeader, Field, Input, Label, Alert, PageHeader } from "@/components/ui";

export default function ProfilePage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<User>("/api/profile").then((data) => {
      setProfile(data);
      setFullName(data.full_name);
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const updated = await apiRequest<User>("/api/profile", { method: "PATCH", body: { full_name: fullName } });
      setProfile(updated);
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? String(err.detail) : "Update failed");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwMessage(null);
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword },
      });
      setPwMessage("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof ApiError ? String(err.detail) : "Password change failed");
    }
  }

  if (!profile) return <p className="text-text-muted">Loading...</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Profile Workspace" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>Account Details</CardHeader>
          <CardBody>
            <form onSubmit={saveProfile}>
              {message && <Alert kind="warning">{message}</Alert>}
              {error && <Alert>{error}</Alert>}
              <Field>
                <Label>Full Name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>
              <Field>
                <Label>Email (locked)</Label>
                <Input value={profile.email} disabled />
              </Field>
              <Button type="submit">Save Changes</Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>Password Change</CardHeader>
          <CardBody>
            <form onSubmit={changePassword}>
              {pwMessage && <Alert kind="warning">{pwMessage}</Alert>}
              {pwError && <Alert>{pwError}</Alert>}
              <Field>
                <Label>Current Password</Label>
                <Input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </Field>
              <Field>
                <Label>New Password</Label>
                <Input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
              <Button type="submit">Change Password</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
