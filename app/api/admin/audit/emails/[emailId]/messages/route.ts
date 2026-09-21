import { and, desc, eq, lt, or } from "drizzle-orm"
import { requireAuditPermission, toTimestamp } from "@/lib/admin-audit"
import { createDb } from "@/lib/db"
import { messages } from "@/lib/schema"

export const runtime = "edge"

const PAGE_SIZE = 20

function encodeCursor(timestamp: number, id: string) {
  return `${timestamp}:${id}`
}

function decodeCursor(cursor: string) {
  const separatorIndex = cursor.indexOf(":")
  const timestamp = Number(cursor.slice(0, separatorIndex))
  const id = cursor.slice(separatorIndex + 1)

  if (separatorIndex < 1 || !Number.isFinite(timestamp) || !id) {
    throw new Error("Invalid cursor")
  }

  return { timestamp, id }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> }
) {
  const permissionError = await requireAuditPermission()
  if (permissionError) return permissionError

  try {
    const { emailId } = await params
    const cursorValue = new URL(request.url).searchParams.get("cursor")
    const conditions = [eq(messages.emailId, emailId)]

    if (cursorValue) {
      const cursor = decodeCursor(cursorValue)
      const cursorTime = new Date(cursor.timestamp)
      conditions.push(
        or(
          lt(messages.receivedAt, cursorTime),
          and(
            eq(messages.receivedAt, cursorTime),
            lt(messages.id, cursor.id)
          )
        )!
      )
    }

    const db = createDb()
    const results = await db.select({
      id: messages.id,
      fromAddress: messages.fromAddress,
      toAddress: messages.toAddress,
      subject: messages.subject,
      type: messages.type,
      receivedAt: messages.receivedAt,
      sentAt: messages.sentAt,
    }).from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.receivedAt), desc(messages.id))
      .limit(PAGE_SIZE + 1)

    const hasMore = results.length > PAGE_SIZE
    const page = hasMore ? results.slice(0, PAGE_SIZE) : results
    const lastMessage = page[page.length - 1]

    return Response.json({
      messages: page.map(message => ({
        id: message.id,
        fromAddress: message.fromAddress,
        toAddress: message.toAddress,
        subject: message.subject,
        type: message.type,
        receivedAt: toTimestamp(message.receivedAt),
        sentAt: toTimestamp(message.sentAt),
      })),
      nextCursor: hasMore && lastMessage
        ? encodeCursor(lastMessage.receivedAt.getTime(), lastMessage.id)
        : null,
    })
  } catch (error) {
    console.error("Failed to load audit messages:", error)
    return Response.json({ error: "加载邮件列表失败" }, { status: 500 })
  }
}
