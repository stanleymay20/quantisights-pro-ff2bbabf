import { type Permission, usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders children only if the current user has the specified permission */
export const PermissionGate = ({ permission, children, fallback = null }: PermissionGateProps) => {
  const { hasPermission, isLoading } = usePermissions();
  if (isLoading) return null;
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGate;
