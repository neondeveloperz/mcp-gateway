import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ShieldAlertIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  ServerIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchPendingApprovals,
  resolveApproval,
  type PendingApprovalItem,
} from "@/lib/mcp-service"

export function ApprovalModal() {
  const [pending, setPending] = React.useState<PendingApprovalItem[]>([])
  const [copied, setCopied] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  // Poll for pending approvals every 1.5 seconds
  React.useEffect(() => {
    let isMounted = true

    const poll = async () => {
      try {
        const list = await fetchPendingApprovals()
        if (isMounted) {
          const onlyPending = list.filter((item) => item.status === "pending")
          setPending(onlyPending)
        }
      } catch {
        // ignore
      }
    }

    poll()
    const timer = setInterval(poll, 1500)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  const current = pending[0] ?? null

  const [secondsLeft, setSecondsLeft] = React.useState(120)

  React.useEffect(() => {
    if (!current) return

    const getRemaining = () => {
      const now = Date.now()
      return Math.max(0, Math.floor((current.expiresAtMs - now) / 1000))
    }

    setSecondsLeft(getRemaining())
    const interval = setInterval(() => {
      const left = getRemaining()
      setSecondsLeft(left)
      if (left <= 0) {
        setPending((prev) => prev.filter((p) => p.ticket !== current.ticket))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [current])

  const handleResolve = async (approved: boolean) => {
    if (!current) return
    setSubmitting(true)
    try {
      await resolveApproval(current.ticket, approved)
      if (approved) {
        toast.success(`Approved ${current.ticket}`, {
          description: `Allowed execution for ${current.toolName} on ${current.serverName}`,
        })
      } else {
        toast.error(`Rejected ${current.ticket}`, {
          description: `Blocked execution for ${current.toolName}`,
        })
      }
      setPending((prev) => prev.filter((p) => p.ticket !== current.ticket))
    } catch (err) {
      toast.error(`Failed to resolve approval: ${String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyTicket = () => {
    if (!current) return
    navigator.clipboard.writeText(current.ticket)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Ticket Copied", { description: `#${current.ticket}` })
  }

  if (!current) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl border border-amber-500/40 bg-background/95 p-6 shadow-2xl ring-1 ring-amber-500/20 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
              <ShieldAlertIcon className="size-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">
                  Human Approval Required
                </h3>
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                  High-Risk / Destructive
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                An AI Agent requested to execute a critical operation on your infrastructure.
              </p>
            </div>
          </div>
        </div>

        {/* Security Ticket & Target details */}
        <div className="rounded-lg border border-border/80 bg-muted/30 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ServerIcon className="size-3.5" />
              Target Server:
            </span>
            <Badge variant="outline" className="font-semibold text-xs">
              {current.serverName}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tool Action:</span>
            <code className="font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-xs">
              {current.toolName}
            </code>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ClockIcon className="size-3.5" />
              Security Ticket:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-xs text-foreground bg-muted px-2 py-0.5 rounded">
                #{current.ticket}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCopyTicket}
                className="size-6 cursor-pointer"
                title="Copy Ticket"
              >
                {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Arguments Payload Inspection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Target Arguments Payload:
          </label>
          <pre className="max-h-36 overflow-y-auto rounded-lg border border-border/60 bg-muted/60 p-3 font-mono text-[11px] text-foreground/90 whitespace-pre-wrap break-all">
            {JSON.stringify(current.arguments, null, 2)}
          </pre>
        </div>

        {/* In-Band remote note */}
        <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-2.5 text-[11px] text-sky-400 flex items-center gap-2">
          <span>💡</span>
          <span>
            Working remotely on Laptop? You can also approve by typing <strong className="font-mono text-foreground font-semibold">Yes</strong> in your IDE chat with ticket <strong className="font-mono text-foreground">#{current.ticket}</strong>.
          </span>
        </div>

        {/* Action Buttons & Countdown */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5 text-amber-500" />
            <span>
              Expires in <strong className="font-mono text-foreground">{secondsLeft}s</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => handleResolve(false)}
              className="cursor-pointer gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
            >
              <XCircleIcon className="size-3.5" />
              <span>Reject</span>
            </Button>
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => handleResolve(true)}
              className="cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
            >
              <CheckCircle2Icon className="size-3.5" />
              <span>Approve & Allow</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
