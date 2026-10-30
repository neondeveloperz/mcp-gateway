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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  DatabaseIcon,
  PlusIcon,
  PlayIcon,
  RotateCwIcon,
  CheckIcon,
  CopyIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TerminalIcon,
  CheckCircle2Icon,
  LayersIcon,
  RadioIcon,
  SparklesIcon,
  EyeIcon,
  EyeOffIcon,
  Edit3Icon,
  ServerIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"
import { TablePagination } from "@/components/ui/table-pagination"
import { type SortOrder } from "@/components/ui/table-sort-header"
import {
  fetchDatabases,
  saveDatabase,
  deleteDatabase,
  testDatabaseConnection,
  executeDatabaseQuery,
  type DatabaseConfig,
} from "@/lib/mcp-service"

type EngineType = "postgres" | "mysql" | "sqlite" | "redis"

const ENGINE_DEFAULTS: Record<EngineType, { uri: string; placeholder: string; desc: string }> = {
  postgres: {
    uri: "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable",
    placeholder: "postgres://user:password@localhost:5432/dbname?sslmode=disable",
    desc: "PostgreSQL with SSL auto-negotiation, compatible with Supabase, Neon, AWS RDS, Cloud SQL",
  },
  mysql: {
    uri: "mysql://root:password@localhost:3306/my_database",
    placeholder: "mysql://user:password@localhost:3306/dbname",
    desc: "MySQL 5.7+, MySQL 8.0+, MariaDB, AWS Aurora, PlanetScale",
  },
  sqlite: {
    uri: "/Users/username/data/app.sqlite",
    placeholder: "/path/to/database.sqlite or sqlite:///path/to/database.db",
    desc: "Zero-dependency embedded SQLite file with bundled engine",
  },
  redis: {
    uri: "redis://:password@localhost:6379/0",
    placeholder: "redis://[:password@]localhost:6379[/db_number]",
    desc: "In-memory key-value store, cache, and message broker",
  },
}

