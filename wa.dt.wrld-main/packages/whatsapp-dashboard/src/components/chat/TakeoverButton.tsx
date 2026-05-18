import { useState } from 'react'
import { UserCheck, Bot } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'
import { useAuth } from '@/stores/authStore'
import { chatKey, parseChatKey } from '@/types'

interface TakeoverButtonProps {
  chatId: string // composite key (identifier:platform)
  className?: string
}

export function TakeoverButton({ chatId, className }: TakeoverButtonProps) {
  const { user } = useAuth()
  const { chats, claimChat, releaseChat, isLoading } = useChatStore()
  const [isProcessing, setIsProcessing] = useState(false)

  // Find the chat to check assignment status
  const chat = chats.find((c) => chatKey(c.identifier, c.platform) === chatId)
  const isClaimed = Boolean(chat?.assignedTo)
  const isClaimedByMe = chat?.assignedTo === user?.id
  const isClaimedByOther = isClaimed && !isClaimedByMe

  const handleClick = async () => {
    if (!user?.id) return

    setIsProcessing(true)
    const { identifier, platform } = parseChatKey(chatId)
    try {
      if (isClaimed && isClaimedByMe) {
        // Release conversation back to bot
        await releaseChat(identifier, platform)
      } else if (!isClaimed) {
        // Claim conversation for agent
        await claimChat(identifier, platform, user.id)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const buttonVariant = isClaimed && isClaimedByMe ? 'secondary' : 'primary'
  const buttonText = isClaimed && isClaimedByMe ? 'Release to Bot' : 'Claim Conversation'
  const buttonIcon = isClaimed && isClaimedByMe ? <Bot className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />

  return (
    <Button
      variant={buttonVariant}
      size="sm"
      onClick={handleClick}
      disabled={isClaimedByOther || isProcessing || isLoading}
      isLoading={isProcessing || isLoading}
      leftIcon={buttonIcon}
      className={cn('whitespace-nowrap', className)}
      title={isClaimedByOther ? `Claimed by ${chat?.assignedTo}` : buttonText}
    >
      <span className="hidden sm:inline">{buttonText}</span>
      <span className="sm:hidden">{isClaimed && isClaimedByMe ? 'Release' : 'Claim'}</span>
    </Button>
  )
}
