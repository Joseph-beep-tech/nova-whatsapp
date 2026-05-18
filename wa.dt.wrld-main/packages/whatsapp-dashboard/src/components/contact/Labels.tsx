import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { Label } from '@/types'
import { cn } from '@/lib/utils'

interface LabelsProps {
  labels: Label[]
  availableLabels?: Label[]
  onAdd?: (labelId: string) => void
  onRemove?: (labelId: string) => void
  editable?: boolean
}

const defaultLabels: Label[] = [
  { id: '1', name: 'Important', color: '#ef4444' },
  { id: '2', name: 'VIP', color: '#f59e0b' },
  { id: '3', name: 'Follow up', color: '#3b82f6' },
  { id: '4', name: 'New', color: '#22c55e' },
  { id: '5', name: 'Feedback', color: '#8b5cf6' },
]

export function Labels({
  labels,
  availableLabels = defaultLabels,
  onAdd,
  onRemove,
  editable = true,
}: LabelsProps) {
  const [showPicker, setShowPicker] = useState(false)

  const unusedLabels = availableLabels.filter(
    (al) => !labels.some((l) => l.id === al.id)
  )

  return (
    <div className="space-y-2">
      {/* Current labels */}
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            {editable && onRemove && (
              <button
                onClick={() => onRemove(label.id)}
                className="hover:bg-white/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* Add button */}
        {editable && unusedLabels.length > 0 && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full',
              'border border-dashed border-border text-muted-foreground',
              'hover:border-border hover:text-foreground'
            )}
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Label picker dropdown */}
      {showPicker && (
        <div className="bg-card dark:bg-card border border-border/40 rounded-lg shadow-lg p-2 space-y-1">
          {unusedLabels.map((label) => (
            <button
              key={label.id}
              onClick={() => {
                onAdd?.(label.id)
                setShowPicker(false)
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded hover:bg-secondary"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
