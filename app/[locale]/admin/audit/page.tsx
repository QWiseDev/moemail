import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { MailAuditDashboard } from "@/components/audit/mail-audit-dashboard"
import type { Locale } from "@/i18n/config"
import { auth } from "@/lib/auth"
import { hasPermission, PERMISSIONS, type Role } from "@/lib/permissions"

export const runtime = "edge"

export default async function AuditPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: localeFromParams } = await params
  const locale = localeFromParams as Locale
  const session = await auth()

  if (!session?.user) {
    redirect(`/${locale}`)
  }

  const roles = session.user.roles?.map(role => role.name as Role) ?? []
  if (!hasPermission(roles, PERMISSIONS.PROMOTE_USER)) {
    redirect(`/${locale}/profile`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto max-w-[1800px] px-4 lg:px-8">
        <Header />
        <main className="pb-8 pt-20">
          <MailAuditDashboard />
        </main>
      </div>
    </div>
  )
}
