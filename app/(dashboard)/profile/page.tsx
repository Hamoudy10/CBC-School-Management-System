"use client";

import { useEffect, useState } from "react";
import {
  BadgeInfo,
  CalendarDays,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatDate } from "@/lib/utils";

interface UserProfileData {
  profileId: string;
  userId: string;
  dateOfBirth: string | null;
  address: string | null;
  photoUrl: string | null;
  nationalId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  medicalConditions: string | null;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">
        {value && value.trim().length > 0 ? value : "-"}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user?.id) {
        if (mounted) {
          setProfile(null);
          setIsLoadingProfile(false);
        }
        return;
      }

      setIsLoadingProfile(true);
      setError(null);

      try {
        const response = await fetch(`/api/users/${user.id}/profile`, {
          credentials: "include",
        });
        const json = await response.json();

        if (response.status === 404) {
          if (mounted) {
            setProfile(null);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(
            json?.error || json?.message || "Failed to load profile",
          );
        }

        if (mounted) {
          setProfile(json.data || null);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load profile",
          );
        }
      } finally {
        if (mounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View your account information and personal profile details."
      >
        <Button
          variant="secondary"
          onClick={() => window.location.reload()}
          disabled={isLoadingProfile}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </PageHeader>

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar
                src={profile?.photoUrl || undefined}
                name={`${user.firstName} ${user.lastName}`}
                size="xl"
              />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {user.firstName} {user.lastName}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="info" className="capitalize">
                    {user.role.replaceAll("_", " ")}
                  </Badge>
                  <Badge
                    variant={user.status === "active" ? "success" : "warning"}
                    className="capitalize"
                  >
                    {user.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {user.email}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <ShieldCheck className="h-4 w-4" />
                  User ID
                </div>
                <p className="mt-2 break-all text-sm font-semibold text-gray-900">
                  {user.id}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingProfile ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : (
              <div>
                {!profile && (
                  <Alert variant="info" className="mb-4">
                    No extended profile details have been saved for this
                    account yet.
                  </Alert>
                )}

                <div className="space-y-1">
                  <DetailRow
                    label="Date of Birth"
                    value={
                      profile?.dateOfBirth
                        ? formatDate(profile.dateOfBirth)
                        : null
                    }
                  />
                  <DetailRow label="Address" value={profile?.address} />
                  <DetailRow label="National ID" value={profile?.nationalId} />
                  <DetailRow
                    label="Emergency Contact"
                    value={profile?.emergencyContactName}
                  />
                  <DetailRow
                    label="Emergency Phone"
                    value={profile?.emergencyContactPhone}
                  />
                  <DetailRow label="Blood Group" value={profile?.bloodGroup} />
                  <DetailRow
                    label="Medical Conditions"
                    value={profile?.medicalConditions}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Profile Reference</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <UserRound className="h-4 w-4" />
              Full Name
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {user.firstName} {user.lastName}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <Phone className="h-4 w-4" />
              Emergency Phone
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {profile?.emergencyContactPhone || "-"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <CalendarDays className="h-4 w-4" />
              Date of Birth
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {profile?.dateOfBirth ? formatDate(profile.dateOfBirth) : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <MapPin className="h-4 w-4" />
              Address
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {profile?.address || "-"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <BadgeInfo className="h-4 w-4" />
              National ID
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {profile?.nationalId || "-"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <HeartPulse className="h-4 w-4" />
              Blood Group
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {profile?.bloodGroup || "-"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
