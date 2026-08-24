import { z } from "zod";

export const mediaProviderSchema = z.enum(["filejump", "supabase"]);

export const mediaAssetUpdateSchema = z.object({
  display_name: z.string().trim().min(1).max(255),
  alt_text: z.string().trim().max(500).default(""),
});

export const mediaAssetSchema = z.object({
  id: z.string().uuid(),
  provider: mediaProviderSchema,
  provider_file_id: z.string().min(1),
  provider_folder_id: z.string().nullable(),
  file_name: z.string().min(1),
  display_name: z.string(),
  url: z.string().url(),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().nonnegative(),
  alt_text: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type MediaAssetUpdate = z.infer<typeof mediaAssetUpdateSchema>;
