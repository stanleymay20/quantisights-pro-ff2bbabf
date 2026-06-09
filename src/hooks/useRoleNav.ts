/**
 * useRoleNav
 *
 * Returns the set of top-level sidebar paths visible to the current user
 * based on their org role. Sub-pages within a section are always shown
 * when the section itself is visible.
 *
 * Phase 4 — IA v1.1 Section 5: Role-Based Navigation.
 *
 * Role mapping (from DB org_role enum):
 *   owner / admin  → Admin profile — all 9 sections visible
 *   executive      → CEO/COO profile — operational sections, no raw data sub-pages
 *   analyst        → Analyst profile — data + reports focus
 *   steward        → Data steward — data + governance focus
 *   viewer         → Read-only — home + decisions + reports only
 *
 * The hook returns a Set<string> of allowed top-level paths.
 * An empty set means no restriction (show everything — used for unknown roles).
 */

export type OrgRole =
  | "owner"
  | "admin"
  | "executive"
  | "analyst"
  | "viewer"
  | "steward"
  | null
  | undefined;

/** All 9 top-level sidebar paths */
const ALL_PATHS = new Set([
  "/dashboard",
  "/copilot",
  "/decisions",
  "/executive-intelligence",
  "/reports",
  "/data-upload",
  "/governance",
  "/team",
  "/settings",
]);

/**
 * Paths visible per role.
 * owner/admin get ALL_PATHS — no restriction.
 */
const ROLE_PATHS: Record<NonNullable<Exclude<OrgRole, null | undefined>>, Set<string>> = {
  owner: ALL_PATHS,
  admin: ALL_PATHS,

  executive: new Set([
    "/dashboard",
    "/copilot",
    "/decisions",
    "/executive-intelligence",
    "/reports",
    "/governance",
    "/settings",
    // Team visible so executives can see who's who
    "/team",
  ]),

  analyst: new Set([
    "/dashboard",
    "/copilot",
    "/decisions",
    "/reports",
    "/data-upload",
    "/executive-intelligence",
    "/settings",
  ]),

  steward: new Set([
    "/dashboard",
    "/copilot",
    "/decisions",
    "/data-upload",
    "/governance",
    "/settings",
  ]),

  viewer: new Set([
    "/dashboard",
    "/copilot",
    "/decisions",
    "/reports",
    "/settings",
  ]),
};

/**
 * Returns the set of allowed top-level sidebar paths for a given role.
 * Returns ALL_PATHS for unknown/null roles (no restriction).
 */
export function getAllowedPaths(role: OrgRole): Set<string> {
  if (!role) return ALL_PATHS;
  return ROLE_PATHS[role] ?? ALL_PATHS;
}

/**
 * Hook — returns allowed paths for the current user's org role.
 * Pass orgRole from usePermissions().
 */
export function useRoleNav(orgRole: OrgRole): Set<string> {
  return getAllowedPaths(orgRole);
}
