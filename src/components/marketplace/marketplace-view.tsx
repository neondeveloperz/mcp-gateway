import * as React from "react"
import {
  SearchIcon,
  CheckCircle2Icon,
  DownloadIcon,
  LayersIcon,
  ExternalLinkIcon,
  TerminalIcon,
  SparklesIcon,
  Trash2Icon,
  RotateCwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  fetchDiscoveredServers,
  addCustomServer,
  deleteCustomServer,
  type McpServer,
  subscribeToServers,
} from "@/lib/mcp-service"
import { TablePagination } from "@/components/ui/table-pagination"

export interface RegistryPackage {
  id: string
  name: string
  identifier: string
  description: string
  category: "Developer Tools" | "Databases & Storage" | "Search & Web" | "DevOps & Cloud" | "Productivity"
  transport: "stdio" | "sse"
  command: string
  args: string[]
  envRequirements?: { key: string; label: string; placeholder: string; required: boolean; secret?: boolean }[]
  argRequirements?: { index: number; label: string; placeholder: string; defaultValue: string }[]
  stars: string
  downloads: string
  official: boolean
  docsUrl: string
}

export const REGISTRY_PACKAGES: RegistryPackage[] = [
  {
    id: "server-github",
    name: "GitHub",
    identifier: "@modelcontextprotocol/server-github",
    description: "Browse repositories, manage issues, view pull requests, inspect commits, and manage branches directly from AI.",
    category: "Developer Tools",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    envRequirements: [
      {
        key: "GITHUB_PERSONAL_ACCESS_TOKEN",
        label: "GitHub Personal Access Token (PAT)",
        placeholder: "ghp_xxxxxxxxxxxxxxxxxxxxxx",
        required: true,
        secret: true,
      },
    ],
    stars: "4.9",
    downloads: "280k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
  },
  {
    id: "server-brave-search",
    name: "Brave Search",
    identifier: "@modelcontextprotocol/server-brave-search",
    description: "Privacy-focused web search engine and local POI entity discovery via the official Brave Search API.",
    category: "Search & Web",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    envRequirements: [
      {
        key: "BRAVE_API_KEY",
        label: "Brave Search API Key",
        placeholder: "BSAxxxxxxxxxxxxxxxxxxxx",
        required: true,
        secret: true,
      },
    ],
    stars: "4.8",
    downloads: "195k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
  },
  {
    id: "server-filesystem",
    name: "Filesystem",
    identifier: "@modelcontextprotocol/server-filesystem",
    description: "Secure, sandboxed access to local files and project folders with strictly configurable read/write boundaries.",
    category: "Developer Tools",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users"],
    argRequirements: [
      {
        index: 2,
        label: "Allowed Directory Root Path",
        placeholder: "/Users/yourname/projects",
        defaultValue: "/Users",
      },
    ],
    stars: "4.9",
    downloads: "340k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  },
  {
    id: "server-postgres",
    name: "PostgreSQL",
    identifier: "@modelcontextprotocol/server-postgres",
    description: "Inspect schemas, discover table relationships, and safely execute parameterized SQL queries on PostgreSQL.",
    category: "Databases & Storage",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/postgres"],
    argRequirements: [
      {
        index: 2,
        label: "PostgreSQL Connection URI",
        placeholder: "postgresql://user:password@localhost:5432/mydb",
        defaultValue: "postgresql://localhost:5432/postgres",
      },
    ],
    stars: "4.7",
    downloads: "210k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
  },
  {
    id: "server-sqlite",
    name: "SQLite Database",
    identifier: "mcp-server-sqlite",
    description: "Read-only inspection, schema reflection, and query execution against local SQLite database files.",
    category: "Databases & Storage",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-sqlite", "--db-path", "data.db"],
    argRequirements: [
      {
        index: 2,
        label: "SQLite File Path",
        placeholder: "/path/to/database.db",
        defaultValue: "data.db",
      },
    ],
    stars: "4.8",
    downloads: "165k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
  },
  {
    id: "server-docker",
    name: "Docker Engine",
    identifier: "mcp-server-docker",
    description: "Inspect running Docker containers, image registries, service logs, and manage local Docker Compose stacks.",
    category: "DevOps & Cloud",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-docker"],
    stars: "4.9",
    downloads: "145k",
    official: false,
    docsUrl: "https://github.com/quantalogic/docker-mcp",
  },
  {
    id: "server-fetch",
    name: "Web Content Fetcher",
    identifier: "mcp-server-fetch",
    description: "Fetch web pages and convert HTML directly into clean, optimized Markdown for prompt context efficiency.",
    category: "Search & Web",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-fetch"],
    stars: "4.9",
    downloads: "290k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  },
  {
    id: "server-memory",
    name: "Memory Knowledge Graph",
    identifier: "@modelcontextprotocol/server-memory",
    description: "Graph-based persistent memory enabling AI agents to store facts, user preferences, and project context across chats.",
    category: "Productivity",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    stars: "4.9",
    downloads: "310k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
  {
    id: "server-slack",
    name: "Slack Workspaces",
    identifier: "@modelcontextprotocol/server-slack",
    description: "Access Slack channels, search conversation history, read user threads, and send messages securely.",
    category: "Productivity",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    envRequirements: [
      {
        key: "SLACK_BOT_TOKEN",
        label: "Slack Bot Token (xoxb-...)",
        placeholder: "xoxb-xxxxxxxxxxxxxxxx",
        required: true,
        secret: true,
      },
      {
        key: "SLACK_TEAM_ID",
        label: "Slack Workspace Team ID",
        placeholder: "T0XXXXXXXXX",
        required: true,
      },
    ],
    stars: "4.6",
    downloads: "125k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
  },
  {
    id: "server-puppeteer",
    name: "Puppeteer Automation",
    identifier: "@modelcontextprotocol/server-puppeteer",
    description: "Automate Chromium browser sessions, inspect web apps, click UI elements, and take high-resolution screenshots.",
    category: "Search & Web",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    stars: "4.8",
    downloads: "180k",
    official: true,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
  },
  {
    id: "server-gitlab",
    name: "GitLab Enterprise",
    identifier: "@modelcontextprotocol/server-gitlab",
    description: "Full integration with GitLab projects, merge requests, issues, commits, and CI/CD pipelines.",
    category: "Developer Tools",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gitlab"],
    envRequirements: [
      {
        key: "GITLAB_PERSONAL_ACCESS_TOKEN",
        label: "GitLab Personal Access Token",
        placeholder: "glpat-xxxxxxxxxxxxxxxxxxxx",
        required: true,
        secret: true,
      },
    ],
    stars: "4.7",
    downloads: "92k",
    official: false,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gitlab",
  },
  {
    id: "server-redis",
    name: "Redis Cache Engine",
    identifier: "mcp-server-redis",
    description: "Connect to Redis in-memory clusters, inspect key namespaces, TTLs, and test cache operations.",
    category: "Databases & Storage",
    transport: "stdio",
    command: "uvx",
    args: ["mcp-server-redis", "--url", "redis://localhost:6379"],
    argRequirements: [
      {
        index: 2,
        label: "Redis Connection URL",
        placeholder: "redis://localhost:6379",
        defaultValue: "redis://localhost:6379",
      },
    ],
    stars: "4.7",
    downloads: "88k",
    official: false,
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/redis",
  },
]

export function MarketplaceView() {
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [selectedPackage, setSelectedPackage] = React.useState<RegistryPackage | null>(null)
  const [envValues, setEnvValues] = React.useState<Record<string, string>>({})
  const [argValues, setArgValues] = React.useState<Record<number, string>>({})
  const [isInstalling, setIsInstalling] = React.useState<boolean>(false)
  const [currentPage, setCurrentPage] = React.useState<number>(1)
  const [pageSize, setPageSize] = React.useState<number>(6)

  React.useEffect(() => {
    fetchDiscoveredServers().then(setServers)
    const unsub = subscribeToServers(setServers)
    return unsub
  }, [])

  const installedNames = React.useMemo(() => {
    return new Set(servers.map((s) => s.name.toLowerCase()))
  }, [servers])

  const categories = ["All", "Developer Tools", "Databases & Storage", "Search & Web", "DevOps & Cloud", "Productivity"]

  const filteredPackages = React.useMemo(() => {
    return REGISTRY_PACKAGES.filter((pkg) => {
      const matchesCategory = selectedCategory === "All" || pkg.category === selectedCategory
      const matchesSearch =
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.identifier.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  const paginatedPackages = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredPackages.slice(start, start + pageSize)
  }, [filteredPackages, currentPage, pageSize])

  const handleOpenInstall = (pkg: RegistryPackage) => {
    setSelectedPackage(pkg)
    const initialEnv: Record<string, string> = {}
    pkg.envRequirements?.forEach((req) => {
      initialEnv[req.key] = ""
    })
    setEnvValues(initialEnv)

    const initialArgs: Record<number, string> = {}
    pkg.argRequirements?.forEach((req) => {
      initialArgs[req.index] = req.defaultValue
    })
    setArgValues(initialArgs)
  }

  const handleConfirmInstall = async () => {
    if (!selectedPackage) return

    // Validation
    if (selectedPackage.envRequirements) {
      for (const req of selectedPackage.envRequirements) {
        if (req.required && !envValues[req.key]?.trim()) {
          toast.error(`Required field missing: ${req.label}`)
          return
        }
      }
    }

    setIsInstalling(true)
    try {
      const finalArgs = [...selectedPackage.args]
      if (selectedPackage.argRequirements) {
        for (const req of selectedPackage.argRequirements) {
          const val = argValues[req.index] || req.defaultValue
          if (req.index < finalArgs.length) {
            finalArgs[req.index] = val
          } else {
            finalArgs.push(val)
          }
        }
      }

      addCustomServer({
        name: selectedPackage.name,
        transport: "stdio",
        command: selectedPackage.command,
        args: finalArgs,
        url: "",
        env: Object.keys(envValues).length > 0 ? envValues : undefined,
      })

      toast.success(`${selectedPackage.name} MCP Server connected successfully!`, {
        description: `Added to Gateway Core with ${selectedPackage.command} runtime.`,
      })
      setSelectedPackage(null)
    } catch (err) {
      toast.error(`Failed to install server: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUninstall = async (name: string) => {
    const existing = servers.find((s) => s.name.toLowerCase() === name.toLowerCase())
    if (!existing) return
    try {
      deleteCustomServer(existing.id)
      toast.info(`Removed ${name} from Gateway servers`)
    } catch (err) {
      toast.error(`Failed to remove server: ${err}`)
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full min-w-0 max-w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <LayersIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight">MCP Hub & Package Registry</h2>
              <Badge variant="outline" className="border-primary/30 text-primary text-xs gap-1 font-mono">
                <SparklesIcon className="size-3" />
                Curated & Verified
              </Badge>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs">
                {REGISTRY_PACKAGES.length} Official Servers
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Discover, install, and connect verified Model Context Protocol (MCP) servers in 1-click without manual CLI configurations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchDiscoveredServers().then(setServers)}
            className="cursor-pointer gap-1.5 h-8 text-xs px-2.5"
            title="Refresh Registry"
          >
            <RotateCwIcon className="size-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCategory(cat)
                setCurrentPage(1)
              }}
              className="h-8 text-xs rounded-full px-3 whitespace-nowrap cursor-pointer shrink-0"
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Search registry..."
            className="pl-8 h-8 text-xs bg-background/50"
          />
        </div>
      </div>

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedPackages.map((pkg) => {
          const isInstalled = installedNames.has(pkg.name.toLowerCase())
          return (
            <div
              key={pkg.id}
              className="flex flex-col justify-between rounded-xl border border-border/80 bg-card/40 p-4 shadow-xs hover:border-border transition-all duration-200"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                      <TerminalIcon className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-sm tracking-tight text-foreground">{pkg.name}</h3>
                        {pkg.official && (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] px-1.5 py-0 h-4">
                            Official
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[190px]">
                        {pkg.identifier}
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                    {pkg.category}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {pkg.description}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-border/50 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-[11px]">
                  <span>⭐ {pkg.stars}</span>
                  <span>•</span>
                  <span>{pkg.downloads} installs</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={pkg.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="View Documentation"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </a>

                  {isInstalled ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs gap-1 h-7 px-2">
                        <CheckCircle2Icon className="size-3" />
                        Connected
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUninstall(pkg.name)}
                        className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Disconnect Server"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleOpenInstall(pkg)}
                      className="h-7 text-xs gap-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    >
                      <DownloadIcon className="size-3" />
                      <span>Connect</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {filteredPackages.length > pageSize && (
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredPackages.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz)
            setCurrentPage(1)
          }}
        />
      )}

      {/* Install Sheet */}
      {selectedPackage && (
        <Sheet open={true} onOpenChange={() => setSelectedPackage(null)}>
          <SheetContent className="sm:max-w-md w-full flex flex-col p-0">
            <SheetHeader className="p-5 border-b border-border/60">
              <SheetTitle className="flex items-center gap-2 text-base font-bold">
                <TerminalIcon className="size-4 text-primary" />
                Connect {selectedPackage.name}
              </SheetTitle>
              <SheetDescription className="text-xs">
                Configure runtime arguments and environment credentials for {selectedPackage.identifier}.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Runtime Command</Label>
                <div className="rounded-md bg-muted/60 p-2.5 font-mono text-xs text-foreground/90 border border-border/70 break-all select-all">
                  {selectedPackage.command} {selectedPackage.args.join(" ")}
                </div>
              </div>

              {selectedPackage.argRequirements && selectedPackage.argRequirements.map((req) => (
                <div key={req.index} className="space-y-1.5">
                  <Label className="text-xs font-medium">{req.label}</Label>
                  <Input
                    value={argValues[req.index] ?? req.defaultValue}
                    onChange={(e) => setArgValues({ ...argValues, [req.index]: e.target.value })}
                    placeholder={req.placeholder}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              ))}

              {selectedPackage.envRequirements && selectedPackage.envRequirements.map((req) => (
                <div key={req.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">{req.label}</Label>
                    {req.required && (
                      <span className="text-[10px] text-amber-400 font-mono">Required</span>
                    )}
                  </div>
                  <Input
                    type={req.secret ? "password" : "text"}
                    value={envValues[req.key] || ""}
                    onChange={(e) => setEnvValues({ ...envValues, [req.key]: e.target.value })}
                    placeholder={req.placeholder}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2 bg-card/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPackage(null)}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmInstall}
                disabled={isInstalling}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground cursor-pointer"
              >
                <DownloadIcon className="size-3.5" />
                {isInstalling ? "Connecting..." : "Add to Gateway"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
