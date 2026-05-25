"use client"

import type { FormEvent } from "react"
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Loader2, RefreshCw, Search, UserRound, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { UserMailAuditDetails } from "./user-mail-audit-details"
import type { AuditUser, AuditUserSummary, UserListResponse, UserLookupResponse } from "./user-mail-audit-types"

interface UserSummaryListProps {
  users: AuditUserSummary[]
  selectedUserId: string | null
  loadingUserId: string | null
  onSelect: (userId: string) => void
}

function UserSummaryList({ users, selectedUserId, loadingUserId, onSelect }: UserSummaryListProps) {
  const t = useTranslations("profile.userAudit")

  if (!users.length) {
    return <div className="p-4 text-center text-sm text-muted-foreground">{t("noUsers")}</div>
  }

  return (
    <div className="max-h-80 space-y-2 overflow-auto pr-1">
      {users.map((item) => {
        const displayName = item.name || item.username || item.email || item.id
        const isSelected = selectedUserId === item.id
        const isLoading = loadingUserId === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            disabled={!!loadingUserId}
            className={cn(
              "w-full rounded-md border p-3 text-left transition-colors disabled:opacity-70",
              isSelected ? "border-primary/40 bg-primary/10" : "border-primary/10 hover:bg-primary/5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{displayName}</span>
                  {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {item.username || item.email || item.id}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <div>{t("emailCountShort", { count: item.emailCount })}</div>
                <div>{t("messageCountShort", { count: item.messageCount })}</div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function UserMailAuditPanel() {
  const t = useTranslations("profile.userAudit")
  const [searchText, setSearchText] = useState("")
  const [users, setUsers] = useState<AuditUserSummary[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<AuditUser | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/roles/users")
      const data = await response.json() as UserListResponse

      if (!response.ok) {
        throw new Error(data.error || t("loadUsersFailed"))
      }

      setUsers(data.users ?? [])
    } catch (error) {
      setError(error instanceof Error ? error.message : t("loadUsersFailed"))
    } finally {
      setUsersLoading(false)
    }
  }, [t])

  const fetchUserDetail = useCallback(async (payload: { searchText?: string; userId?: string }) => {
    setDetailLoading(true)
    setError(null)
    setUser(null)
    setSelectedEmailId(null)
    setLoadingUserId(payload.userId ?? null)

    try {
      const response = await fetch("/api/roles/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as UserLookupResponse

      if (!response.ok) {
        throw new Error(data.error || t("searchFailed"))
      }

      if (!data.user) {
        throw new Error(t("noUsers"))
      }

      setUser(data.user)
      setSelectedEmailId(data.user.emails[0]?.id ?? null)
    } catch (error) {
      setError(error instanceof Error ? error.message : t("searchFailed"))
    } finally {
      setDetailLoading(false)
      setLoadingUserId(null)
    }
  }, [t])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchText.trim()
    if (!query) return

    await fetchUserDetail({ searchText: query })
  }

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-6">
      <div className="mb-6 flex items-center gap-2">
        <UserRound className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1"
        />
        <Button type="submit" disabled={detailLoading || !searchText.trim()} className="gap-2">
          {detailLoading && !loadingUserId ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {t("search")}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <section className="mt-6 rounded-md border border-primary/10 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UsersRound className="h-4 w-4 text-primary" />
            {t("currentUsers", { count: users.length })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchUsers}
            disabled={usersLoading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", usersLoading && "animate-spin")} />
            {t("refreshUsers")}
          </Button>
        </div>
        {usersLoading ? (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingUsers")}
          </div>
        ) : (
          <UserSummaryList
            users={users}
            selectedUserId={user?.id ?? null}
            loadingUserId={loadingUserId}
            onSelect={(userId) => fetchUserDetail({ userId })}
          />
        )}
      </section>

      {user && (
        <UserMailAuditDetails
          user={user}
          selectedEmailId={selectedEmailId}
          onEmailSelect={setSelectedEmailId}
        />
      )}
    </div>
  )
}
