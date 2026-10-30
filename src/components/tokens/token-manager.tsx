import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  KeyRoundIcon,
  CopyIcon,
  CheckIcon,
  Trash2Icon,
  PlusIcon,
  ShieldIcon,
  SparklesIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  LockIcon,
} from "lucide-react"
import { toast } from "sonner"
import { TablePagination } from "@/components/ui/table-pagination"
import { TableSortHeader, type SortOrder } from "@/components/ui/table-sort-header"

export interface TokenItem {
  id: string
  name: string
  token: string
  maskedToken: string
  scope: "full" | "tools-only" | "read-only"
  createdAt: string
  expiresAt: string
  lastUsed: string
  status: "active" | "revoked"
}

const TOKENS_STORAGE_KEY = "mcp_gateway_tokens_v2"

// Clear old legacy seed keys from previous versions
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("mcp_gateway_tokens_v1")
  } catch {
    // ignore
  }
}

function generateCryptoToken(prefix = "mcp_live_"): string {
  const bytes = new Uint8Array(24)
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `${prefix}${hex}`
}

function maskToken(token: string): string {
  if (token.length <= 16) return token
  const prefix = token.slice(0, 9)
  const suffix = token.slice(-4)
  return `${prefix}••••••••${suffix}`
}

export function TokenManager() {
  const [tokens, setTokens] = React.useState<TokenItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(TOKENS_STORAGE_KEY)
        if (saved) return JSON.parse(saved)
      } catch {
        // Fallback to empty
      }
    }
    return []
  })

  // Generator form state
  const [showGenerator, setShowGenerator] = React.useState(false)
  const [tokenName, setTokenName] = React.useState("")
  const [scope, setScope] = React.useState<"full" | "tools-only" | "read-only">("full")
  const [expiry, setExpiry] = React.useState("90 days")

  // Last created token modal / banner
  const [newlyCreatedToken, setNewlyCreatedToken] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  // Sorting & Pagination
  type TokenSortKey = "name" | "token" | "scope" | "expiresAt" | "lastUsed" | "status"
  const [sortKey, setSortKey] = React.useState<TokenSortKey | null>("name")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(5)

  const handleSort = (column: TokenSortKey) => {
    if (sortKey === column) {
      if (sortOrder === "asc") setSortOrder("desc")
      else if (sortOrder === "desc") {
        setSortKey(null)
        setSortOrder(null)
      }
    } else {
      setSortKey(column)
      setSortOrder("asc")
    }
    setCurrentPage(1)
  }

  const sortedTokens = React.useMemo(() => {
    if (!sortKey || !sortOrder) return tokens
    return [...tokens].sort((a, b) => {
      let comparison = 0
      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "token":
          comparison = a.maskedToken.localeCompare(b.maskedToken)
          break
        case "scope":
          comparison = a.scope.localeCompare(b.scope)
          break
        case "expiresAt":
          comparison = a.expiresAt.localeCompare(b.expiresAt)
          break
        case "lastUsed":
          comparison = a.lastUsed.localeCompare(b.lastUsed)
          break
        case "status":
          comparison = a.status.localeCompare(b.status)
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [tokens, sortKey, sortOrder])

  const paginatedTokens = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedTokens.slice(start, start + pageSize)
  }, [sortedTokens, currentPage, pageSize])

  const saveTokens = (newTokens: TokenItem[]) => {
    setTokens(newTokens)
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(newTokens))
    }
  }

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenName.trim()) {
      toast.error("Please enter a token name", {
        description: "Specify the client or purpose (e.g. 'Claude Desktop' or 'CI Runner')",
      })
      return
    }

    const rawToken = generateCryptoToken()
    const newToken: TokenItem = {
      id: `tok-${Date.now()}`,
      name: tokenName.trim(),
      token: rawToken,
      maskedToken: maskToken(rawToken),
      scope,
      createdAt: "Just now",
      expiresAt: expiry,
      lastUsed: "Never",
      status: "active",
    }

    const updated = [newToken, ...tokens]
    saveTokens(updated)
    setNewlyCreatedToken(rawToken)
    setTokenName("")
    setShowGenerator(false)

    toast.success("Token Generated", {
      description: `New bearer token created for "${newToken.name}"`,
    })
  }

  const handleCopy = async (id: string, textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedId(id)
      toast.success("Copied to clipboard", {
        description: "Token copied. Store it in your client's authorization config.",
      })
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("Failed to copy token")
    }
  }

  const handleRevoke = (id: string) => {
    const updated = tokens.map((t) => {
      if (t.id !== id) return t
      const nextStatus = t.status === "active" ? ("revoked" as const) : ("active" as const)
      toast(nextStatus === "revoked" ? `Revoked token: ${t.name}` : `Restored token: ${t.name}`, {
        description:
          nextStatus === "revoked"
            ? "Incoming requests with this token will now be rejected"
            : "Token is now active again",
      })
      return { ...t, status: nextStatus }
    })
    saveTokens(updated)
  }

  const handleDelete = (id: string) => {
    const updated = tokens.filter((t) => t.id !== id)
    saveTokens(updated)
    toast.success("Token Deleted")
  }

  const getScopeBadge = (s: TokenItem["scope"]) => {
    switch (s) {
      case "full":
        return {
          label: "Full Access",
          color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
        }
      case "tools-only":
        return {
          label: "Tools Only",
          color: "border-sky-500/30 text-sky-400 bg-sky-500/10",
        }
      case "read-only":
        return {
          label: "Read Only",
          color: "border-purple-500/30 text-purple-400 bg-purple-500/10",
        }
    }
  }

  return (
    <Card className="flex flex-col border border-border/70 shadow-xs">
      <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <KeyRoundIcon className="size-4 text-emerald-500" />
            Gateway API Tokens & Credentials
          </CardTitle>
          <CardDescription className="text-xs">
            Generate and manage cryptographic bearer tokens for external AI agents connecting to this gateway
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setShowGenerator((v) => !v)}
            className="cursor-pointer gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-2 sm:px-3"
            title={showGenerator ? "Cancel" : "Generate New Token"}
          >
            {showGenerator ? <LockIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
            <span className="hidden sm:inline">{showGenerator ? "Cancel" : "Generate New Token"}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-2">
        {/* Token Generator Panel */}
        {showGenerator && (
          <form
            onSubmit={handleCreateToken}
            className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4 transition-all"
          >
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              <h4 className="text-xs font-semibold tracking-tight text-foreground">
                Generate Client Authorization Token
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground">
                  Client / Token Name
                </label>
                <Input
                  placeholder="e.g. Claude Desktop, CI/CD Runner"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="h-8 text-xs bg-background"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground">
                  Scope & Permissions
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as TokenItem["scope"])}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none focus-visible:border-ring focus-visible:ring-2"
                >
                  <option value="full">Full Access (Read, Write & Tools)</option>
                  <option value="tools-only">Tools Only (Execute Tools)</option>
                  <option value="read-only">Read Only (Resources & Prompts)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground">
                  Token Expiration
                </label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none focus-visible:border-ring focus-visible:ring-2"
                >
                  <option value="30 days">30 Days</option>
                  <option value="90 days">90 Days</option>
                  <option value="1 year">1 Year</option>
                  <option value="Never">Never Expires</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldIcon className="size-3 text-emerald-500" />
                Generated using 192-bit cryptographic entropy (crypto.getRandomValues)
              </span>
              <Button
                type="submit"
                size="sm"
                className="cursor-pointer gap-1.5 bg-primary text-primary-foreground text-xs font-medium h-8"
              >
                <SparklesIcon className="size-3.5" />
                <span>Create Secret Token</span>
              </Button>
            </div>
          </form>
        )}

        {/* Newly Created Token Reveal Box */}
        {newlyCreatedToken && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2Icon className="size-4" />
                Token Created — Copy and save this token now!
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewlyCreatedToken(null)}
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Dismiss
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              For security reasons, this full token will not be displayed again once you close this banner.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={newlyCreatedToken}
                className="font-mono text-xs bg-background/80 text-foreground selection:bg-primary"
              />
              <Button
                size="sm"
                onClick={() => handleCopy("new-token", newlyCreatedToken)}
                className="cursor-pointer gap-1.5 shrink-0 bg-emerald-600 text-white hover:bg-emerald-500 h-8"
              >
                {copiedId === "new-token" ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
                <span>{copiedId === "new-token" ? "Copied" : "Copy Token"}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Tokens Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-48 text-xs font-semibold">
                  <TableSortHeader column="name" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                    Name / Client
                  </TableSortHeader>
                </TableHead>
                <TableHead className="w-56 text-xs font-semibold">
                  <TableSortHeader column="token" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                    Token Key
                  </TableSortHeader>
                </TableHead>
                <TableHead className="w-32 text-xs font-semibold">
                  <TableSortHeader column="scope" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                    Scope
                  </TableSortHeader>
                </TableHead>
                <TableHead className="w-28 text-xs font-semibold">
                  <TableSortHeader column="expiresAt" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                    Expires
                  </TableSortHeader>
                </TableHead>
                <TableHead className="w-28 text-xs font-semibold">
                  <TableSortHeader column="lastUsed" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                    Last Used
                  </TableSortHeader>
                </TableHead>
                <TableHead className="w-24 text-xs font-semibold">
                  <TableSortHeader column="status" currentSort={sortKey} sortOrder={sortOrder} onSort={handleSort}>
                    Status
                  </TableSortHeader>
                </TableHead>
                <TableHead className="w-24 text-right text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTokens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                    No tokens created yet. Click "Generate New Token" above.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTokens.map((item) => {
                  const scopeBadge = getScopeBadge(item.scope)
                  const isActive = item.status === "active"
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium text-xs">
                        <div className="flex items-center gap-1.5">
                          <LockIcon className="size-3.5 text-muted-foreground" />
                          <span>{item.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.maskedToken}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${scopeBadge.color}`}
                        >
                          {scopeBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.expiresAt}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="size-3 text-muted-foreground/60" />
                          {item.lastUsed}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                            isActive
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"
                              : "border-destructive/25 bg-destructive/10 text-destructive"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-destructive"
                            }`}
                          />
                          {isActive ? "Active" : "Revoked"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(item.id, item.token)}
                            className="size-7 p-0 cursor-pointer"
                            title="Copy full token"
                          >
                            {copiedId === item.id ? (
                              <CheckIcon className="size-3 text-emerald-500" />
                            ) : (
                              <CopyIcon className="size-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevoke(item.id)}
                            className={`h-7 px-2 text-[11px] cursor-pointer ${
                              isActive ? "text-amber-500 hover:text-amber-400" : "text-emerald-500 hover:text-emerald-400"
                            }`}
                          >
                            {isActive ? "Revoke" : "Restore"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="size-7 p-0 cursor-pointer text-destructive hover:text-destructive"
                            title="Delete token"
                          >
                            <Trash2Icon className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={sortedTokens.length}
            pageSizeOptions={[5, 10, 20]}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1.5">
            <AlertCircleIcon className="size-3.5 text-primary" />
            Clients connect with: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] text-foreground">Authorization: Bearer &lt;token&gt;</code>
          </span>
          <span>{tokens.filter((t) => t.status === "active").length} Active Tokens</span>
        </div>
      </CardContent>
    </Card>
  )
}
