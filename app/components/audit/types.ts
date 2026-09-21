export interface AuditUserSummary {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  emailVerified?: number | null
  image?: string | null
  role?: string | null
  providers: string[]
  emailCount: number
  messageCount: number
}

export interface AuditUserDetails {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  emailVerified?: number | null
  image?: string | null
  roles: string[]
  providers: string[]
  emailCount: number
  messageCount: number
}

export interface AuditEmailSummary {
  id: string
  address: string
  createdAt?: number | null
  expiresAt?: number | null
  messageCount: number
}

export interface AuditMessageSummary {
  id: string
  fromAddress?: string | null
  toAddress?: string | null
  subject: string
  type?: string | null
  receivedAt?: number | null
  sentAt?: number | null
}

export interface AuditMessageDetails extends AuditMessageSummary {
  content?: string | null
  html?: string | null
}

export interface AuditUsersResponse {
  users?: AuditUserSummary[]
  total?: number
  page?: number
  pageSize?: number
  error?: string
}

export interface AuditUserResponse {
  user?: AuditUserDetails
  emails?: AuditEmailSummary[]
  page?: number
  pageSize?: number
  error?: string
}

export interface AuditMessagesResponse {
  messages?: AuditMessageSummary[]
  nextCursor?: string | null
  error?: string
}

export interface AuditMessageResponse {
  message?: AuditMessageDetails
  error?: string
}
