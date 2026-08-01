// Canonical source-identity envelope. Every ingestion path (file upload
// today; connectors, documents, streams in later phases) must be able to
// populate this, so downstream code can treat "where did this data come
// from" uniformly instead of each pipeline inventing its own subset.
import { z } from "zod";
import {
  DatasetIdSchema,
  IngestionRunIdSchema,
  OrganizationIdSchema,
  ProjectIdSchema,
  SourceIdSchema,
  WorkspaceIdSchema,
} from "./ids";

export const SourceTypeSchema = z.enum([
  "csv_upload",
  "workbook_upload",
  "connector_pull",
  "api_push",
  "document_upload", // reserved for a future phase; not produced by any adapter yet
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ProcessingStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
  "awaiting_review",
]);
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;

export const SourceIdentitySchema = z.object({
  organizationId: OrganizationIdSchema,
  workspaceId: WorkspaceIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  datasetId: DatasetIdSchema.optional(),
  sourceId: SourceIdSchema,
  ingestionRunId: IngestionRunIdSchema,
  sourceType: SourceTypeSchema,
  filenameOrSourceIdentifier: z.string().min(1),
  mimeType: z.string().optional(),
  extension: z.string().optional(),
  byteSize: z.number().int().nonnegative().optional(),
  checksum: z.string().min(1),
  ingestionTimestamp: z.string().datetime(),
  sourceTimestamp: z.string().datetime().optional(),
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  // Reference (e.g. Storage bucket path), not the raw bytes themselves --
  // this contract never carries file content, only where to find it.
  rawStorageReference: z.string().optional(),
  processingStatus: ProcessingStatusSchema,
  warnings: z.array(z.string()).default([]),
});
export type SourceIdentity = z.infer<typeof SourceIdentitySchema>;
