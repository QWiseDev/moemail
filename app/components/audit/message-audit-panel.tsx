"use client"

import type { SyntheticEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Inbox, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  AuditEmailSummary,
  AuditMessageDetails,
  AuditMessageResponse,
  AuditMessagesResponse,
  AuditMessageSummary,
} from "./types"

function formatDate(timestamp?: number | null) {
  return timestamp ? new Date(timestamp).toLocaleString() : "-"
}

function MessageRow({
  emailId,
  message,
}: {
  emailId: string
  message: AuditMessageSummary
}) {
  const t = useTranslations("audit")
  const [detail, setDetail] = useState<AuditMessageDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open || detail || loading) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/audit/emails/${encodeURIComponent(emailId)}/messages/${encodeURIComponent(message.id)}`
      )
      const data = await response.json().catch(() => null) as AuditMessageResponse | null
      if (!response.ok || !data?.message) {
        throw new Error(data?.error || t("loadMessageFailed"))
      }
      setDetail(data.message)
    } catch {
      setError(t("loadMessageFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <details
      onToggle={handleToggle}
      className="rounded-lg border border-border bg-background px-4 py-3"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{message.subject}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {message.fromAddress || message.toAddress || "-"}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <div>{message.type || t("received")}</div>
            <div>{formatDate(message.sentAt || message.receivedAt)}</div>
          </div>
        </div>
      </summary>

      <div className="mt-3 space-y-3 border-t pt-3 text-sm">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingMessage")}
          </div>
        )}
        {error && <p className="text-destructive">{error}</p>}
        {detail && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("from")}</dt>
                <dd className="mt-1 break-all">{detail.fromAddress || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("to")}</dt>
                <dd className="mt-1 break-all">{detail.toAddress || "-"}</dd>
              </div>
            </dl>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">{t("content")}</div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                {detail.content || "-"}
              </pre>
            </div>
            {detail.html && (
              <details>
                <summary className="cursor-pointer text-xs text-primary">{t("html")}</summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
                  {detail.html}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </details>
  )
}

export function MessageAuditPanel({ email }: { email: AuditEmailSummary | null }) {
  const t = useTranslations("audit")
  const [messages, setMessages] = useState<AuditMessageSummary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestController = useRef<AbortController | null>(null)

  const fetchMessages = useCallback(async (cursor?: string, append = false) => {
    if (!email) return

    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setMessages([])
      setNextCursor(null)
    }
    setError(null)

    try {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""
      const response = await fetch(
        `/api/admin/audit/emails/${encodeURIComponent(email.id)}/messages${query}`,
        { signal: controller.signal }
      )
      const data = await response.json().catch(() => null) as AuditMessagesResponse | null
      if (!response.ok || !data?.messages) {
        throw new Error(data?.error || t("loadMessagesFailed"))
      }

      const loadedMessages = data.messages
      setMessages(current => append ? [...current, ...loadedMessages] : loadedMessages)
      setNextCursor(data.nextCursor ?? null)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return
      setError(t("loadMessagesFailed"))
    } finally {
      if (requestController.current === controller) {
        requestController.current = null
        if (append) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    }
  }, [email, t])

  useEffect(() => {
    if (!email) {
      setMessages([])
      setNextCursor(null)
      setError(null)
      return
    }
    void fetchMessages()
    return () => requestController.current?.abort()
  }, [email, fetchMessages])

  return (
    <section className="min-h-[28rem] rounded-xl border bg-background p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-primary" />
            {t("messages")}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {email ? email.address : t("selectEmail")}
          </p>
        </div>
        {email && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
            {t("messageCount", { count: email.messageCount })}
          </span>
        )}
      </div>

      {!email ? (
        <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
          {t("selectEmail")}
        </div>
      ) : loading ? (
        <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loadingMessages")}
        </div>
      ) : messages.length ? (
        <div className="space-y-3">
          {messages.map(message => (
            <MessageRow key={message.id} emailId={email.id} message={message} />
          ))}
          {nextCursor && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={loadingMore}
              onClick={() => fetchMessages(nextCursor, true)}
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("loadMoreMessages")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
          {t("noMessages")}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </section>
  )
}
