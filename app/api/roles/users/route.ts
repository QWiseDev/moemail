import { createDb } from "@/lib/db"
import { accounts, emails, messages, users } from "@/lib/schema"
import { PERMISSIONS } from "@/lib/permissions"
import { checkPermission } from "@/lib/auth"
import { eq, inArray, or, sql } from "drizzle-orm"

export const runtime = "edge"

type Db = ReturnType<typeof createDb>

async function findUserBySearch(db: Db, searchText: string) {
  const user = await db.query.users.findFirst({
    where: or(eq(users.email, searchText), eq(users.username, searchText)),
    with: {
      userRoles: {
        with: {
          role: true
        }
      }
    }
  })

  if (user) return user

  const email = await db.query.emails.findFirst({
    where: eq(emails.address, searchText)
  })

  if (!email?.userId) return null

  return db.query.users.findFirst({
    where: eq(users.id, email.userId),
    with: {
      userRoles: {
        with: {
          role: true
        }
      }
    }
  })
}

const toTimestamp = (date?: Date | null) => date?.getTime() ?? null

async function requirePromotePermission() {
  const canPromote = await checkPermission(PERMISSIONS.PROMOTE_USER)

  if (!canPromote) {
    return Response.json({ error: "权限不足" }, { status: 403 })
  }

  return null
}

export async function GET() {
  try {
    const permissionError = await requirePromotePermission()
    if (permissionError) return permissionError

    const db = createDb()
    const [userList, accountList, emailCounts, messageCounts] = await Promise.all([
      db.query.users.findMany({
        orderBy: (users, { asc }) => [
          asc(users.username),
          asc(users.email),
          asc(users.id)
        ],
        with: {
          userRoles: {
            with: {
              role: true
            }
          }
        }
      }),
      db.query.accounts.findMany(),
      db.select({
        userId: emails.userId,
        count: sql<number>`count(*)`
      }).from(emails).groupBy(emails.userId),
      db.select({
        userId: emails.userId,
        count: sql<number>`count(${messages.id})`
      }).from(emails)
        .leftJoin(messages, eq(messages.emailId, emails.id))
        .groupBy(emails.userId)
    ])

    const providersByUser = new Map<string, string[]>()
    accountList.forEach((account) => {
      const providers = providersByUser.get(account.userId) ?? []
      providers.push(account.provider)
      providersByUser.set(account.userId, providers)
    })

    const emailCountByUser = new Map(
      emailCounts
        .filter((item) => item.userId)
        .map((item) => [item.userId!, Number(item.count)])
    )
    const messageCountByUser = new Map(
      messageCounts
        .filter((item) => item.userId)
        .map((item) => [item.userId!, Number(item.count)])
    )

    return Response.json({
      users: userList.map(user => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: toTimestamp(user.emailVerified),
        image: user.image,
        role: user.userRoles[0]?.role.name,
        roles: user.userRoles.map(userRole => userRole.role.name),
        providers: providersByUser.get(user.id) ?? [],
        emailCount: emailCountByUser.get(user.id) ?? 0,
        messageCount: messageCountByUser.get(user.id) ?? 0
      }))
    })
  } catch (error) {
    console.error("Failed to list users:", error)
    return Response.json(
      { error: "查询用户列表失败" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { searchText: rawSearchText, userId } = json as { searchText?: string; userId?: string }
    const searchText = rawSearchText?.trim()
    const targetUserId = userId?.trim()

    if (!searchText && !targetUserId) {
      return Response.json({ error: "请提供用户名或邮箱地址" }, { status: 400 })
    }

    const permissionError = await requirePromotePermission()
    if (permissionError) return permissionError

    const db = createDb()

    const user = targetUserId
      ? await db.query.users.findFirst({
          where: eq(users.id, targetUserId),
          with: {
            userRoles: {
              with: {
                role: true
              }
            }
          }
        })
      : await findUserBySearch(db, searchText!)

    if (!user) {
      return Response.json({ error: "未找到用户" }, { status: 404 })
    }

    const userAccounts = await db.query.accounts.findMany({
      where: eq(accounts.userId, user.id)
    })
    const userEmails = await db.query.emails.findMany({
      where: eq(emails.userId, user.id),
      orderBy: (emails, { desc }) => [
        desc(emails.createdAt),
        desc(emails.id)
      ]
    })
    const userMessages = userEmails.length
      ? await db.query.messages.findMany({
          where: inArray(messages.emailId, userEmails.map(email => email.id)),
          orderBy: (messages, { desc }) => [
            desc(messages.receivedAt),
            desc(messages.sentAt),
            desc(messages.id)
          ]
        })
      : []
    type MessageRow = typeof userMessages[number]

    const messagesByEmail = new Map<string, MessageRow[]>()
    userMessages.forEach((message) => {
      const emailMessages = messagesByEmail.get(message.emailId) ?? []
      emailMessages.push(message)
      messagesByEmail.set(message.emailId, emailMessages)
    })

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: toTimestamp(user.emailVerified),
        image: user.image,
        role: user.userRoles[0]?.role.name,
        roles: user.userRoles.map(userRole => userRole.role.name),
        providers: userAccounts.map(account => account.provider),
        emails: userEmails.map(email => ({
          id: email.id,
          address: email.address,
          createdAt: toTimestamp(email.createdAt),
          expiresAt: toTimestamp(email.expiresAt),
          messages: (messagesByEmail.get(email.id) ?? []).map(message => ({
            id: message.id,
            from_address: message.fromAddress,
            to_address: message.toAddress,
            subject: message.subject,
            content: message.content,
            html: message.html,
            type: message.type,
            received_at: toTimestamp(message.receivedAt),
            sent_at: toTimestamp(message.sentAt)
          }))
        }))
      }
    })
  } catch (error) {
    console.error("Failed to find user:", error)
    return Response.json(
      { error: "查询用户失败" },
      { status: 500 }
    )
  }
}
