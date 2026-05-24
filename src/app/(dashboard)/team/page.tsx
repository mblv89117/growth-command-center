"use client";

import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/lib/tenant/context";
import { useTenantData } from "@/hooks/use-tenant-data";
import { formatDate } from "@/lib/utils";
import { Loader2, Mail, UserPlus } from "lucide-react";

const roleLabels: Record<string, string> = {
  founder: "Founder / CEO",
  cfo: "CFO / Controller",
  operations: "Operations Manager",
  sales: "Sales Manager",
  project_manager: "Project Manager",
  admin: "Admin",
  staff: "Staff",
  advisor: "External Advisor",
};

export default function TeamPage() {
  const { organization } = useTenant();
  const { data, loading } = useTenantData();
  const { teamMembers } = data;

  const activeCount = teamMembers.filter((m) => m.status === "active").length;
  const invitedCount = teamMembers.filter((m) => m.status === "invited").length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage users, roles, invitations, and permissions"
        actions={
          <Button>
            <UserPlus className="mr-2 h-4 w-4" /> Invite Member
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{invitedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Organization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{organization.name}</p>
            <p className="text-sm capitalize text-muted-foreground">{organization.plan} plan</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>Send an invitation to join {organization.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="colleague@company.com" />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {Object.entries(roleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Button>
              <Mail className="mr-2 h-4 w-4" /> Send Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => (
                  <tr key={member.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{member.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                    <td className="px-4 py-3">{roleLabels[member.role]}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          member.status === "active"
                            ? "success"
                            : member.status === "invited"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {member.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {member.joinedAt
                        ? formatDate(member.joinedAt)
                        : member.invitedAt
                          ? `Invited ${formatDate(member.invitedAt)}`
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
