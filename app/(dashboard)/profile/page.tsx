"use client";

import { useEffect, useState } from "react";
import {
  BadgeInfo,
  CalendarDays,
  Camera,
  Edit3,
  HeartPulse,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatDate, cn } from "@/lib/utils";

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();
  const [editForm, setEditForm] = useState({
    dateOfBirth: "",
    address: "",
    nationalId: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    bloodGroup: "",
    medicalConditions: "",
    photoUrl: "",
  });

  // Load profile data
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

  // ── Edit Handlers ─────────────────────────────────────────
  const openEdit = () => {
    setEditForm({
      dateOfBirth: profile?.dateOfBirth || "",
      address: profile?.address || "",
      nationalId: profile?.nationalId || "",
      emergencyContactName: profile?.emergencyContactName || "",
      emergencyContactPhone: profile?.emergencyContactPhone || "",
      bloodGroup: profile?.bloodGroup || "",
      medicalConditions: profile?.medicalConditions || "",
      photoUrl: profile?.photoUrl || "",
    });
    setIsEditOpen(true);
  };

  const handlePhotoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "users");
    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {throw new Error("Upload failed");}
    const data = await response.json();
    return data.url;
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {return;}
    if (file.size > 5 * 1024 * 1024) {
      toastError("File Too Large", "File must be less than 5MB");
      return;
    }
    try {
      const url = await handlePhotoUpload(file);
      setEditForm((prev) => ({ ...prev, photoUrl: url }));
    } catch {
      toastError("Upload Failed", "Could not upload photo");
    }
  };

  const saveEdit = async () => {
    if (!user?.id) {return;}
    setIsSaving(true);
    try {
      const response = await fetch(`/api/users/${user.id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {throw new Error(json?.message || "Failed to update profile");}
      setIsEditOpen(false);
      toastSuccess("Profile Updated", "Your profile has been updated.");
      // Reload profile
      setProfile(null);
      setIsLoadingProfile(true);
      const resp = await fetch(`/api/users/${user.id}/profile`, { credentials: "include" });
      const data = await resp.json();
      if (resp.ok) {setProfile(data.data || null);}
    } catch (err) {
      toastError("Update Failed", err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

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
        description="View and edit your account information and personal profile details."
      >
        <Button variant="secondary" onClick={openEdit}>
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
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

      {/* ── Edit Profile Modal ──────────────────────────────── */}
      <Modal open={isEditOpen} onClose={() => !isSaving && setIsEditOpen(false)} size="lg">
        <ModalHeader>
          <ModalTitle>Edit Profile</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {/* Photo */}
          <div className="flex flex-col items-center gap-3 pb-4">
            <div className="relative">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-gray-300 bg-gray-50">
                {editForm.photoUrl ? (
                  <img src={editForm.photoUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700">
                <Camera className="h-5 w-5" />
                <input type="file" accept="image/*" onChange={handlePhotoFile} className="hidden" />
              </label>
            </div>
            <p className="text-xs text-gray-500">Click to upload new photo</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Date of Birth"
              type="date"
              value={editForm.dateOfBirth}
              onChange={(e) => setEditForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
            />
            <Input
              label="Blood Group"
              value={editForm.bloodGroup}
              onChange={(e) => setEditForm((p) => ({ ...p, bloodGroup: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Address"
              value={editForm.address}
              onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
            />
            <Input
              label="National ID"
              value={editForm.nationalId}
              onChange={(e) => setEditForm((p) => ({ ...p, nationalId: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Emergency Contact Name"
              value={editForm.emergencyContactName}
              onChange={(e) => setEditForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
            />
            <Input
              label="Emergency Contact Phone"
              value={editForm.emergencyContactPhone}
              onChange={(e) => setEditForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Medical Conditions</label>
            <textarea
              rows={3}
              value={editForm.medicalConditions}
              onChange={(e) => setEditForm((p) => ({ ...p, medicalConditions: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={saveEdit} loading={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
