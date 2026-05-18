import { useState } from 'react'
import { Download, AlertCircle } from 'lucide-react'
import { Button } from '@/components/common'
import { useMemoryStore } from '@/stores/memoryStore'
import { parseChatKey } from '@/types'

interface MemoryExportButtonProps {
  chatId: string // composite key (identifier:platform)
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Trigger browser download of JSON data
function downloadJSON(data: unknown, filename: string) {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function MemoryExportButton({
  chatId,
  variant = 'secondary',
  size = 'md',
  className,
}: MemoryExportButtonProps) {
  const exportMemories = useMemoryStore((state) => state.exportMemories)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      const { identifier, platform } = parseChatKey(chatId)
      const result = await exportMemories(identifier, platform)

      if (!result) {
        throw new Error('Export failed: No data returned')
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `memory-export-${chatId}-${timestamp}.json`

      // Trigger download
      downloadJSON(result, filename)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export memories'
      setError(message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleExport}
        isLoading={isExporting}
        leftIcon={!isExporting ? <Download className="w-4 h-4" /> : undefined}
        disabled={!chatId || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export Memories'}
      </Button>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Export Failed</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
