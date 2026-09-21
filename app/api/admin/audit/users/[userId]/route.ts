import { desc, eq, inArray, sql } from "drizzle-orm"
import { requireAuditPermission, toTimestamp } from "@/lib/admin-audit"
import { createDb } from "@/lib/db"
import { accounts, emails, messages, users } from "@/lib/schema"

export const runtime = "edge"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const permissionError = await requireAuditPermission()
  if (permissionError) return permissionError

  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") || "1"))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || "20")))
    const db = createDb()
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        userRoles: {
          with: { role: true },
        },
      },
    })

    if (!user) {
      return Response.json({ error: "用户不存在" }, { status: 404 })
    }

    const [userAccounts, totals, userEmails] = await Promise.all([
      db.select({ provider: accounts.provider })
        .from(accounts)
        .where(eq(accounts.userId, userId)),
      db.select({
        emailCount: sql<number>`count(DISTINCT ${emails.id})`,
        messageCount: sql<number>`count(${messages.id})`,
      }).from(emails)
        .leftJoin(messages, eq(messages.emailId, emails.id))
        .where(eq(emails.userId, userId)),
      db.select({
        id: emails.id,
        address: emails.address,
        createdAt: emails.createdAt,
        expiresAt: emails.expiresAt,
      }).from(emails)
        .where(eq(emails.userId, userId))
        .orderBy(desc(emails.createdAt), desc(emails.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ])

    const emailIds = userEmails.map(email => email.id)
    const emailMessageCounts = emailIds.length
      ? await db.select({
          emailId: messages.emailId,
          count: sql<number>`count(*)`,
        }).from(messages)
          .where(inArray(messages.emailId, emailIds))
          .groupBy(messages.emailId)
      : []
    const messageCountByEmail = new Map(
      emailMessageCounts.map(item => [item.emailId, Number(item.count)])
    )

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: toTimestamp(user.emailVerified),
        image: user.image,
        roles: user.userRoles.map(userRole => userRole.role.name),
        providers: userAccounts.map(account => account.provider),
        emailCount: Number(totals[0]?.emailCount ?? 0),
        messageCount: Number(totals[0]?.messageCount ?? 0),
      },
      emails: userEmails.map(email => ({
        id: email.id,
        address: email.address,
        createdAt: toTimestamp(email.createdAt),
        expiresAt: toTimestamp(email.expiresAt),
        messageCount: messageCountByEmail.get(email.id) ?? 0,
      })),
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Failed to load audit user:", error)
    return Response.json({ error: "加载用户审计信息失败" }, { status: 500 })
  }
}
