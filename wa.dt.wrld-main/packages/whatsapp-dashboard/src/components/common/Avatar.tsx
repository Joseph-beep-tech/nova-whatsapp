import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'offline' | 'away'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

const statusClasses = {
  online: 'bg-green-500',
  offline: 'bg-muted-foreground',
  away: 'bg-yellow-500',
}

const statusSizeClasses = {
  sm: 'w-2 h-2 right-0 bottom-0',
  md: 'w-2.5 h-2.5 right-0 bottom-0',
  lg: 'w-3 h-3 right-0.5 bottom-0.5',
  xl: 'w-4 h-4 right-1 bottom-1',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ]
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

export function Avatar({ name, imageUrl, size = 'md', status, className }: AvatarProps) {
  const initials = getInitials(name)
  const bgColor = getColorFromName(name)

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={cn(
            sizeClasses[size],
            'rounded-full object-cover'
          )}
        />
      ) : (
        <div
          className={cn(
            sizeClasses[size],
            bgColor,
            'rounded-full flex items-center justify-center text-white font-medium'
          )}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={cn(
            statusClasses[status],
            statusSizeClasses[size],
            'absolute rounded-full border-2 border-card'
          )}
        />
      )}
    </div>
  )
}
