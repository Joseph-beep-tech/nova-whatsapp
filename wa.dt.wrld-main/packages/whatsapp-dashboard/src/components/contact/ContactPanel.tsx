import { useState, useEffect, useCallback } from 'react'
import { X, Edit2, Loader2 } from 'lucide-react'
import { Avatar, Button, Badge } from '@/components/common'
import { ContactInfo } from './ContactInfo'
import { Labels } from './Labels'
import { Notes } from './Notes'
import { contactApi } from '@/lib/api'
import { useChatStore } from '@/stores/chatStore'
import type { Contact, Note } from '@/types'
import { chatKey, parseChatKey } from '@/types'
import { cn } from '@/lib/utils'

// Mock contact data for development
const USE_MOCK_CONTACT = true // Set to false when backend is ready

function getMockContact(selectedKey: string, chat: { contactName: string; contactPhone: string; tags: string[] } | undefined): Contact {
  const { identifier, platform } = parseChatKey(selectedKey)
  return {
    id: selectedKey,
    identifier,
    platform,
    name: chat?.contactName || 'Unknown Contact',
    phone: chat?.contactPhone || '+254700000000',
    email: 'contact@example.com',
    company: 'Acme Corp',
    country: 'Kenya',
    language: 'en',
    accountType: 'personal',
    status: 'active',
    tags: chat?.tags || [],
    labels: [
      { id: '1', name: 'VIP', color: '#FFD700' },
      { id: '2', name: 'Support', color: '#007AFF' },
    ],
    metadata: {
      'Last Order': 'KES 5,000',
      'Membership': 'Gold',
    },
    notes: [],
    firstSeen: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
    lastSeen: new Date(),
  }
}

const MOCK_NOTES: Note[] = [
  {
    id: '1',
    content: 'Customer requested callback regarding subscription renewal.',
    author: 'Agent 1',
    authorId: 'agent-1',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: '2',
    content: 'Follow up on onboarding progress next week.',
    author: 'Agent 2',
    authorId: 'agent-2',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
]

type Tab = 'info' | 'notes'

interface ContactPanelProps {
  onClose?: () => void
}

export function ContactPanel({ onClose }: ContactPanelProps) {
  const { selectedChatId, chats } = useChatStore()
  const [contact, setContact] = useState<Contact | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('info')

  // Find the selected chat to get contact info
  const selectedChat = selectedChatId ? chats.find((c) => chatKey(c.identifier, c.platform) === selectedChatId) : undefined

  // Fetch contact when chat is selected
  useEffect(() => {
    if (!selectedChatId) {
      setContact(null)
      setNotes([])
      return
    }

    const fetchContact = async () => {
      setIsLoading(true)

      if (USE_MOCK_CONTACT) {
        // Use mock data in development
        setTimeout(() => {
          setContact(getMockContact(selectedChatId, selectedChat))
          setNotes(MOCK_NOTES)
          setIsLoading(false)
        }, 200)
        return
      }

      const { identifier, platform } = parseChatKey(selectedChatId)
      const [contactRes, notesRes] = await Promise.all([
        contactApi.get(identifier, platform),
        contactApi.getNotes(identifier, platform),
      ])

      if (contactRes.success && contactRes.data) {
        setContact(contactRes.data)
      }
      if (notesRes.success && notesRes.data) {
        setNotes(notesRes.data)
      }
      setIsLoading(false)
    }

    fetchContact()
  }, [selectedChatId, selectedChat])

  const handleAddNote = useCallback(
    async (content: string) => {
      if (!selectedChatId) return

      const { identifier, platform } = parseChatKey(selectedChatId)
      const response = await contactApi.addNote(identifier, platform, content)
      if (response.success && response.data) {
        setNotes((prev) => [response.data!, ...prev])
      }
    },
    [selectedChatId]
  )

  const handleAddLabel = useCallback(
    async (labelId: string) => {
      // TODO: Implement label addition via API
      console.log('Add label:', labelId)
    },
    []
  )

  const handleRemoveLabel = useCallback(
    async (labelId: string) => {
      // TODO: Implement label removal via API
      console.log('Remove label:', labelId)
    },
    []
  )

  if (!selectedChatId) {
    return (
      <div className="w-80 min-w-0 flex-shrink-0 bg-card dark:bg-card overflow-hidden flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Select a chat to view contact</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-80 min-w-0 flex-shrink-0 bg-card dark:bg-card overflow-hidden flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="w-80 min-w-0 flex-shrink-0 bg-card dark:bg-card overflow-hidden flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Contact not found</p>
      </div>
    )
  }

  return (
    <div className="w-80 min-w-0 flex-shrink-0 bg-card dark:bg-card overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              name={contact.name}
              imageUrl={contact.avatarUrl}
              size="lg"
            />
            <div>
              <h3 className="font-semibold text-foreground">{contact.name}</h3>
              <p className="text-sm text-muted-foreground">{contact.phone}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" title="Edit contact">
              <Edit2 className="w-4 h-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} title="Close">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Account type badge */}
        <div className="mt-3 flex items-center gap-2">
          <Badge variant={contact.accountType === 'business' ? 'info' : 'default'}>
            {contact.accountType}
          </Badge>
          <Badge variant={contact.status === 'active' ? 'success' : 'default'}>
            {contact.status}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex">
        <button
          onClick={() => setActiveTab('info')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'info'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Info
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'notes'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Notes ({notes.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'info' ? (
          <div className="space-y-6">
            {/* Labels section */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Labels</h4>
              <Labels
                labels={contact.labels}
                onAdd={handleAddLabel}
                onRemove={handleRemoveLabel}
              />
            </div>

            {/* Contact info section */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">
                Contact Details
              </h4>
              <ContactInfo contact={contact} />
            </div>

            {/* Tags section */}
            {contact.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="primary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata section */}
            {Object.keys(contact.metadata).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Custom Fields
                </h4>
                <dl className="space-y-2">
                  {Object.entries(contact.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ) : (
          <Notes notes={notes} onAddNote={handleAddNote} />
        )}
      </div>
    </div>
  )
}
