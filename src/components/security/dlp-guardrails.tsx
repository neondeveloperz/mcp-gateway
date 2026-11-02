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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ShieldAlertIcon,
  ShieldCheckIcon,
  RotateCwIcon,
  SaveIcon,
  PlayIcon,
  CheckCircle2Icon,
  Trash2Icon,
  FingerprintIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchDlpRules,
  saveDlpRules,
  fetchDlpIncidents,
  clearDlpIncidents,
  testDlpScan,
  type DlpRule,
  type DlpIncident,
  type DlpScanTestResult,
} from "@/lib/mcp-service"
import { TablePagination } from "@/components/ui/table-pagination"

export function DlpGuardrails() {
  const [rules, setRules] = React.useState<DlpRule[]>([])
  const [incidents, setIncidents] = React.useState<DlpIncident[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)

  // Live Test Sandbox
  const [testInput, setTestInput] = React.useState(
    '{"database": "postgresql://admin:password123@localhost:5432/mydb", "token": "sk-proj-sample-token-for-dlp-test"}'
  )
  const [testResult, setTestResult] = React.useState<DlpScanTestResult | null>(null)
  const [isTesting, setIsTesting] = React.useState(false)

  // Incident Pagination
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(5)

  const loadData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [r, inc] = await Promise.all([fetchDlpRules(), fetchDlpIncidents()])
      setRules(r)
      setIncidents(inc)
      setHasChanges(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    )
    setHasChanges(true)
  }

  const handleChangeAction = (id: string, action: "mask" | "block" | "audit") => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, action } : r))
    )
    setHasChanges(true)
  }

  const handleSaveRules = async () => {
    try {
      await saveDlpRules(rules)
      setHasChanges(false)
      toast.success("DLP security rules saved and activated across Gateway Core!")
    } catch (err) {
      toast.error(`Failed to save DLP rules: ${err}`)
    }
  }

  const handleRunTest = async () => {
    if (!testInput.trim()) return
    setIsTesting(true)
    try {
      const res = await testDlpScan(testInput)
      setTestResult(res)
      // refresh incidents in case test generated one
      const updatedInc = await fetchDlpIncidents()
      setIncidents(updatedInc)
      if (res.blocked) {
        toast.warning("DLP Block Triggered", {
          description: `Action blocked by rule: ${res.ruleName}`,
        })
      } else {
        toast.success("DLP Inspection Completed", {
          description: "Payload scanned and redacted according to active policies.",
        })
      }
    } finally {
      setIsTesting(false)
    }
  }

  const handleClearIncidents = async () => {
    await clearDlpIncidents()
    setIncidents([])
    toast.info("DLP audit log cleared.")
  }

  const paginatedIncidents = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return incidents.slice(start, start + pageSize)
  }, [incidents, page, pageSize])

  const activeCount = rules.filter((r) => r.enabled).length

  return (
    <div className="space-y-5">
      {/* DLP Policy Header Card */}
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlertIcon className="size-4 text-emerald-400" />
                Data Loss Prevention (DLP) & Secret Guard
              </CardTitle>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
                {activeCount} of {rules.length} Rules Active
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Inspects all outgoing tool responses before delivering to AI models. Automatically redacts or blocks API keys, database credentials, JWTs, and payment card details.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              disabled={isLoading}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <RotateCwIcon className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRules}
              disabled={!hasChanges}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground cursor-pointer"
            >
              <SaveIcon className="size-3.5" />
              <span>Apply Policies</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center text-xs">Active</TableHead>
                  <TableHead className="text-xs">Rule & Threat Pattern</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Enforcement Action</TableHead>
                  <TableHead className="text-xs">Mask Template</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        className="size-4 accent-primary rounded cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-xs text-foreground flex items-center gap-1.5">
                          <FingerprintIcon className="size-3.5 text-muted-foreground" />
                          {rule.name}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{rule.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {rule.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize font-mono ${
                          rule.severity === "critical"
                            ? "border-red-500/40 text-red-400 bg-red-500/10"
                            : rule.severity === "high"
                              ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                              : "border-sky-500/40 text-sky-400 bg-sky-500/10"
                        }`}
                      >
                        {rule.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <select
                        value={rule.action}
                        onChange={(e) =>
                          handleChangeAction(
                            rule.id,
                            e.target.value as "mask" | "block" | "audit"
                          )
                        }
                        className="h-7 rounded border border-border bg-background px-2 text-xs font-mono outline-none"
                      >
                        <option value="mask">Mask (Redact Secret)</option>
                        <option value="block">Block (Halt Tool Call)</option>
                        <option value="audit">Audit Only (Pass Through)</option>
                      </select>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {rule.maskTemplate}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Live DLP Sandbox */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PlayIcon className="size-4 text-primary" />
            Interactive Live DLP Simulator
          </CardTitle>
          <CardDescription className="text-xs">
            Test the DLP regex inspection engine against simulated tool call payloads before deploying to production AI clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Raw Tool Output (Simulated Payload)</span>
                <span className="text-[11px]">JSON or Plaintext</span>
              </div>
              <textarea
                value={testInput}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTestInput(e.target.value)}
                rows={5}
                className="flex w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-none"
                placeholder="Paste payload containing secrets here..."
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">DLP Sanitized Output</span>
                {testResult && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono ${
                      testResult.blocked
                        ? "border-red-500/40 text-red-400 bg-red-500/10"
                        : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    }`}
                  >
                    {testResult.blocked ? "BLOCKED BY POLICY" : "PASSED & MASKED"}
                  </Badge>
                )}
              </div>
              <div className="h-[105px] rounded-md border border-border bg-card/60 p-2.5 font-mono text-xs overflow-auto text-foreground/90 break-all select-all">
                {testResult ? (
                  testResult.blocked ? (
                    <div className="text-red-400 space-y-1">
                      <p className="font-semibold">🛑 Access Denied by Security Policy</p>
                      <p className="text-[11px] text-muted-foreground">
                        Rule: {testResult.ruleName}
                      </p>
                      <p className="text-[11px]">{testResult.reason}</p>
                    </div>
                  ) : (
                    testResult.sanitized
                  )
                ) : (
                  <span className="text-muted-foreground italic">
                    Click &quot;Run Live DLP Probe&quot; to test sanitization results...
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={handleRunTest}
              disabled={isTesting}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground cursor-pointer"
            >
              <PlayIcon className="size-3.5" />
              <span>{isTesting ? "Inspecting..." : "Run Live DLP Probe"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DLP Security Incident Log */}
      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-emerald-400" />
              DLP Incident History & Redaction Log ({incidents.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Audit trail of credentials, tokens, and PII intercepted by the Gateway DLP filter.
            </CardDescription>
          </div>

          {incidents.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearIncidents}
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive cursor-pointer"
            >
              <Trash2Icon className="size-3" />
              <span>Clear Audit Log</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {incidents.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
              <CheckCircle2Icon className="size-8 text-emerald-400 mx-auto opacity-70" />
              <p className="font-medium text-foreground">Zero DLP Violations Detected</p>
              <p>No secrets or sensitive credentials have been leaked by downstream tools.</p>
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Rule Violated</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Action Taken</TableHead>
                    <TableHead className="text-xs">Origin Tool</TableHead>
                    <TableHead className="text-xs">Redaction Preview</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedIncidents.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(inc.timestampMs).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {inc.ruleName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize font-mono ${
                            inc.severity === "critical"
                              ? "border-red-500/40 text-red-400"
                              : "border-amber-500/40 text-amber-400"
                          }`}
                        >
                          {inc.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="text-[10px] capitalize font-mono"
                        >
                          {inc.actionTaken}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {inc.toolName || "system_call"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-400">
                        {inc.matchPreview}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {incidents.length > pageSize && (
                <div className="p-3 border-t">
                  <TablePagination
                    currentPage={page}
                    pageSize={pageSize}
                    totalItems={incidents.length}
                    onPageChange={setPage}
                    onPageSizeChange={(sz) => {
                      setPageSize(sz)
                      setPage(1)
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
