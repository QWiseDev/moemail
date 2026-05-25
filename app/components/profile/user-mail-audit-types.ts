export interface AuditMessage {
  id: string
  from_address?: string | null
  to_address?: string | null
  subject: string
  content: string
  html?: string | null
  type?: string | null
  received_at?: number | null
  sent_at?: number | null
}

export interface AuditEmail {
  id: string
  address: string
  createdAt?: number | null
  expiresAt?: number | null
  messages: AuditMessage[]
}

export interface AuditUser {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  emailVerified?: number | null
  image?: string | null
  role?: string | null
  roles: string[]
  providers: string[]
  emails: AuditEmail[]
}

export interface AuditUserSummary {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  emailVerified?: number | null
  image?: string | null
  role?: string | null
  roles: string[]
  providers: string[]
  emailCount: number
  messageCount: number
}

export interface UserLookupResponse {
  user?: AuditUser
  error?: string
}

export interface UserListResponse {
  users?: AuditUserSummary[]
  error?: string
}
