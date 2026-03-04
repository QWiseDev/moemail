import { NextResponse } from "next/server"
import { and, eq, inArray } from "drizzle-orm"
import { createDb } from "@/lib/db"
import { emails, messages } from "@/lib/schema"
import { getUserId } from "@/lib/apiKey"

export const runtime = "edge"

interface BatchDeleteBody {
  ids?: string[]
}

export async function DELETE(request: Request) {
  const userId = await getUserId()

  try {
    const body = await request.json() as BatchDeleteBody
    const ids = Array.from(new Set((body.ids || []).filter(Boolean)))

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "请提供要删除的邮箱 ID" },
        { status: 400 }
      )
    }

    const db = createDb()
    const ownedEmails = await db.select({ id: emails.id })
      .from(emails)
      .where(and(
        eq(emails.userId, userId!),
        inArray(emails.id, ids)
      ))

    const ownedIds = ownedEmails.map(item => item.id)
    if (ownedIds.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 })
    }

    await db.delete(messages)
      .where(inArray(messages.emailId, ownedIds))

    await db.delete(emails)
      .where(and(
        eq(emails.userId, userId!),
        inArray(emails.id, ownedIds)
      ))

    return NextResponse.json({
      success: true,
      deletedCount: ownedIds.length
    })
  } catch (error) {
    console.error("Failed to batch delete emails:", error)
    return NextResponse.json(
      { error: "批量删除邮箱失败" },
      { status: 500 }
    )
  }
}
