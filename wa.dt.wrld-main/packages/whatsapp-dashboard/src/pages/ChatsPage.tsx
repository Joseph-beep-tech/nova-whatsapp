import { useState } from 'react'
import { PanelRightClose, PanelRight } from 'lucide-react'
import { Button } from '@/components/common'
import { ChatList } from '@/components/chat'
import { ConversationThread } from '@/components/chat'
import { ContactPanel } from '@/components/contact'

export function ChatsPage() {
  const [showContactPanel, setShowContactPanel] = useState(true)

  return (
    <div className="flex h-full">
      {/* Left panel - Chat list */}
      <div className="w-80 flex-shrink-0">
        <ChatList />
      </div>

      {/* Center panel - Conversation thread */}
      <div className="flex-1 flex flex-col relative">
        <ConversationThread />

        {/* Toggle contact panel button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowContactPanel(!showContactPanel)}
          className="absolute top-3 right-3"
          title={showContactPanel ? 'Hide contact panel' : 'Show contact panel'}
        >
          {showContactPanel ? (
            <PanelRightClose className="w-5 h-5" />
          ) : (
            <PanelRight className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Right panel - Contact info */}
      {showContactPanel && (
        <ContactPanel onClose={() => setShowContactPanel(false)} />
      )}
    </div>
  )
}
