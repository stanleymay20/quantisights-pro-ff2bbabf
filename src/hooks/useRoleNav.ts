/**
 * useRoleNav
 *
 * Returns the set of top-level sidebar paths visible to the current user
 * based on their org role.
 *
 * Sprint A — Sidebar IA collapse: 5 primary items
 *   Home · Copilot · Decisions · Outcomes · Workspace
 *
 * Power-user routes live in the "Advanced" drawer (gated separately in
 * DashboardSidebar by role).
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

/** 5 primary sidebar paths (post-IA-collapse) */
const ALL_PATHS = new Set([
  "/dashboard",
  "/copilot",
  "/decisions",
  "/outcomes",
  "/settings", // Workspace section anchors on /settings
]);

const ROLE_PATHS: Record<NonNullable<Exclude<OrgRole, null | undefined>>, Set<string>> = {
  owner: ALL_PATHS,
  admin: ALL_PATHS,
  executive: ALL_PATHS,
  analyst: ALL_PATHS,
  steward: ALL_PATHS,
  viewer: new Set([
    "/dashboard",
    "/copilot",
    "/decisions",
    "/outcomes",
    "/settings",
  ]),
};

export function getAllowedPaths(role: OrgRole): Set<string> {
  if (!role) return ALL_PATHS;
  return ROLE_PATHS[role] ?? ALL_PATHS;
}

export function useRoleNav(orgRole: OrgRole): Set<string> {
  return getAllowedPaths(orgRole);
}
