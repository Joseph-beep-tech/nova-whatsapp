import { format } from 'date-fns'
import { Database, HardDrive, Layers, Calendar, Hash } from 'lucide-react'

interface CollectionStats {
  collectionName: string
  vectorCount: number
  indexedVectors: number
  storageSizeBytes?: number
  lastUpdatedAt?: string
}

interface MemoryStatsCardProps {
  stats: CollectionStats
}

interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: string | undefined
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  if (!value) return null

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-surface-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-500">{label}</p>
        <p className="text-sm text-surface-900 truncate">{value}</p>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

export function MemoryStatsCard({ stats }: MemoryStatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-surface-200 p-4">
      <h3 className="text-sm font-medium text-surface-900 mb-3">
        Memory Statistics
      </h3>
      <div className="space-y-1">
        <InfoRow
          icon={<Layers className="w-4 h-4" />}
          label="Collection"
          value={stats.collectionName}
        />
        <InfoRow
          icon={<Database className="w-4 h-4" />}
          label="Vector Count"
          value={formatNumber(stats.vectorCount)}
        />
        <InfoRow
          icon={<Hash className="w-4 h-4" />}
          label="Indexed Vectors"
          value={formatNumber(stats.indexedVectors)}
        />
        <InfoRow
          icon={<HardDrive className="w-4 h-4" />}
          label="Storage Size"
          value={stats.storageSizeBytes ? formatBytes(stats.storageSizeBytes) : undefined}
        />
        <InfoRow
          icon={<Calendar className="w-4 h-4" />}
          label="Last Updated"
          value={
            stats.lastUpdatedAt
              ? format(new Date(stats.lastUpdatedAt), 'MMM d, yyyy HH:mm')
              : undefined
          }
        />
      </div>
    </div>
  )
}
