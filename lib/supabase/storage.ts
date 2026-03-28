import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET || "school-assets";

export async function ensureStorageBucket() {
  const adminClient = await createSupabaseAdminClient();
  const { data, error } = await adminClient.storage.getBucket(STORAGE_BUCKET);

  if (!error && data) {
    return { success: true as const, client: adminClient };
  }

  const missingBucket =
    !data &&
    (!error ||
      /not found/i.test(error.message) ||
      /does not exist/i.test(error.message));

  if (!missingBucket) {
    return {
      success: false as const,
      message: error?.message || "Failed to inspect storage bucket",
    };
  }

  const { error: createError } = await adminClient.storage.createBucket(
    STORAGE_BUCKET,
    {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
    },
  );

  if (
    createError &&
    !/already exists/i.test(createError.message) &&
    !/duplicate/i.test(createError.message)
  ) {
    return {
      success: false as const,
      message: createError.message,
    };
  }

  return { success: true as const, client: adminClient };
}
