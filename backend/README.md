# Azizi Voice AI Portal - Backend

Backend API for the Azizi Voice AI Portal system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables with your OpenAI, Google Cloud, and Twilio credentials.

## Development

Run the development server:
```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### AI Credentials
- `GET /api/credentials` - Get AI credentials
- `PUT /api/credentials` - Update AI credentials

### Prompts
- `GET /api/prompts` - Get all prompts
- `POST /api/prompts` - Create prompt
- `PUT /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt

### Phone Numbers
- `GET /api/phone-numbers` - Get phone numbers
- `POST /api/phone-numbers/assign/:id` - Assign number to prompt

### Voice Credits
- `GET /api/credits` - Get credit balance
- `POST /api/credits/add` - Add credits
- `GET /api/credits/transactions` - Get transaction history

### Autopilot
- `GET /api/autopilot` - Get autopilot settings
- `POST /api/autopilot` - Update autopilot settings
