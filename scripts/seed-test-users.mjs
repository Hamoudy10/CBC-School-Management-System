import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_PASSWORD = "Test@12345";
const DEFAULT_DOMAIN = "demo.local";

const ROLE_NAMES = [
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "teacher",
  "class_teacher",
  "subject_teacher",
  "finance_officer",
  "bursar",
  "parent",
  "student",
  "librarian",
  "ict_admin",
];

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (!key || process.env[key]) continue;
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function titleCaseRole(roleName) {
  return roleName
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

async function findAuthUserIdByEmail(supabase, email) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const match = data.users.find((user) => user.email === email);
  return match ? match.id : null;
}

async function ensureProfile(supabase, userId, schoolId) {
  if (!schoolId) return;
  const { error } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        school_id: schoolId,
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

async function ensureUser({
  supabase,
  roleName,
  roleId,
  schoolId,
  email,
  password,
  firstName,
  lastName,
}) {
  const { data: existingRows, error: existingError } = await supabase
    .from("users")
    .select("user_id, role_id, school_id")
    .eq("email", email)
    .limit(1);

  if (existingError) throw existingError;

  if (existingRows && existingRows.length > 0) {
    const existing = existingRows[0];
    const needsUpdate =
      existing.role_id !== roleId || existing.school_id !== schoolId;
    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          role_id: roleId,
          school_id: schoolId,
          status: "active",
          email_verified: true,
        })
        .eq("user_id", existing.user_id);
      if (updateError) throw updateError;
    }

    await supabase.auth.admin.updateUserById(existing.user_id, {
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    await ensureProfile(supabase, existing.user_id, schoolId);
    return { status: needsUpdate ? "updated" : "skipped", userId: existing.user_id };
  }

  let authUserId = null;
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

  if (authError) {
    if (authError.message?.toLowerCase().includes("already")) {
      authUserId = await findAuthUserIdByEmail(supabase, email);
      if (!authUserId) throw authError;
    } else {
      throw authError;
    }
  } else {
    authUserId = authData?.user?.id ?? null;
  }

  if (!authUserId) {
    throw new Error(`Unable to resolve auth user id for ${email}`);
  }

  const { error: profileError } = await supabase.from("users").insert({
    user_id: authUserId,
    school_id: schoolId,
    role_id: roleId,
    email,
    first_name: firstName,
    last_name: lastName,
    status: "active",
    email_verified: true,
  });

  if (profileError) throw profileError;

  await ensureProfile(supabase, authUserId, schoolId);

  return { status: "created", userId: authUserId };
}

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.TEST_USER_PASSWORD || DEFAULT_PASSWORD;
  const domain = process.env.TEST_USER_EMAIL_DOMAIN || DEFAULT_DOMAIN;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roles, error: rolesError } = await supabase
    .from("roles")
    .select("role_id, name");
  if (rolesError) throw rolesError;

  const roleByName = new Map();
  for (const role of roles || []) {
    roleByName.set(role.name, role.role_id);
  }

  const { data: schoolUserRows } = await supabase
    .from("users")
    .select("school_id")
    .not("school_id", "is", null)
    .limit(1);

  let schoolId = schoolUserRows?.[0]?.school_id ?? null;
  if (!schoolId) {
    const { data: schoolRows } = await supabase
      .from("schools")
      .select("school_id")
      .limit(1);
    schoolId = schoolRows?.[0]?.school_id ?? null;
  }

  if (!schoolId) {
    throw new Error("No school found. Seed at least one school first.");
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("users")
    .select("school_id, roles (name)")
    .limit(5000);
  if (existingError) throw existingError;

  const existingSchoolRoles = new Set();
  let hasSuperAdmin = false;
  for (const row of existingRows || []) {
    const roleName = row.roles?.name;
    if (!roleName) continue;
    if (roleName === "super_admin") {
      hasSuperAdmin = true;
    }
    if (row.school_id === schoolId) {
      existingSchoolRoles.add(roleName);
    }
  }

  const results = [];

  for (const roleName of ROLE_NAMES) {
    const roleId = roleByName.get(roleName);
    if (!roleId) {
      results.push({
        roleName,
        status: "missing-role",
        email: null,
      });
      continue;
    }

    if (roleName === "super_admin") {
      if (hasSuperAdmin) {
        results.push({
          roleName,
          status: "skipped-existing",
          email: null,
        });
        continue;
      }
    } else if (existingSchoolRoles.has(roleName)) {
      results.push({
        roleName,
        status: "skipped-existing",
        email: null,
      });
      continue;
    }

    const email = `test.${roleName.replace(/_/g, ".")}@${domain}`;
    const display = titleCaseRole(roleName);
    const firstName = display.split(" ")[0] || "Test";
    const lastName = display.split(" ").slice(1).join(" ") || "User";
    const resolvedSchoolId = roleName === "super_admin" ? null : schoolId;

    const result = await ensureUser({
      supabase,
      roleName,
      roleId,
      schoolId: resolvedSchoolId,
      email,
      password,
      firstName,
      lastName,
    });

    results.push({ roleName, email, status: result.status });
  }

  console.log("Seeded test users:");
  for (const row of results) {
    console.log(
      `- ${row.roleName}: ${row.status}${row.email ? ` (${row.email})` : ""}`,
    );
  }

  console.log("");
  console.log("Password:", password);
  console.log("School ID:", schoolId);
}

main().catch((error) => {
  console.error("Seed failed:", error?.message || error);
  process.exit(1);
});
