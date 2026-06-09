import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import { errorHandler } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import credentialsRoutes from './routes/credentials';
import promptsRoutes from './routes/prompts';
import phoneNumbersRoutes from './routes/phoneNumbers';
import creditsRoutes from './routes/credits';
import autopilotRoutes from './routes/autopilot';
import testCallRoutes from './routes/testCall';
import callHistoryRoutes from './routes/callHistory';
import whatsappRoutes from './routes/whatsapp';
import voiceRoutes from './routes/voice';
import restaurantAIRoutes from './routes/restaurantAI';
import { whatsappEngine } from './services/whatsappEngine';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api/phone-numbers', phoneNumbersRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/autopilot', autopilotRoutes);
app.use('/api/test-call', testCallRoutes);
app.use('/api/call-history', callHistoryRoutes);
app.use('/api/whatsapp', whatsappRoutes);
// Public voice webhook namespace (called by OpenAI Realtime / Twilio — no auth)
app.use('/api/v1/voice', voiceRoutes);
app.use('/api/restaurant-ai', restaurantAIRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Health check with info
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'API server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API Base: http://localhost:${PORT}/api`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/auth/register - Register new user`);
  console.log(`  POST /api/auth/login - Login user`);
  console.log(`  GET  /api/auth/me - Get current user`);
  console.log(`  *    /api/whatsapp/sessions - WhatsApp engine`);

  // Restore any previously connected WhatsApp sessions (LocalAuth on disk).
  // Delay slightly so MongoDB connection (connectDB above) has a chance to settle.
  setTimeout(() => {
    whatsappEngine.restoreFromDb().catch((err) => {
      console.error('[WhatsAppEngine] restore on boot failed:', err);
    });
  }, 2000);
});

export default app;
