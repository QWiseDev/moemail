"use client"

import type { FormEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { MessageAuditPanel } from "./message-audit-panel"
import type {
  AuditEmailSummary,
  AuditUserDetails,
  AuditUserResponse,
  AuditUsersResponse,
  AuditUserSummary,
} from "./types"

const PAGE_SIZE = 20

function formatDate(timestamp?: number | null) {
  if (!timestamp) return "-"
  const date = new Date(timestamp)
  return date.getFullYear() >= 9999 ? "∞" : date.toLocaleString()
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}) {
  const t = useTranslations("audit")
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="flex items-center justify-between gap-2 border-t pt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">{t("previousPage")}</span>
      </Button>
      <span className="text-xs text-muted-foreground">
        {t("pageInfo", { current: page, total: totalPages })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">{t("nextPage")}</span>
      </Button>
    </div>
  )
}

export function MailAuditDashboard() {
  const t = useTranslations("audit")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState<AuditUserSummary[]>([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [user, setUser] = useState<AuditUserDetails | null>(null)
  const [emails, setEmails] = useState<AuditEmailSummary[]>([])
  const [emailsPage, setEmailsPage] = useState(1)
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const usersRequest = useRef<AbortController | null>(null)
  const userRequest = useRef<AbortController | null>(null)

  const selectedEmail = emails.find(email => email.id === selectedEmailId) ?? null

  const fetchUsers = useCallback(async () => {
    usersRequest.current?.abort()
    const controller = new AbortController()
    usersRequest.current = controller
    setUsersLoading(true)
    setUsersError(null)
    try {
      const params = new URLSearchParams({
        page: usersPage.toString(),
        pageSize: PAGE_SIZE.toString(),
      })
      if (search) params.set("search", search)

      const response = await fetch(`/api/admin/audit/users?${params}`, {
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null) as AuditUsersResponse | null
      if (!response.ok || !data?.users) {
        throw new Error(data?.error || t("loadUsersFailed"))
      }

      const loadedUsers = data.users
      setUsers(loadedUsers)
      setUsersTotal(data.total ?? 0)
      setSelectedUserId(current => (
        current && loadedUsers.some(item => item.id === current)
          ? current
          : loadedUsers[0]?.id ?? null
      ))
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return
      setUsersError(t("loadUsersFailed"))
    } finally {
      if (usersRequest.current === controller) {
        usersRequest.current = null
        setUsersLoading(false)
      }
    }
  }, [search, t, usersPage])

  useEffect(() => {
    void fetchUsers()
    return () => usersRequest.current?.abort()
  }, [fetchUsers])

  const fetchUser = useCallback(async () => {
    if (!selectedUserId) {
      userRequest.current?.abort()
      userRequest.current = null
      setUser(null)
      setEmails([])
      setSelectedEmailId(null)
      return
    }

    userRequest.current?.abort()
    const controller = new AbortController()
    userRequest.current = controller
    setUserLoading(true)
    setUserError(null)
    try {
      const params = new URLSearchParams({
        page: emailsPage.toString(),
        pageSize: PAGE_SIZE.toString(),
      })
      const response = await fetch(
        `/api/admin/audit/users/${encodeURIComponent(selectedUserId)}?${params}`,
        { signal: controller.signal }
      )
      const data = await response.json().catch(() => null) as AuditUserResponse | null
      if (!response.ok || !data?.user || !data.emails) {
        throw new Error(data?.error || t("loadUserFailed"))
      }

      const loadedEmails = data.emails
      setUser(data.user)
      setEmails(loadedEmails)
      setSelectedEmailId(current => (
        current && loadedEmails.some(email => email.id === current)
          ? current
          : loadedEmails[0]?.id ?? null
      ))
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return
      setUserError(t("loadUserFailed"))
    } finally {
      if (userRequest.current === controller) {
        userRequest.current = null
        setUserLoading(false)
      }
    }
  }, [emailsPage, selectedUserId, t])

  useEffect(() => {
    void fetchUser()
    return () => userRequest.current?.abort()
  }, [fetchUser])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUsersPage(1)
    setEmailsPage(1)
    setSelectedUserId(null)
    setSelectedEmailId(null)
    setSearch(searchInput.trim())
  }

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId)
    setEmailsPage(1)
    setSelectedEmailId(null)
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-background p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">{t("title")}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <form onSubmit={handleSearch} className="flex w-full gap-2 md:max-w-xl">
            <Input
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
            <Button type="submit" className="gap-2">
              <Search className="h-4 w-4" />
              {t("search")}
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_320px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UsersRound className="h-4 w-4 text-primary" />
              {t("users", { count: usersTotal })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={usersLoading}
              onClick={fetchUsers}
            >
              <RefreshCw className={cn("h-4 w-4", usersLoading && "animate-spin")} />
              <span className="sr-only">{t("refreshUsers")}</span>
            </Button>
          </div>

          {usersLoading ? (
            <div className="flex min-h-80 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : users.length ? (
            <div className="space-y-2">
              <div className="max-h-[38rem] space-y-2 overflow-auto pr-1">
                {users.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleUserSelect(item.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      selectedUserId === item.id
                        ? "border-primary/50 bg-primary/10"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {item.name || item.username || item.email || item.id}
                          </span>
                          {item.role && (
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              {item.role}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {item.username || item.email || item.id}
                        </div>
                        <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                          <span>{t("emailCountShort", { count: item.emailCount })}</span>
                          <span>{t("messageCountShort", { count: item.messageCount })}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <Pagination
                page={usersPage}
                total={usersTotal}
                pageSize={PAGE_SIZE}
                onChange={setUsersPage}
              />
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
              {t("noUsers")}
            </div>
          )}
          {usersError && <p className="mt-3 text-sm text-destructive">{usersError}</p>}
        </section>

        <section className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="mb-3 border-b pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4 text-primary" />
              {t("emails")}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {user
                ? user.name || user.username || user.email || user.id
                : t("selectUser")}
            </p>
          </div>

          {userLoading ? (
            <div className="flex min-h-80 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-xs">
                {user.roles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {user.roles.map(role => (
                      <span key={role} className="rounded bg-primary/10 px-2 py-1 text-primary">
                        {role}
                      </span>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted-foreground">{t("loginEmail")}</span>
                  <span className="truncate text-right">{user.email || "-"}</span>
                  <span className="text-muted-foreground">{t("providers")}</span>
                  <span className="truncate text-right">{user.providers.join(", ") || "-"}</span>
                  <span className="text-muted-foreground">{t("emailVerified")}</span>
                  <span className="text-right">{formatDate(user.emailVerified)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded bg-primary/10 px-2 py-1 text-primary">
                    {t("emailCountShort", { count: user.emailCount })}
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-1 text-primary">
                    {t("messageCountShort", { count: user.messageCount })}
                  </span>
                </div>
              </div>

              {emails.length ? (
                <div className="space-y-2">
                  <div className="max-h-[30rem] space-y-2 overflow-auto pr-1">
                    {emails.map(email => (
                      <button
                        key={email.id}
                        type="button"
                        onClick={() => setSelectedEmailId(email.id)}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition-colors",
                          selectedEmailId === email.id
                            ? "border-primary/50 bg-primary/10"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <div className="truncate text-sm font-medium">{email.address}</div>
                        <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                          <span>{t("messageCount", { count: email.messageCount })}</span>
                          <span>{formatDate(email.expiresAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Pagination
                    page={emailsPage}
                    total={user.emailCount}
                    pageSize={PAGE_SIZE}
                    onChange={page => {
                      setEmailsPage(page)
                      setSelectedEmailId(null)
                    }}
                  />
                </div>
              ) : (
                <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
                  {t("noEmails")}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
              {t("selectUser")}
            </div>
          )}
          {userError && <p className="mt-3 text-sm text-destructive">{userError}</p>}
        </section>

        <MessageAuditPanel email={selectedEmail} />
      </div>
    </div>
  )
}
