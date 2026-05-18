# LLM Conversational System

Architecture for LLM-powered conversational features in the WhatsApp service.

## Overview

The LLM service adds conversational AI to the message routing pipeline:
- **Intent detection** for free-text messages from unregistered users
- **Dynamic help** that adapts to user context and enrolled programs
- **Welcome generation** for first-time users listing available programs
- **Conversational responses** for unregistered users asking questions

## Architecture

```
Message arrives
  → messageRouter.route()        [existing: tag/keyword detection, dedup, fromMe filter]
  → keywordHandler.handle()      [existing: echo, ping, help, status]
  → eventRouter.getTagConfigs()  [existing: lookup tag routing]
  → IF no tags & no configs:
      → llmService.detectIntent()   [NEW: classify user message]
      → IF tag_interest:
          → stateManager.registerUser()  [existing: auto-register]
          → welcomeService.sendWelcome() [existing: tag welcome]
      → ELSE:
          → llmService.generateWelcome() [NEW: generic welcome + tag list]
          → OR llmService.generateUnregisteredResponse() [NEW: contextual reply]
```

## Components

### LlmService (`src/services/llmService.ts`)

Provides all LLM operations via OpenRouter (OpenAI-compatible API).

| Method | Purpose |
|--------|---------|
| `detectIntent(messageBody, availableTags)` | Classify user intent: tag_interest, help, greeting, question, unknown |
| `generateWelcome(input)` | Generate welcome message listing available programs |
| `generateHelp(input)` | Generate context-aware help based on user's tags and commands |
| `generateUnregisteredResponse(messageBody, availableTags)` | Respond to questions from unregistered users |

### Integration Points

| Component | Integration |
|-----------|-------------|
| `eventRouter.ts` | Calls `handleUnregisteredUser()` when user has no tags and no tag configs |
| `keywordHandler.ts` | Help command delegates to `llmService.generateHelp()` when LLM is enabled |
| `index.ts` | Initializes and wires llmService into eventRouter and keywordHandler |

## Configuration

```bash
# Required
ENABLE_LLM=true
OPENROUTER_API_KEY=sk-or-...    # Shared with Qdrant config

# Optional (with defaults)
LLM_MODEL=x-ai/grok-2           # OpenRouter model ID
LLM_TEMPERATURE=0.7             # Response creativity (0-1)
LLM_MAX_TOKENS=512              # Max response length
INTENT_DETECTION_TIMEOUT_MS=5000 # Timeout for intent classification
BRAND_NAME=Azizi Africa         # Organization name in messages
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

The LLM config (`llmConfig` in `shared/config.ts`) shares API key and base URL with `qdrantConfig` since both use OpenRouter.

## User Intent Classification

The intent detection uses a focused classification prompt that returns structured JSON:

```json
{
  "intent": "tag_interest",
  "tag": "SOMO",
  "confidence": 0.95,
  "reasoning": "User asked about the SOMO program"
}
```

| Intent | Action |
|--------|--------|
| `tag_interest` | Auto-register user with detected tag, send tag welcome |
| `greeting` | Send generic welcome with available programs |
| `help` | Send dynamic help (same as help command) |
| `question` | Send contextual response mentioning available programs |
| `unknown` | Send generic welcome as fallback |

## Message Flow Examples

### Unregistered user sends "Hi"
1. messageRouter: no tags detected, no keywords
2. eventRouter: no tag configs → `handleUnregisteredUser()`
3. llmService: detectIntent → `greeting`
4. llmService: generateWelcome → "Welcome to Azizi Africa! Available programs: ..."

### Unregistered user sends "Tell me about SOMO"
1. messageRouter: SOMO tag detected → auto-register
2. welcomeService: send SOMO welcome messages
3. (LLM not needed - existing flow handles it)

### Unregistered user sends "What learning programs do you have?"
1. messageRouter: no tags detected, no keywords
2. eventRouter: no tag configs → `handleUnregisteredUser()`
3. llmService: detectIntent → `question`
4. llmService: generateUnregisteredResponse → contextual answer mentioning programs

### Registered user sends "help"
1. messageRouter: keyword detected → `help`
2. keywordHandler: help → `llmService.generateHelp()` (or static fallback)

## Graceful Degradation

The LLM service degrades gracefully at every level:

| Failure | Behavior |
|---------|----------|
| `ENABLE_LLM=false` | No LLM features; existing regex-only routing |
| No API key | LLM disabled; static help and no unregistered user handling |
| API timeout/error | Falls back to static welcome/help text |
| Malformed JSON from LLM | Returns `unknown` intent with 0 confidence |
| No available tags configured | Skips LLM handling, falls to legacy forwarder |

## Type Definitions

See `src/types/llm.ts`:
- `UserIntent` - Intent classification union type
- `IntentDetectionResult` - Full intent detection result with tag and confidence
- `WelcomeGenerationInput` - Input for welcome message generation
- `HelpGenerationInput` - Input for help generation with commands and tags
- `LlmCompletionResult` - Raw LLM completion result with metadata
