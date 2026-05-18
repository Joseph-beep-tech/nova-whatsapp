import { authHandlers, setMockAuthState, resetMockAuthState } from './auth'
import { chatHandlers, setMockChats, setMockMessages, resetMockChatState } from './chat'
import { contactHandlers, setMockContacts, resetMockContactState } from './contact'
import { sessionHandlers, setMockSession, setMockSessions, resetMockSessionState } from './session'
import { healthHandlers, setMockHealthy, resetMockHealthState } from './health'

// Combine all handlers
export const handlers = [
  ...authHandlers,
  ...chatHandlers,
  ...contactHandlers,
  ...sessionHandlers,
  ...healthHandlers,
]

// Export individual handler groups for selective use
export {
  authHandlers,
  chatHandlers,
  contactHandlers,
  sessionHandlers,
  healthHandlers,
}

// Export state setters for test control
export {
  setMockAuthState,
  resetMockAuthState,
  setMockChats,
  setMockMessages,
  resetMockChatState,
  setMockContacts,
  resetMockContactState,
  setMockSession,
  setMockSessions,
  resetMockSessionState,
  setMockHealthy,
  resetMockHealthState,
}

// Reset all mock states to default
export function resetAllMockStates() {
  resetMockAuthState()
  resetMockChatState()
  resetMockContactState()
  resetMockSessionState()
  resetMockHealthState()
}
