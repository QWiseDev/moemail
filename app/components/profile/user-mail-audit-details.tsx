"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Inbox, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditEmail, AuditMessage, AuditUser } from "./user-mail-audit-types"

const roleTranslationKeys = {
  emperor: "roles.EMPEROR",
  duke: "roles.DUKE",
  knight: "roles.KNIGHT",
  civilian: "roles.CIVILIAN",
} as const

type Translator = ReturnType<typeof useTranslations>

function formatDate(timestamp: number | null | undefined, t: Translator) {
  if (!timestamp) return t("empty")

  const date = new Date(timestamp)
  if (date.getFullYear() >= 9999) return t("permanent")

  return date.toLocaleString()
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{value || "-"}</dd>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-primary/10 bg-primary/5 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function MessageDetails({ message, t }: { message: AuditMessage; t: Translator }) {
  const time = message.sent_at || message.received_at

  return (
    <details className="rounded-md border border-primary/10 bg-background p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{message.subject}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {message.from_address || message.to_address || "-"}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            <div>{message.type || t("received")}</div>
            <div>{formatDate(time, t)}</div>
          </div>
        </div>
      </summary>

      <div className="mt-3 space-y-3 border-t border-primary/10 pt-3 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <DetailRow label={t("from")} value={message.from_address} />
          <DetailRow label={t("to")} value={message.to_address} />
        </dl>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{t("content")}</div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
            {message.content || "-"}
          </pre>
        </div>
        {message.html && (
          <details>
            <summary className="cursor-pointer text-xs text-primary">{t("html")}</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
              {message.html}
            </pre>
          </details>
        )}
      </div>
    </details>
  )
}

function EmailSelector({
  emails,
  selectedEmailId,
  onSelect,
  t,
}: {
  emails: AuditEmail[]
  selectedEmailId: string | null
  onSelect: (emailId: string) => void
  t: Translator
}) {
  if (!emails.length) {
    return <div className="p-4 text-center text-sm text-muted-foreground">{t("noEmails")}</div>
  }

  return (
    <div className="space-y-2">
      {emails.map((email) => (
        <button
          key={email.id}
          type="button"
          onClick={() => onSelect(email.id)}
          className={cn(
            "w-full rounded-md border p-3 text-left transition-colors",
            selectedEmailId === email.id
              ? "border-primary/40 bg-primary/10"
              : "border-primary/10 hover:bg-primary/5"
          )}
        >
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{email.address}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("messageCount", { count: email.messages.length })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("expiresAt")}: {formatDate(email.expiresAt, t)}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

export function UserMailAuditDetails({
  user,
  selectedEmailId,
  onEmailSelect,
}: {
  user: AuditUser
  selectedEmailId: string | null
  onEmailSelect: (emailId: string) => void
}) {
  const t = useTranslations("profile.userAudit")
  const tCard = useTranslations("profile.card")

  const selectedEmail = useMemo(() => {
    return user.emails.find(email => email.id === selectedEmailId) ?? user.emails[0] ?? null
  }, [selectedEmailId, user.emails])
  const messageTotal = useMemo(() => {
    return user.emails.reduce((total, email) => total + email.messages.length, 0)
  }, [user.emails])

  const formatRole = (role: string) => {
    const key = roleTranslationKeys[role as keyof typeof roleTranslationKeys]
    return key ? tCard(key as any) : role
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-md border border-primary/10 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">
            {user.name || user.username || user.email || user.id}
          </h3>
          {user.roles.map(role => (
            <span key={role} className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {formatRole(role)}
            </span>
          ))}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label={t("userId")} value={user.id} />
          <DetailRow label={t("username")} value={user.username} />
          <DetailRow label={t("loginEmail")} value={user.email} />
          <DetailRow label={t("providers")} value={user.providers.join(", ") || t("empty")} />
          <DetailRow label={t("emailVerified")} value={formatDate(user.emailVerified, t)} />
          <DetailRow label={t("avatar")} value={user.image} />
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryStat label={t("emailTotal")} value={user.emails.length} />
        <SummaryStat label={t("messageTotal")} value={messageTotal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className="rounded-md border border-primary/10 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4 text-primary" />
            {t("emails")}
          </div>
          <EmailSelector
            emails={user.emails}
            selectedEmailId={selectedEmail?.id ?? null}
            onSelect={onEmailSelect}
            t={t}
          />
        </section>

        <section className="rounded-md border border-primary/10 p-3">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4 text-primary" />
            {selectedEmail ? selectedEmail.address : t("messages")}
          </div>
          {selectedEmail && selectedEmail.messages.length > 0 ? (
            <div className="space-y-3">
              {selectedEmail.messages.map(message => (
                <MessageDetails key={message.id} message={message} t={t} />
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">{t("noMessages")}</div>
          )}
        </section>
      </div>
    </div>
  )
}
