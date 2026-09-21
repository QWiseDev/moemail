import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"

export async function requireAuditPermission() {
  const allowed = await checkPermission(PERMISSIONS.PROMOTE_USER)
  return allowed
    ? null
    : Response.json({ error: "权限不足" }, { status: 403 })
}

export const toTimestamp = (date?: Date | null) => date?.getTime() ?? null
