import { TokenManager } from "@/components/tokens/token-manager"

export function ApiKeysView() {
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 w-full">
      <TokenManager />
    </div>
  )
}

