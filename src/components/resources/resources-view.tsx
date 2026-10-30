import * as React from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  FolderCodeIcon,
  MessageSquareCodeIcon,
  SearchIcon,
  ServerIcon,
  CopyIcon,
  EyeIcon,
  FileCodeIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  fetchDiscoveredResources,
  fetchDiscoveredPrompts,
  fetchDiscoveredServers,
  type McpResource,
  type McpPrompt,
  type McpServer,
} from "@/lib/mcp-service"

export function ResourcesView() {
  const [resources, setResources] = React.useState<McpResource[]>([])
  const [prompts, setPrompts] = React.useState<McpPrompt[]>([])
  const [servers, setServers] = React.useState<McpServer[]>([])
  const [search, setSearch] = React.useState("")
  const [selectedServer, setSelectedServer] = React.useState<string>("all")
  const [activeResource, setActiveResource] = React.useState<McpResource | null>(null)
  const [isResourceOpen, setIsResourceOpen] = React.useState(false)

  React.useEffect(() => {
    setResources(fetchDiscoveredResources())
    setPrompts(fetchDiscoveredPrompts())
    fetchDiscoveredServers().then(setServers)
  }, [])

  const filteredResources = resources.filter((res) => {
    const matchSearch =
      res.name.toLowerCase().includes(search.toLowerCase()) ||
      res.uri.toLowerCase().includes(search.toLowerCase()) ||
      res.description.toLowerCase().includes(search.toLowerCase())
    const matchServer = selectedServer === "all" || res.server === selectedServer
    return matchSearch && matchServer
  })

  const filteredPrompts = prompts.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    const matchServer = selectedServer === "all" || p.server === selectedServer
    return matchSearch && matchServer
  })

  const handlePreviewResource = (res: McpResource) => {
    setActiveResource(res)
    setIsResourceOpen(true)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} Copied to Clipboard`)
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <FolderCodeIcon className="size-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Resources & Prompt Templates</h2>
              <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary font-semibold text-xs">
                {resources.length} Resources · {prompts.length} Prompts
              </Badge>
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                MCP Protocol Direct Access
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Browse structured context attachments, live schemas, telemetry buffers, and reusable prompt templates
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-44 md:w-56">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search URI or prompt..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs font-mono"
            />
          </div>

          <select
            value={selectedServer}
            onChange={(e) => setSelectedServer(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium outline-none cursor-pointer"
          >
            <option value="all">All Servers</option>
            {servers.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resources" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-9 max-w-sm">
          <TabsTrigger value="resources" className="cursor-pointer gap-1.5 text-xs">
            <FolderCodeIcon className="size-3.5" />
            <span>MCP Resources ({resources.length})</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="cursor-pointer gap-1.5 text-xs">
            <MessageSquareCodeIcon className="size-3.5" />
            <span>Prompt Templates ({prompts.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Resources */}
        <TabsContent value="resources" className="space-y-4">
          <Card className="flex flex-col">
            <CardHeader className="flex flex-col gap-3 pb-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileCodeIcon className="size-4 text-primary" />
                  Available Model Context Protocol Resources
                </CardTitle>
                <CardDescription className="text-xs">
                  URI-addressable documents and data streams exposed to LLM context
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-t hover:bg-transparent">
                      <TableHead className="w-60 text-xs font-semibold">Resource URI</TableHead>
                      <TableHead className="w-48 text-xs font-semibold">Name</TableHead>
                      <TableHead className="w-28 text-xs font-semibold">Server</TableHead>
                      <TableHead className="w-32 text-xs font-semibold">MIME Type</TableHead>
                      <TableHead className="text-xs font-semibold">Description</TableHead>
                      <TableHead className="w-24 text-right text-xs font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-16 text-center text-xs text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FolderCodeIcon className="size-8 text-muted-foreground/60" />
                            <span className="font-semibold text-foreground text-sm">No MCP Resources Available</span>
                            <p className="text-xs text-muted-foreground max-w-sm">
                              Resources will appear once you configure an MCP server that exposes context URIs.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredResources.map((res) => (
                        <TableRow key={res.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <span className="flex items-center gap-1.5">
                              <FileCodeIcon className="size-3.5" />
                              {res.uri}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {res.name}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="flex items-center gap-1 text-foreground">
                              <ServerIcon className="size-3 text-primary" />
                              {res.server}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {res.mimeType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                            {res.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePreviewResource(res)}
                              className="h-7 px-2 text-[11px] cursor-pointer gap-1"
                            >
                              <EyeIcon className="size-3" />
                              <span>View</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t border-border/40 text-xs text-muted-foreground">
              <span>Read access verified via MCP resources/read</span>
              <span>Total Resources: {filteredResources.length}</span>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Tab 2: Prompts */}
        <TabsContent value="prompts" className="space-y-4">
          {filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/10 p-12 text-center">
              <MessageSquareCodeIcon className="size-8 text-muted-foreground/60 mb-2" />
              <h3 className="text-sm font-semibold text-foreground">No Prompt Templates Available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Prompts will appear here once you register MCP servers providing prompt capabilities.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPrompts.map((prompt) => (
                <Card key={prompt.id} className="flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                        <ServerIcon className="size-2.5 text-primary" />
                        {prompt.server}
                      </Badge>
                      <SparklesIcon className="size-3.5 text-amber-400" />
                    </div>
                    <CardTitle className="text-sm font-bold font-mono tracking-tight pt-1">
                      {prompt.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {prompt.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">Required Arguments:</span>
                    <div className="space-y-1">
                      {prompt.arguments.map((arg) => (
                        <div
                          key={arg.name}
                          className="flex items-center justify-between text-xs rounded border bg-muted/20 px-2 py-1"
                        >
                          <span className="font-mono text-foreground font-medium">{arg.name}</span>
                          {arg.required && (
                            <span className="text-[10px] text-amber-500 font-semibold">required</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-border/40 pt-3 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(prompt.name, "Prompt Name")}
                      className="h-7 px-2 text-xs cursor-pointer gap-1"
                    >
                      <CopyIcon className="size-3" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        toast.info(`Prompt Activated: ${prompt.name}`, {
                          description: `Prepared arguments for server ${prompt.server}`,
                        })
                      }
                      className="h-7 px-2.5 text-xs cursor-pointer bg-primary text-primary-foreground font-medium"
                    >
                      <span>Use Template</span>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Resource Content Preview Sheet */}
      <Sheet open={isResourceOpen} onOpenChange={setIsResourceOpen}>
        <SheetContent className="sm:max-w-xl w-full flex flex-col p-0 overflow-y-auto">
          {activeResource && (
            <div className="flex flex-col h-full">
              <SheetHeader className="p-5 border-b border-border/60">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="gap-1 font-mono text-xs">
                    <ServerIcon className="size-3 text-primary" />
                    {activeResource.server}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                    {activeResource.mimeType}
                  </Badge>
                </div>
                <SheetTitle className="text-base font-bold font-mono tracking-tight pt-2">
                  {activeResource.uri}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {activeResource.description}
                </SheetDescription>
              </SheetHeader>

              <div className="p-5 flex-1 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Resource Payload Preview</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(activeResource.content || "", "Resource Content")}
                    className="h-6 px-2 text-[11px] cursor-pointer gap-1"
                  >
                    <CopyIcon className="size-3" />
                    Copy
                  </Button>
                </div>

                <pre className="p-4 rounded-lg border bg-muted/40 font-mono text-xs overflow-x-auto text-foreground max-h-96 leading-relaxed">
                  {activeResource.content || "Empty resource content"}
                </pre>
              </div>

              <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={() => setIsResourceOpen(false)}
                  className="cursor-pointer text-xs h-8"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
