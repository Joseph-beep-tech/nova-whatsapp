# Azizi Voice AI Portal

A comprehensive, modern AI Voice portal platform for managing voice AI calls, WhatsApp automation, and AI configuration. Built with React, Node.js, and MongoDB.

## 🎯 Features

### Core Features
- ✅ **AI Credentials Management** - Securely store and manage OpenAI and Google Cloud credentials
- ✅ **Voice Prompts** - Create, edit, and manage AI voice prompts
- ✅ **Phone Number Management** - Request and manage dedicated voice AI phone numbers
- ✅ **Voice Credits System** - Track usage, manage credit balance, and view transaction history
- ✅ **Browser Test Calls** - Test your prompts directly in the browser using WebRTC
- ✅ **WhatsApp Autopilot** - Configure AI-powered auto-replies with keyword triggers
- ✅ **User Authentication** - Secure JWT-based authentication
- ✅ **Real-time Dashboard** - Monitor credits, calls, and system status

### Technical Features
- 🎨 **Modern UI** - Beautiful, intuitive interface with Tailwind CSS
- 📱 **Responsive Design** - Mobile-first approach, works on all devices
- ⚡ **Fast Performance** - Optimized React components with lazy loading
- 🔐 **Secure** - Password hashing, JWT tokens, encrypted credentials
- 🌐 **RESTful API** - Comprehensive backend API
- 📊 **Data Visualization** - Chart integration for analytics
- 🔄 **Real-time Updates** - Socket.io ready for live features

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6.0+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone the repository**
```bash
cd azizi-portal
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

3. **Frontend Setup** (new terminal)
```bash
cd frontend
npm install
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Docker Setup

```bash
docker-compose up --build
```

Access at http://localhost:3000

## 📁 Project Structure

```
azizi-portal/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth & error handling
│   │   ├── config/         # Database config
│   │   └── index.ts        # Server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/               # React TypeScript UI
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── store/          # Zustand state
│   │   ├── utils/          # Utilities & API client
│   │   ├── App.tsx         # Main app
│   │   └── main.tsx        # Entry point
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
└── docker-compose.yml      # Docker orchestration
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Credentials
- `GET /api/credentials` - Get AI credentials
- `PUT /api/credentials` - Update credentials

### Prompts
- `GET /api/prompts` - Get all prompts
- `POST /api/prompts` - Create prompt
- `PUT /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt

### Phone Numbers
- `GET /api/phone-numbers` - Get phone numbers
- `POST /api/phone-numbers` - Request new number
- `POST /api/phone-numbers/assign/:id` - Assign to prompt

### Voice Credits
- `GET /api/credits` - Get credit balance
- `POST /api/credits/add` - Add credits
- `GET /api/credits/transactions` - Transaction history

### Autopilot
- `GET /api/autopilot` - Get settings
- `POST /api/autopilot` - Update settings

## 🛠️ Configuration

### Backend Environment Variables
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/azizi-portal
JWT_SECRET=your_jwt_secret
OPENAI_API_KEY=sk-...
NODE_ENV=development
```

### Frontend Environment Variables
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 📖 Usage Guide

### 1. Setting Up Credentials
- Go to **AI Credentials** tab
- Add your OpenAI API key and Project ID
- Configure Google Cloud integration
- Save changes

### 2. Creating Prompts
- Navigate to **Prompts**
- Click "New Prompt"
- Enter prompt name and content
- Assign a phone number (optional)
- Save

### 3. Managing Phone Numbers
- Go to **Phone Numbers**
- Click "Request New Number"
- Fill in area code and notes
- Submit request
- Numbers typically available within 24 hours

### 4. Adding Voice Credits
- Go to **Voice Credits**
- Enter amount and select payment method
- Click "Fund Credits"
- Track usage in transaction history

### 5. Testing Prompts
- Go to **Test Call**
- Select a prompt
- Click "Start Call"
- Speak into your microphone
- View transcript and AI response

### 6. WhatsApp Autopilot
- Go to **Autopilot**
- Enable autopilot
- Configure keyword triggers
- Set business hours (optional)
- Save settings

## 🔐 Security

- Passwords are hashed using bcryptjs
- JW T tokens expire after 7 days
- All sensitive data is encrypted
- CORS is configured for frontend access
- Input validation on all API endpoints
- SQL injection and XSS protection

## 🎨 Design System

The UI uses a modern design system with:
- **Primary Color**: Blue (#0ea5e9)
- **Success Color**: Green (#10b981)
- **Warning Color**: Amber (#f59e0b)
- **Danger Color**: Red (#ef4444)
- **Font**: Inter (system, sans-serif)
- **Tailwind CSS** for utility-first styling

## 📱 Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🐛 Troubleshooting

### Backend won't start
```bash
# Clear node_modules and reinstall
rm -rf backend/node_modules
cd backend && npm install
npm run dev
```

### MongoDB connection error
```bash
# Ensure MongoDB is running
mongosh mongodb://localhost:27017
```

### Frontend shows blank page
```bash
# Clear React cache
rm -rf node_modules/.cache
npm start
```

## 📝 Development Notes

- Backend uses TypeScript for type safety
- Frontend uses React 18 with hooks
- State management with Zustand
- API calls via Axios with interceptors
- UI components are modular and reusable
- CSS framework: Tailwind CSS v3

## 🚢 Deployment

### Production Build

**Backend**
```bash
cd backend
npm run build
npm start
```

**Frontend**
```bash
cd frontend
npm run build
```

### Docker Deployment
```bash
docker-compose -f docker-compose.yml up -d
```

## 📄 License

MIT License - see LICENSE file for details

## 👥 Contributing

Contributions are welcome! Please feel free to submit pull requests.

## 📞 Support

For support, email support@azizi.ai or open an issue on GitHub.

---

**Made with ❤️ by Azizi Team**
