// Canonical identity types shared across every ingestion contract.
//
// Branded so a raw string can't be passed where a specific ID kind is
// expected -- a `WorkspaceId` and a `DatasetId` are both UUIDs at runtime,
// but mixing them up in a persistence call is exactly the kind of bug this
// phase exists to make structurally harder, not just documentally implied.
import { z } from "zod";

const uuidLike = z.string().min(1, "id must not be empty");

function brand<Brand extends string>(brand: Brand) {
  return uuidLike.brand<Brand>();
}

export const OrganizationIdSchema = brand("OrganizationId");
export const WorkspaceIdSchema = brand("WorkspaceId");
export const ProjectIdSchema = brand("ProjectId");
export const DatasetIdSchema = brand("DatasetId");
export const SourceIdSchema = brand("SourceId");
export const IngestionRunIdSchema = brand("IngestionRunId");

export type OrganizationId = z.infer<typeof OrganizationIdSchema>;
export type WorkspaceId = z.infer<typeof WorkspaceIdSchema>;
export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type DatasetId = z.infer<typeof DatasetIdSchema>;
export type SourceId = z.infer<typeof SourceIdSchema>;
export type IngestionRunId = z.infer<typeof IngestionRunIdSchema>;

export const asOrganizationId = (v: string): OrganizationId => OrganizationIdSchema.parse(v);
export const asWorkspaceId = (v: string): WorkspaceId => WorkspaceIdSchema.parse(v);
export const asProjectId = (v: string): ProjectId => ProjectIdSchema.parse(v);
export const asDatasetId = (v: string): DatasetId => DatasetIdSchema.parse(v);
export const asSourceId = (v: string): SourceId => SourceIdSchema.parse(v);
export const asIngestionRunId = (v: string): IngestionRunId => IngestionRunIdSchema.parse(v);
