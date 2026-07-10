// @ts-nocheck
// GA-3: HTTP verification endpoint for cryptographically signed artifacts
// (decision tokens, runtime acknowledgements, Evidence Pack manifests).
//
// This endpoint only ever VERIFIES — it resolves PUBLIC key material from
// `signing_keys` and checks a signature against it. It never accepts,
// stores, or returns private key material, and it never signs anything.
//
// DEPLOYMENT STATUS: implemented and self-contained, but NOT validated
// against a live Supabase project in this session (no deployable target
// was available) — mark live-deployment validation BLOCKED until run
// against a real project, same as the GA-2R validation gate.
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { applyRateLimit, getClientIp } from "../_shared/rate-guard.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { base64UrlToBuffer } from "@/lib/key-management.ts";
import {
  KeyProviderNotImplementedError,
  type KeyProvider,
  type SigningKeyMetadata,
} from "@/lib/key-management-types.ts";
import { SIGNING_ALGORITHM, SIGNING_PURPOSES, type SigningPurpose } from "@/lib/crypto-signing-types.ts";
import { createVerificationService } from "@/lib/signature-verification.ts";

const MAX_REQUEST_BYTES = 65_536;

const RequestSchema = z.object({
  artifact: z.record(z.unknown()),
  expected_purpose: z.enum(SIGNING_PURPOSES),
  expected_tenant_id: z.string().min(1).max(256).optional(),
  expected_organization_id: z.string().min(1).max(256).optional(),
  environment: z.string().min(1).max(128).optional(),
});

/**
 * Read-only KeyProvider backed by the `signing_keys` table (GA-3 migration
 * 20260710180000_ga3_signing_keys.sql). Only ever reads PUBLIC key
 * material; every method that would touch private key bytes throws
 * KeyProviderNotImplementedError, matching the KmsKeyProviderScaffold
 * pattern used elsewhere in GA-3 — this table never stores raw private keys.
 */
class SupabaseVerificationKeyProvider implements KeyProvider {
  constructor(
    public readonly environment: string,
    private readonly supabase: ReturnType<typeof createClient>,
  ) {}

  async getActiveSigningKey(purpose: SigningPurpose): Promise<SigningKeyMetadata | null> {
    const { data } = await this.supabase
      .from("signing_keys")
      .select("*")
      .eq("purpose", purpose)
      .eq("environment", this.environment)
      .eq("status", "ACTIVE")
      .maybeSingle();
    return data ? rowToMetadata(data) : null;
  }

  async getVerificationKey(key_id: string): Promise<SigningKeyMetadata | null> {
    const { data } = await this.supabase.from("signing_keys").select("*").eq("key_id", key_id).maybeSingle();
    return data ? rowToMetadata(data) : null;
  }

  async listVerificationKeys(purpose?: SigningPurpose): Promise<SigningKeyMetadata[]> {
    let query = this.supabase.from("signing_keys").select("*").neq("status", "PENDING");
    if (purpose) query = query.eq("purpose", purpose);
    const { data } = await query;
    return (data ?? []).map(rowToMetadata);
  }

  async signWithKey(): Promise<Uint8Array> {
    throw new KeyProviderNotImplementedError("SupabaseVerificationKeyProvider.signWithKey");
  }

  async verifyWithKey(key_id: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    const metadata = await this.getVerificationKey(key_id);
    if (!metadata) return false;
    if (metadata.algorithm !== SIGNING_ALGORITHM) return false;
    try {
      const publicKey = await crypto.subtle.importKey(
        "spki",
        base64UrlToBuffer(metadata.public_key),
        { name: SIGNING_ALGORITHM },
        true,
        ["verify"],
      );
      return await crypto.subtle.verify({ name: SIGNING_ALGORITHM }, publicKey, signature as BufferSource, data as BufferSource);
    } catch {
      return false;
    }
  }

  async rotateSigningKey(): Promise<SigningKeyMetadata> {
    throw new KeyProviderNotImplementedError("SupabaseVerificationKeyProvider.rotateSigningKey");
  }

  async revokeSigningKey(): Promise<SigningKeyMetadata> {
    throw new KeyProviderNotImplementedError("SupabaseVerificationKeyProvider.revokeSigningKey");
  }

  async isKeyValidAt(key_id: string, at: string): Promise<boolean> {
    const metadata = await this.getVerificationKey(key_id);
    if (!metadata) return false;
    if (metadata.status === "REVOKED" || metadata.status === "PENDING" || metadata.status === "EXPIRED") return false;
    if (metadata.activated_at === null || at < metadata.activated_at) return false;
    if (metadata.expires_at !== null && at > metadata.expires_at) return false;
    return true;
  }
}

function rowToMetadata(row: Record<string, unknown>): SigningKeyMetadata {
  return {
    key_id: row.key_id as string,
    purpose: row.purpose as SigningPurpose,
    algorithm: row.algorithm as typeof SIGNING_ALGORITHM,
    status: row.status as SigningKeyMetadata["status"],
    public_key: row.public_key as string,
    environment: row.environment as string,
    created_at: row.created_at as string,
    activated_at: (row.activated_at as string | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    retired_at: (row.retired_at as string | null) ?? null,
    revoked_at: (row.revoked_at as string | null) ?? null,
    revocation_reason: (row.revocation_reason as string | null) ?? null,
    rotation_parent_key_id: (row.rotation_parent_key_id as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  const rateLimited = applyRateLimit(req, clientIp, "public", "verify-signed-artifact");
  if (rateLimited) return rateLimited;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return new Response(JSON.stringify({ error: "request_too_large" }), { status: 413, headers: corsHeaders });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "malformed_request_body" }), { status: 400, headers: corsHeaders });
  }
  if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
    return new Response(JSON.stringify({ error: "request_too_large" }), { status: 413, headers: corsHeaders });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "malformed_request_body" }), { status: 400, headers: corsHeaders });
  }

  const parsedRequest = RequestSchema.safeParse(parsedBody);
  if (!parsedRequest.success) {
    return new Response(
      JSON.stringify({ error: "invalid_request", details: parsedRequest.error.issues.map((issue) => issue.message) }),
      { status: 400, headers: corsHeaders },
    );
  }

  const { artifact, expected_purpose, expected_tenant_id, expected_organization_id, environment } = parsedRequest.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const keyProvider = new SupabaseVerificationKeyProvider(environment ?? "production", supabase);
  const verificationService = createVerificationService({ keyProvider });

  try {
    const result = await verificationService.verifySignedEnvelope(artifact, {
      expected_purpose,
      expected_tenant_id,
      expected_organization_id,
    });
    // VerificationResult never carries private key material by construction
    // (signature-verification.ts only ever reads SigningKeyMetadata, which
    // is public-key-only) — safe to return directly.
    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
  } catch (error) {
    // Never leak internal error detail (e.g. DB connection strings) to the caller.
    console.error("verify-signed-artifact: unexpected verification failure", error);
    return new Response(JSON.stringify({ error: "verification_failed" }), { status: 500, headers: corsHeaders });
  }
});
