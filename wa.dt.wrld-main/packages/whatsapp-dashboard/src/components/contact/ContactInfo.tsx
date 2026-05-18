import { format } from 'date-fns'
import {
  Phone,
  Mail,
  Building,
  Globe,
  Calendar,
  MessageSquare,
  User,
} from 'lucide-react'
import type { Contact } from '@/types'

interface ContactInfoProps {
  contact: Contact
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
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}

export function ContactInfo({ contact }: ContactInfoProps) {
  return (
    <div className="space-y-1">
      <InfoRow
        icon={<User className="w-4 h-4" />}
        label="Name"
        value={contact.name}
      />
      <InfoRow
        icon={<Phone className="w-4 h-4" />}
        label="Phone"
        value={contact.phone}
      />
      <InfoRow
        icon={<Mail className="w-4 h-4" />}
        label="Email"
        value={contact.email}
      />
      <InfoRow
        icon={<Building className="w-4 h-4" />}
        label="Company"
        value={contact.company}
      />
      <InfoRow
        icon={<Globe className="w-4 h-4" />}
        label="Country"
        value={contact.country}
      />
      <InfoRow
        icon={<Calendar className="w-4 h-4" />}
        label="First seen"
        value={format(new Date(contact.firstSeen), 'MMM d, yyyy')}
      />
      <InfoRow
        icon={<MessageSquare className="w-4 h-4" />}
        label="Last seen"
        value={format(new Date(contact.lastSeen), 'MMM d, yyyy HH:mm')}
      />
    </div>
  )
}
