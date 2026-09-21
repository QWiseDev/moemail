import { eq, inArray, like, or, sql } from "drizzle-orm"
import { requireAuditPermission, toTimestamp } from "@/lib/admin-audit"
import { createDb } from "@/lib/db"
import { accounts, emails, messages, roles, userRoles, users } from "@/lib/schema"

export const runtime = "edge"

export async function GET(request: Request) {
  const permissionError = await requireAuditPermission()
  if (permissionError) return permissionError

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") || "1"))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || "20")))
    const search = searchParams.get("search")?.trim()
    const db = createDb()
    const searchPattern = search ? `%${search}%` : null
    const searchCondition = searchPattern
      ? or(
          like(users.username, searchPattern),
          like(users.email, searchPattern),
          like(users.name, searchPattern),
          sql`EXISTS (
            SELECT 1 FROM ${emails}
            WHERE ${emails.userId} = ${users.id}
              AND ${emails.address} LIKE ${searchPattern}
          )`
        )
      : undefined

    const [totalResult, userList] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(searchCondition),
      db.select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        role: roles.name,
      }).from(users)
        .leftJoin(userRoles, eq(userRoles.userId, users.id))
        .leftJoin(roles, eq(roles.id, userRoles.roleId))
        .where(searchCondition)
        .orderBy(sql`LOWER(COALESCE(${users.username}, ${users.name}, ${users.email}, ${users.id}))`)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ])

    const userIds = userList.map(user => user.id)
    const [accountList, emailCounts, messageCounts] = userIds.length
      ? await Promise.all([
          db.select({ userId: accounts.userId, provider: accounts.provider })
            .from(accounts)
            .where(inArray(accounts.userId, userIds)),
          db.select({
            userId: emails.userId,
            count: sql<number>`count(*)`,
          }).from(emails)
            .where(inArray(emails.userId, userIds))
            .groupBy(emails.userId),
          db.select({
            userId: emails.userId,
            count: sql<number>`count(${messages.id})`,
          }).from(emails)
            .leftJoin(messages, eq(messages.emailId, emails.id))
            .where(inArray(emails.userId, userIds))
            .groupBy(emails.userId),
        ])
      : [[], [], []]

    const providersByUser = new Map<string, string[]>()
    accountList.forEach((account) => {
      const providers = providersByUser.get(account.userId) ?? []
      providers.push(account.provider)
      providersByUser.set(account.userId, providers)
    })
    const emailCountByUser = new Map(
      emailCounts.filter(item => item.userId).map(item => [item.userId!, Number(item.count)])
    )
    const messageCountByUser = new Map(
      messageCounts.filter(item => item.userId).map(item => [item.userId!, Number(item.count)])
    )

    return Response.json({
      users: userList.map(user => ({
        ...user,
        emailVerified: toTimestamp(user.emailVerified),
        role: user.role ?? null,
        providers: providersByUser.get(user.id) ?? [],
        emailCount: emailCountByUser.get(user.id) ?? 0,
        messageCount: messageCountByUser.get(user.id) ?? 0,
      })),
      total: Number(totalResult[0]?.count ?? 0),
      page,
      pageSize,
    })
  } catch (error) {
    console.error("Failed to list audit users:", error)
    return Response.json({ error: "加载用户列表失败" }, { status: 500 })
  }
}