export function DatabasesView() {
  const [databases, setDatabases] = React.useState<DatabaseConfig[]>([])
  const [loading, setLoading] = React.useState(false)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  // Form State
  const [editingDb, setEditingDb] = React.useState<DatabaseConfig | null>(null)
  const [engine, setEngine] = React.useState<EngineType>("postgres")
  const [alias, setAlias] = React.useState("")
  const [name, setName] = React.useState("")
  const [connectionUri, setConnectionUri] = React.useState("")
  const [securityTier, setSecurityTier] = React.useState<"read_only" | "hitl_mutation" | "unrestricted">("read_only")
  const [description, setDescription] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [testingConnection, setTestingConnection] = React.useState(false)
  const [testResult, setTestResult] = React.useState<string | null>(null)
  const [testSuccess, setTestSuccess] = React.useState<boolean | null>(null)

  // Sorting & Pagination State
  type DbSortKey = "name" | "alias" | "engine" | "securityTier"
  const [sortKey, setSortKey] = React.useState<DbSortKey | null>("name")
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(5)

  // SQL / Command Playground State
  const [selectedDbAlias, setSelectedDbAlias] = React.useState<string>("")
  const [playgroundSql, setPlaygroundSql] = React.useState("SELECT NOW() as current_time, version() as version;")
  const [queryRunning, setQueryRunning] = React.useState(false)
  const [queryResult, setQueryResult] = React.useState<Record<string, unknown> | null>(null)
  const [queryError, setQueryError] = React.useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = React.useState(false)

  const reloadDatabases = React.useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchDatabases()
      setDatabases(list)
      if (list.length > 0 && !selectedDbAlias) {
        setSelectedDbAlias(list[0].alias)
      }
    } catch (err) {
      toast.error(`Failed to load databases: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [selectedDbAlias])

  React.useEffect(() => {
    reloadDatabases()
  }, [reloadDatabases])

  const handleSort = (column: DbSortKey) => {
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

  const sortedDatabases = React.useMemo(() => {
    if (!sortKey || !sortOrder) return databases
    return [...databases].sort((a, b) => {
      let comparison = 0
      switch (sortKey) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "alias":
          comparison = a.alias.localeCompare(b.alias)
          break
        case "engine":
          comparison = a.engine.localeCompare(b.engine)
          break
        case "securityTier":
          comparison = a.securityTier.localeCompare(b.securityTier)
          break
      }
      return sortOrder === "asc" ? comparison : -comparison
    })
  }, [databases, sortKey, sortOrder])

  const paginatedDatabases = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedDatabases.slice(start, start + pageSize)
  }, [sortedDatabases, currentPage, pageSize])

  // Select database in playground and update default template
  const currentSelectedDb = databases.find((d) => d.alias === selectedDbAlias)

  const handleSelectPlaygroundDb = (targetAlias: string) => {
    setSelectedDbAlias(targetAlias)
    const target = databases.find((d) => d.alias === targetAlias)
    if (!target) return

    switch (target.engine) {
      case "postgres":
        setPlaygroundSql("SELECT NOW() as current_time, version() as pg_version;")
        break
      case "mysql":
        setPlaygroundSql("SELECT NOW() as current_time, VERSION() as mysql_version;")
        break
      case "sqlite":
        setPlaygroundSql("SELECT sqlite_version() as version, datetime('now') as current_time;")
        break
      case "redis":
        setPlaygroundSql("PING")
        break
    }
  }

  const openAddModal = () => {
    setEditingDb(null)
    setEngine("postgres")
    setAlias("")
    setName("")
    setConnectionUri(ENGINE_DEFAULTS.postgres.uri)
    setSecurityTier("read_only")
    setDescription("")
    setTestResult(null)
    setTestSuccess(null)
    setIsSheetOpen(true)
  }

  const handleSelectEngine = (eng: EngineType) => {
    setEngine(eng)
    if (!editingDb) {
      setConnectionUri(ENGINE_DEFAULTS[eng].uri)
    }
    setTestResult(null)
    setTestSuccess(null)
  }

  const openEditModal = (db: DatabaseConfig) => {
    setEditingDb(db)
    setEngine(db.engine as EngineType)
    setAlias(db.alias)
    setName(db.name)
    setConnectionUri(db.connectionUri)
    setSecurityTier(db.securityTier)
    setDescription(db.description || "")
    setTestResult(null)
    setTestSuccess(null)
    setIsSheetOpen(true)
  }

  const handleTestConnection = async (uri: string, engHint?: EngineType) => {
    if (!uri.trim()) {
      toast.error("Please enter a valid connection URI or path")
      return
    }
    setTestingConnection(true)
    setTestResult(null)
    setTestSuccess(null)
    try {
      const res = await testDatabaseConnection(uri.trim(), engHint || engine)
      setTestResult(res)
      setTestSuccess(true)
      toast.success("Database connection verified successfully!")
    } catch (err) {
      setTestResult(String(err))
      setTestSuccess(false)
      toast.error(`Connection failed: ${String(err)}`)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alias.trim() || !connectionUri.trim()) {
      toast.error("Alias and Connection URI are required")
      return
    }

    const cleanAlias = alias.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")
    const newDb: DatabaseConfig = {
      id: editingDb ? editingDb.id : `db-${Date.now()}`,
      alias: cleanAlias,
      name: name.trim() || cleanAlias,
      engine,
      connectionUri: connectionUri.trim(),
      securityTier,
      description: description.trim() || undefined,
      enabled: editingDb ? editingDb.enabled : true,
      createdAt: editingDb?.createdAt || new Date().toISOString(),
    }

    try {
      await saveDatabase(newDb)
      toast.success(`Database '${cleanAlias}' (${engine.toUpperCase()}) saved successfully`)
      setIsSheetOpen(false)
      reloadDatabases()
      if (!selectedDbAlias) {
        setSelectedDbAlias(cleanAlias)
      }
    } catch (err) {
      toast.error(`Save failed: ${String(err)}`)
    }
  }

  const handleDelete = async (id: string, dbAlias: string) => {
    if (!confirm(`Are you sure you want to disconnect database '${dbAlias}'?`)) return
    try {
      await deleteDatabase(id)
      toast.success(`Database '${dbAlias}' removed`)
      if (selectedDbAlias === dbAlias) {
        setSelectedDbAlias("")
      }
      reloadDatabases()
    } catch (err) {
      toast.error(`Delete failed: ${String(err)}`)
    }
  }

  const handleToggleEnable = async (db: DatabaseConfig) => {
    try {
      await saveDatabase({ ...db, enabled: !db.enabled })
      toast.success(`Database '${db.alias}' ${!db.enabled ? "enabled" : "disabled"}`)
      reloadDatabases()
    } catch (err) {
      toast.error(`Update failed: ${String(err)}`)
    }
  }

  const handleRunPlaygroundQuery = async () => {
    if (!selectedDbAlias) {
      toast.error("Please select a target database")
      return
    }
    if (!playgroundSql.trim()) {
      toast.error("Please enter a query or command")
      return
    }

    setQueryRunning(true)
    setQueryError(null)
    setQueryResult(null)

    try {
      const res = await executeDatabaseQuery(selectedDbAlias, playgroundSql.trim(), 50)
      setQueryResult(res)
      toast.success("Executed successfully")
    } catch (err) {
      const msg = String(err)
      setQueryError(msg)
      toast.error(`Execution error: ${msg}`)
    } finally {
      setQueryRunning(false)
    }
  }

  const maskUri = (uri: string) => {
    return uri.replace(/(:[^:@/]+)@/g, ":••••••••@")
  }

  const getEngineBadge = (eng: string) => {
    switch (eng.toLowerCase()) {
      case "postgres":
        return (
          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px] font-bold">
            PostgreSQL
          </Badge>
        )
      case "mysql":
        return (
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold">
            MySQL
          </Badge>
        )
      case "sqlite":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
            SQLite
          </Badge>
        )
      case "redis":
        return (
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] font-bold">
            Redis
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {eng.toUpperCase()}
          </Badge>
        )
    }
  }

  const getEngineIconBadge = (eng: string) => {
    switch (eng.toLowerCase()) {
      case "postgres":
        return (
          <div className="size-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs ring-1 ring-sky-500/20">
            PG
          </div>
        )
      case "mysql":
        return (
          <div className="size-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs ring-1 ring-amber-500/20">
            MY
          </div>
        )
      case "sqlite":
        return (
          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs ring-1 ring-emerald-500/20">
            SQL
          </div>
        )
      case "redis":
        return (
          <div className="size-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-xs ring-1 ring-rose-500/20">
            RD
          </div>
        )
      default:
        return (
          <div className="size-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center font-bold text-xs">
            DB
          </div>
        )
    }
  }

  const samplePrompt = `Use db_list_databases to see what databases we have. Then inspect the schema of '${databases[0]?.alias || "alias"}' with db_list_tables and run a read query to show the top 5 records.`

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(samplePrompt)
    setCopiedPrompt(true)
    toast.success("AI Prompt copied to clipboard!")
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  const readOnlyCount = databases.filter((d) => d.securityTier === "read_only").length
  const hitlCount = databases.filter((d) => d.securityTier === "hitl_mutation").length

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full min-w-0 max-w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20">
            <DatabaseIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Built-in Multi-Database Engine</h2>
              <Badge variant="outline" className="gap-1 border-sky-500/30 bg-sky-500/10 text-sky-400 font-semibold text-xs">
                {databases.length} Databases
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                {readOnlyCount} Read-Only Safe
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] text-amber-400 border-amber-500/20 bg-amber-500/5">
                {hitlCount} HITL Protected
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/20 bg-primary/5">
                Universal Router Active
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Universal Parameter routing (<code className="font-mono text-foreground font-semibold">db_query(database, sql)</code>) supporting PostgreSQL, MySQL/MariaDB, SQLite, and Redis with zero credential leakage.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 self-start md:self-auto shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={reloadDatabases}
            disabled={loading}
            className="cursor-pointer gap-1.5 text-xs h-8 px-2 sm:px-3"
            title="Refresh Databases"
          >
            <RotateCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={openAddModal}
            className="cursor-pointer gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs h-8 px-2 sm:px-3"
            title="Connect Database"
          >
            <PlusIcon className="size-3.5" />
            <span className="hidden sm:inline">Connect Database</span>
          </Button>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">
        {/* Left Column (7 cols): Database List & SQL Playground */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* Databases List Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <LayersIcon className="size-4 text-sky-500" />
                  Connected Databases
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  AI Targets by Universal Alias
                </span>
              </div>
              <CardDescription className="text-xs">
                Each database is exposed to AI agents as a target in <code className="font-mono font-semibold">db_query(database: &quot;alias&quot;, sql: &quot;...&quot;)</code>
              </CardDescription>

              {databases.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                  <span className="text-[11px] text-muted-foreground">Sort order:</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant={sortKey === "name" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleSort("name")}
                      className="h-6 text-[10px] px-2 cursor-pointer font-medium"
                    >
                      Name {sortKey === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                    </Button>
                    <Button
                      variant={sortKey === "alias" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleSort("alias")}
                      className="h-6 text-[10px] px-2 cursor-pointer font-medium"
                    >
                      Alias {sortKey === "alias" && (sortOrder === "asc" ? "↑" : "↓")}
                    </Button>
                    <Button
                      variant={sortKey === "engine" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleSort("engine")}
                      className="h-6 text-[10px] px-2 cursor-pointer font-medium"
                    >
                      Engine {sortKey === "engine" && (sortOrder === "asc" ? "↑" : "↓")}
                    </Button>
                    <Button
                      variant={sortKey === "securityTier" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleSort("securityTier")}
                      className="h-6 text-[10px] px-2 cursor-pointer font-medium"
                    >
                      Security {sortKey === "securityTier" && (sortOrder === "asc" ? "↑" : "↓")}
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedDatabases.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 rounded-lg border border-dashed border-border text-center space-y-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <DatabaseIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">No Databases Connected</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connect PostgreSQL, MySQL, SQLite, or Redis to allow AI agents to run queries and inspect schemas.
                    </p>
                  </div>
                  <Button size="sm" onClick={openAddModal} className="cursor-pointer gap-1 text-xs">
                    <PlusIcon className="size-3.5" />
                    Connect First Database
                  </Button>
                </div>
              ) : (
                paginatedDatabases.map((db) => (
                  <div
                    key={db.id}
                    className={`p-3.5 rounded-lg border transition-all space-y-2.5 ${
                      selectedDbAlias === db.alias
                        ? "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20"
                        : "border-border/70 bg-card/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {getEngineIconBadge(db.engine)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{db.name}</span>
                            {getEngineBadge(db.engine)}
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] bg-background border-border text-foreground font-semibold"
                            >
                              alias: {db.alias}
                            </Badge>
                          </div>
                          {db.description && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {db.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {db.securityTier === "read_only" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
                            <ShieldCheckIcon className="size-3" />
                            <span>STRICT READ-ONLY</span>
                          </Badge>
                        ) : db.securityTier === "hitl_mutation" ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] gap-1 font-semibold">
                            <ShieldAlertIcon className="size-3" />
                            <span>HITL MUTATION GUARD</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            DEVELOPMENT
                          </Badge>
                        )}

                        <Badge
                          variant="outline"
                          onClick={() => handleToggleEnable(db)}
                          className={`cursor-pointer text-[10px] ${
                            db.enabled ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground"
                          }`}
                        >
                          {db.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-xs">
                      <code className="font-mono text-[11px] text-muted-foreground truncate max-w-full min-w-0">
                        {maskUri(db.connectionUri)}
                      </code>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestConnection(db.connectionUri, db.engine as EngineType)}
                          className="cursor-pointer gap-1 text-[11px] h-7 px-2"
                          title="Test Connection"
                        >
                          <CheckCircle2Icon className="size-3 text-sky-400" />
                          <span className="hidden sm:inline">Test</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSelectPlaygroundDb(db.alias)}
                          className="cursor-pointer gap-1 text-[11px] h-7 px-2"
                          title="Query in Playground"
                        >
                          <PlayIcon className="size-3 text-emerald-400" />
                          <span className="hidden sm:inline">Query</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => openEditModal(db)}
                          className="size-7 cursor-pointer"
                          title="Edit Database"
                        >
                          <Edit3Icon className="size-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleDelete(db.id, db.alias)}
                          className="size-7 cursor-pointer text-destructive hover:bg-destructive/10"
                          title="Delete Database"
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {sortedDatabases.length > pageSize && (
                <TablePagination
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={sortedDatabases.length}
                  pageSizeOptions={[5, 10, 20]}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              )}
            </CardContent>
          </Card>

          {/* SQL / Redis Playground Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TerminalIcon className="size-4 text-emerald-500" />
                  <span>Interactive Playground ({currentSelectedDb ? currentSelectedDb.engine.toUpperCase() : "Universal"})</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Target DB:</span>
                  <select
                    value={selectedDbAlias}
                    onChange={(e) => handleSelectPlaygroundDb(e.target.value)}
                    className="bg-background text-foreground border border-input rounded px-2 py-0.5 text-xs font-mono font-semibold"
                  >
                    {databases.map((d) => (
                      <option key={d.alias} value={d.alias}>
                        {d.alias} ({d.engine.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <CardDescription className="text-xs">
                Test SQL queries or Redis commands directly through Gateway&apos;s security parser and connection pool
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <textarea
                  value={playgroundSql}
                  onChange={(e) => setPlaygroundSql(e.target.value)}
                  placeholder={
                    currentSelectedDb?.engine === "redis"
                      ? "PING or KEYS * or GET key or INFO keyspace"
                      : "SELECT * FROM table_name LIMIT 10;"
                  }
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-muted/40 p-2.5 font-mono text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Quick Templates:</span>
                  {currentSelectedDb?.engine === "redis" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("PING")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        PING
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("INFO keyspace")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Keyspace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SCAN 0 COUNT 20")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Sample Keys
                      </Button>
                    </>
                  ) : currentSelectedDb?.engine === "sqlite" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SELECT sqlite_version() as version, datetime('now') as server_time;")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Version
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%';")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Tables
                      </Button>
                    </>
                  ) : currentSelectedDb?.engine === "mysql" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SELECT NOW() as server_time, VERSION() as mysql_version;")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Version
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SELECT table_name, table_type FROM information_schema.tables WHERE table_schema=DATABASE();")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Tables
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SELECT NOW() as server_time, version();")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Version
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPlaygroundSql("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")}
                        className="h-6 text-[10px] px-1.5"
                      >
                        Tables
                      </Button>
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={handleRunPlaygroundQuery}
                  disabled={queryRunning || !selectedDbAlias}
                  className="cursor-pointer gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-7"
                >
                  <PlayIcon className="size-3" />
                  <span>{queryRunning ? "Executing..." : "Run Query"}</span>
                </Button>
              </div>

              {queryError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono">
                  {queryError}
                </div>
              )}

              {queryResult && (
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Engine: <strong className="text-foreground uppercase">{String(queryResult.engine || "sql")}</strong> | Result: <strong className="text-foreground">{String(queryResult.rowCount ?? queryResult.rowsAffected ?? (queryResult.result ? "data returned" : 0))}</strong>
                      {Boolean(queryResult.truncated) && " (Capped at limit)"}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-400">status: ok</span>
                  </div>
                  <pre className="rounded-lg border border-border/80 bg-background/90 p-3 font-mono text-[11px] text-foreground/90 overflow-x-auto max-h-60">
                    {JSON.stringify(queryResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 cols): Universal Parameter Guide & Security Tiers */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Universal Parameter Guide Card */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <SparklesIcon className="size-4 text-sky-400" />
                  Universal Parameter Architecture
                </CardTitle>
                <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-400/30">
                  Fixed 5 Tools
                </Badge>
              </div>
              <CardDescription className="text-xs">
                How LLMs discover, inspect, and query multiple database engines through a unified interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <RadioIcon className="size-3.5 text-sky-400" />
                  Active Universal Tools Exposed:
                </div>
                <ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
                  <li className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    <span>db_list_databases()</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    <span>db_list_tables(database, schema?)</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    <span>db_describe_table(database, table)</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    <span>db_query(database, sql, max_rows?)</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-foreground">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    <span>db_explain_query(database, sql)</span>
                  </li>
                </ul>
              </div>

              {/* Supported Engines Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded border border-border/40 bg-muted/20 space-y-0.5">
                  <div className="flex items-center gap-1 font-semibold text-sky-400">
                    <ServerIcon className="size-3" />
                    <span>PostgreSQL</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Schemas, TLS auto-neg, Supabase</p>
                </div>
                <div className="p-2 rounded border border-border/40 bg-muted/20 space-y-0.5">
                  <div className="flex items-center gap-1 font-semibold text-amber-400">
                    <ServerIcon className="size-3" />
                    <span>MySQL / MariaDB</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">MySQL 5.7/8.0, PlanetScale, Aurora</p>
                </div>
                <div className="p-2 rounded border border-border/40 bg-muted/20 space-y-0.5">
                  <div className="flex items-center gap-1 font-semibold text-emerald-400">
                    <DatabaseIcon className="size-3" />
                    <span>SQLite</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Embedded, file-based, zero setup</p>
                </div>
                <div className="p-2 rounded border border-border/40 bg-muted/20 space-y-0.5">
                  <div className="flex items-center gap-1 font-semibold text-rose-400">
                    <ZapIcon className="size-3" />
                    <span>Redis</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Raw commands, keyspaces, TTL</p>
                </div>
              </div>

              {/* Sample Prompt to try */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">
                    Try this Prompt in Cursor / Antigravity:
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPrompt}
                    className="cursor-pointer gap-1 text-[10px] h-6"
                  >
                    {copiedPrompt ? <CheckIcon className="size-2.5 text-emerald-400" /> : <CopyIcon className="size-2.5" />}
                    <span>Copy Prompt</span>
                  </Button>
                </div>
                <div className="p-2.5 rounded-lg border border-border/60 bg-background/80 font-sans text-xs text-foreground/90">
                  &ldquo;{samplePrompt}&rdquo;
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Tier Guardrails Card */}
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <ShieldCheckIcon className="size-4" />
                Database Security Tiers
              </CardTitle>
              <CardDescription className="text-xs">
                Zero-trust policies enforcing strict database isolation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <ShieldCheckIcon className="size-3.5" />
                  <span>Strict Read-Only (Production Safe)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Gateway blocks write keywords (INSERT, UPDATE, DELETE, DROP) and Redis mutations (SET, DEL, FLUSHALL) before sending.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                  <ShieldAlertIcon className="size-3.5" />
                  <span>HITL Mutation Guard (Staging Mode)</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Read queries run instantly. Destructive or mutation queries pause and issue an in-band ticket (<code className="font-mono text-foreground font-semibold">#SEC-XXXX</code>) in your IDE chat.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-border/40 bg-muted/20 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <TerminalIcon className="size-3.5 text-muted-foreground" />
                  <span>Safety Guardrails</span>
                </div>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
                  <li>Query Timeout: 10s maximum</li>
                  <li>Result Cap: 500 rows maximum to protect LLM context</li>
                  <li>Password Redaction: URIs masked across all engines</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add / Edit Database Sheet Modal */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-lg w-full flex flex-col p-6 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold flex items-center gap-2">
              <DatabaseIcon className="size-4 text-sky-400" />
              <span>{editingDb ? `Edit Database (${engine.toUpperCase()})` : "Connect Database Engine"}</span>
            </SheetTitle>
            <SheetDescription className="text-xs">
              Configure a database connection to expose to AI agents through the Universal Parameter router
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-4 flex-1">
            {/* Engine Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Database Engine</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "postgres", name: "PostgreSQL", badge: "PG", color: "sky" },
                    { id: "mysql", name: "MySQL / MariaDB", badge: "MY", color: "amber" },
                    { id: "sqlite", name: "SQLite", badge: "SQL", color: "emerald" },
                    { id: "redis", name: "Redis", badge: "RD", color: "rose" },
                  ] as const
                ).map((eng) => (
                  <div
                    key={eng.id}
                    onClick={() => handleSelectEngine(eng.id)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-2.5 ${
                      engine === eng.id
                        ? "border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/30"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <span className="font-bold text-xs">{eng.badge}</span>
                    <div className="text-left">
                      <p className="text-xs font-semibold leading-tight">{eng.name}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {ENGINE_DEFAULTS[engine].desc}
              </p>
            </div>

            {/* Alias */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <span>Database Alias (Slug for AI)</span>
                <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. prod_billing, staging_app, local_cache"
                value={alias}
                onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                required
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                AI will target this database with: <code className="font-mono text-foreground">db_query(database: &quot;{alias || "alias"}&quot;, sql: &quot;...&quot;)</code>
              </p>
            </div>

            {/* Display Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Display Name</label>
              <Input
                placeholder="e.g. Production Billing Database"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Connection URI / Path */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <span>{engine === "sqlite" ? "Database File Path" : "Connection URI"}</span>
                  <span className="text-destructive">*</span>
                </label>
                {engine !== "sqlite" && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                )}
              </div>
              <Input
                type={engine === "sqlite" || showPassword ? "text" : "password"}
                placeholder={ENGINE_DEFAULTS[engine].placeholder}
                value={connectionUri}
                onChange={(e) => setConnectionUri(e.target.value)}
                required
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {engine === "sqlite"
                  ? "Absolute file path (e.g. /Users/name/data/db.sqlite)"
                  : "Passwords are encrypted and redacted in all traffic logs."}
              </p>
            </div>

            {/* Security Tier */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Security Tier & Guardrails</label>
              <div className="grid grid-cols-1 gap-2">
                <div
                  onClick={() => setSecurityTier("read_only")}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer space-y-0.5 ${
                    securityTier === "read_only"
                      ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-emerald-400">Strict Read-Only</span>
                    <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                      Recommended for Prod
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Blocks all write and DDL operations. Safe for production databases.
                  </p>
                </div>

                <div
                  onClick={() => setSecurityTier("hitl_mutation")}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer space-y-0.5 ${
                    securityTier === "hitl_mutation"
                      ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-amber-400">HITL Mutation Guard</span>
                    <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">
                      Staging / Test
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Read queries run instantly. Mutations require explicit In-Band ticket approval (#SEC-XXXX).
                  </p>
                </div>

                <div
                  onClick={() => setSecurityTier("unrestricted")}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer space-y-0.5 ${
                    securityTier === "unrestricted"
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <span className="font-semibold text-xs text-foreground">Unrestricted</span>
                  <p className="text-[11px] text-muted-foreground">
                    Direct execution without guardrails. Use only for sandbox/throwaway databases.
                  </p>
                </div>
              </div>
            </div>

            {/* Description for AI */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Description (AI Prompt Context)</label>
              <Input
                placeholder="e.g. Contains user sessions, cart cache, and telemetry counters"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Injected into <code className="font-mono text-foreground">db_list_databases</code> so AI knows when to query this database.
              </p>
            </div>

            {/* Test Connection Button & Status */}
            <div className="p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Verify Connection</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestConnection(connectionUri, engine)}
                  disabled={testingConnection}
                  className="cursor-pointer gap-1.5 text-xs h-7"
                >
                  <CheckCircle2Icon className="size-3 text-sky-400" />
                  <span>{testingConnection ? "Pinging..." : "Test Connection"}</span>
                </Button>
              </div>

              {testResult && (
                <div
                  className={`p-2 rounded text-xs font-mono break-all ${
                    testSuccess
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : "bg-destructive/10 text-destructive border border-destructive/30"
                  }`}
                >
                  {testResult}
                </div>
              )}
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSheetOpen(false)}
                className="cursor-pointer text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs h-8"
              >
                {editingDb ? "Update Database" : "Save Database"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
