import { and, eq } from "drizzle-orm"
import { requireAuditPermission, toTimestamp } from "@/lib/admin-audit"
import { createDb } from "@/lib/db"
import { messages } from "@/lib/schema"

export const runtime = "edge"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ emailId: string; messageId: string }> }
) {
  const permissionError = await requireAuditPermission()
  if (permissionError) return permissionError

  try {
    const { emailId, messageId } = await params
    const db = createDb()
    const message = await db.query.messages.findFirst({
      where: and(
        eq(messages.emailId, emailId),
        eq(messages.id, messageId)
      ),
    })

    if (!message) {
      return Response.json({ error: "邮件不存在" }, { status: 404 })
    }

    return Response.json({
      message: {
        id: message.id,
        fromAddress: message.fromAddress,
        toAddress: message.toAddress,
        subject: message.subject,
        content: message.content,
        html: message.html,
        type: message.type,
        receivedAt: toTimestamp(message.receivedAt),
        sentAt: toTimestamp(message.sentAt),
      },
    })
  } catch (error) {
    console.error("Failed to load audit message:", error)
    return Response.json({ error: "加载邮件正文失败" }, { status: 500 })
  }
}
