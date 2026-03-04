"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { CreateDialog } from "./create-dialog"
import { ShareDialog } from "./share-dialog"
import { Mail, RefreshCw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useThrottle } from "@/hooks/use-throttle"
import { EMAIL_CONFIG } from "@/config"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ROLES } from "@/lib/permissions"
import { useUserRole } from "@/hooks/use-user-role"
import { useConfig } from "@/hooks/use-config"

interface Email {
  id: string
  address: string
  createdAt: number
  expiresAt: number
}

interface EmailListProps {
  onEmailSelect: (email: Email | null) => void
  selectedEmailId?: string
}

interface EmailResponse {
  emails: Email[]
  nextCursor: string | null
  total: number
}

export function EmailList({ onEmailSelect, selectedEmailId }: EmailListProps) {
  const { data: session } = useSession()
  const { config } = useConfig()
  const { role } = useUserRole()
  const t = useTranslations("emails.list")
  const tCommon = useTranslations("common.actions")
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [emailToDelete, setEmailToDelete] = useState<Email | null>(null)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([])
  const { toast } = useToast()

  const fetchEmails = async (cursor?: string) => {
    try {
      const url = new URL("/api/emails", window.location.origin)
      if (cursor) {
        url.searchParams.set('cursor', cursor)
      }
      const response = await fetch(url)
      const data = await response.json() as EmailResponse
      
      if (!cursor) {
        const newEmails = data.emails
        const oldEmails = emails

        const lastDuplicateIndex = newEmails.findIndex(
          newEmail => oldEmails.some(oldEmail => oldEmail.id === newEmail.id)
        )

        if (lastDuplicateIndex === -1) {
          setEmails(newEmails)
          setNextCursor(data.nextCursor)
          setTotal(data.total)
          return
        }
        const uniqueNewEmails = newEmails.slice(0, lastDuplicateIndex)
        setEmails([...uniqueNewEmails, ...oldEmails])
        setTotal(data.total)
        return
      }
      setEmails(prev => [...prev, ...data.emails])
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch emails:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchEmails()
  }

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return

    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget
    const threshold = clientHeight * 1.5
    const remainingScroll = scrollHeight - scrollTop

    if (remainingScroll <= threshold && nextCursor) {
      setLoadingMore(true)
      fetchEmails(nextCursor)
    }
  }, 200)

  useEffect(() => {
    if (session) fetchEmails()
  }, [session])

  useEffect(() => {
    setSelectedEmailIds(prev => prev.filter(id => emails.some(email => email.id === id)))
  }, [emails])

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev => (
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    ))
  }

  const handleToggleSelectAll = () => {
    setSelectedEmailIds(prev => (
      prev.length === emails.length ? [] : emails.map(email => email.id)
    ))
  }

  const handleDelete = async (email: Email) => {
    try {
      const response = await fetch(`/api/emails/${email.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const data = await response.json()
        toast({
          title: t("error"),
          description: (data as { error: string }).error,
          variant: "destructive"
        })
        return
      }

      setEmails(prev => prev.filter(e => e.id !== email.id))
      setTotal(prev => prev - 1)
      setSelectedEmailIds(prev => prev.filter(id => id !== email.id))

      toast({
        title: t("success"),
        description: t("deleteSuccess")
      })
      
      if (selectedEmailId === email.id) {
        onEmailSelect(null)
      }
    } catch {
      toast({
        title: t("error"),
        description: t("deleteFailed"),
        variant: "destructive"
      })
    } finally {
      setEmailToDelete(null)
    }
  }

  const handleBatchDelete = async () => {
    const deleteIds = [...selectedEmailIds]
    if (deleteIds.length === 0) {
      setBatchDeleteOpen(false)
      return
    }

    try {
      const response = await fetch("/api/emails/batch", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: deleteIds })
      })

      const data = await response.json() as { error?: string; deletedCount?: number }
      if (!response.ok) {
        toast({
          title: t("error"),
          description: data.error || t("batchDeleteFailed"),
          variant: "destructive"
        })
        return
      }

      const deletedCount = typeof data.deletedCount === "number" ? data.deletedCount : deleteIds.length
      const deletedIdSet = new Set(deleteIds)

      setEmails(prev => prev.filter(email => !deletedIdSet.has(email.id)))
      setSelectedEmailIds(prev => prev.filter(id => !deletedIdSet.has(id)))
      setTotal(prev => Math.max(0, prev - deletedCount))

      toast({
        title: t("success"),
        description: t("batchDeleteSuccess", { count: deletedCount })
      })

      if (selectedEmailId && deletedIdSet.has(selectedEmailId)) {
        onEmailSelect(null)
      }
    } catch {
      toast({
        title: t("error"),
        description: t("batchDeleteFailed"),
        variant: "destructive"
      })
    } finally {
      setBatchDeleteOpen(false)
    }
  }

  if (!session) return null

  const hasSelectedEmails = selectedEmailIds.length > 0
  const allEmailsSelected = emails.length > 0 && selectedEmailIds.length === emails.length

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-2 flex justify-between items-center border-b border-primary/20">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn("h-8 w-8", refreshing && "animate-spin")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-500">
              {role === ROLES.EMPEROR ? (
                t("emailCountUnlimited", { count: total })
              ) : (
                t("emailCount", { count: total, max: config?.maxEmails || EMAIL_CONFIG.MAX_ACTIVE_EMAILS })
              )}
            </span>
            {hasSelectedEmails && (
              <span className="text-xs text-primary">
                {t("selectedCount", { count: selectedEmailIds.length })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {emails.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSelectAll}
              >
                {allEmailsSelected ? t("clearSelection") : t("selectAll")}
              </Button>
            )}
            {hasSelectedEmails && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteOpen(true)}
              >
                {t("batchDelete")}
              </Button>
            )}
            <CreateDialog onEmailCreated={handleRefresh} />
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-2" onScroll={handleScroll}>
          {loading ? (
            <div className="text-center text-sm text-gray-500">{t("loading")}</div>
          ) : emails.length > 0 ? (
            <div className="space-y-1">
              {emails.map(email => (
                <div
                  key={email.id}
                  className={cn("flex items-center gap-2 p-2 rounded cursor-pointer text-sm group",
                    "hover:bg-primary/5",
                    selectedEmailId === email.id && "bg-primary/10"
                  )}
                  onClick={() => onEmailSelect(email)}
                >
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedEmailIds.includes(email.id)}
                      onChange={() => toggleEmailSelection(email.id)}
                    />
                  </div>
                  <Mail className="h-4 w-4 text-primary/60" />
                  <div className="truncate flex-1">
                    <div className="font-medium truncate">{email.address}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(email.expiresAt).getFullYear() === 9999 ? (
                        t("permanent")
                      ) : (
                        `${t("expiresAt")}: ${new Date(email.expiresAt).toLocaleString()}`
                      )}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <ShareDialog emailId={email.id} emailAddress={email.address} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEmailToDelete(email)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {loadingMore && (
                <div className="text-center text-sm text-gray-500 py-2">
                  {t("loadingMore")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500">
              {t("noEmails")}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!emailToDelete} onOpenChange={() => setEmailToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { email: emailToDelete?.address || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => emailToDelete && handleDelete(emailToDelete)}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("batchDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("batchDeleteDescription", { count: selectedEmailIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleBatchDelete}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
