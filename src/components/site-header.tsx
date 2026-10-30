import * as React from "react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Maximize2Icon, Minimize2Icon } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"

export function SiteHeader({ title = "Overview" }: { title?: string }) {
  const [isMaximized, setIsMaximized] = React.useState(false)

  const toggleMaximize = async () => {
    try {
      const win = getCurrentWindow()
      await win.toggleMaximize()
      const max = await win.isMaximized()
      setIsMaximized(max)
    } catch {
      // ignore
    }
  }

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center justify-between px-4 lg:gap-2 lg:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mx-2 h-4 data-vertical:self-auto shrink-0"
          />
          <h1 className="text-base font-semibold tracking-tight truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-mono hidden sm:inline">Gateway Core: 127.0.0.1:8080</span>
            <span className="font-mono sm:hidden">:8080</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMaximize}
            className="size-7 cursor-pointer text-muted-foreground hover:text-foreground"
            title={isMaximized ? "Restore Window" : "Maximize Window"}
          >
            {isMaximized ? (
              <Minimize2Icon className="size-3.5" />
            ) : (
              <Maximize2Icon className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
