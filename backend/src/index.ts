// ── MUST be first — loads .env before ANY module instantiates clients ─────────
import dotenv from 'dotenv';
dotenv.config();
// ─────────────────────────────────────────────────────────────────────────────

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
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
import restaurantRoutes from './routes/restaurants';
import menuRoutes from './routes/menus';
import orderRoutes from './routes/orders';
import riderRoutes from './routes/riders';
import paymentRoutes from './routes/payments';
import { whatsappEngine } from './services/whatsappEngine';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Database ──────────────────────────────────────────────────────────────────
connectDB();

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/credentials',   credentialsRoutes);
app.use('/api/prompts',       promptsRoutes);
app.use('/api/phone-numbers', phoneNumbersRoutes);
app.use('/api/credits',       creditsRoutes);
app.use('/api/autopilot',     autopilotRoutes);
app.use('/api/test-call',     testCallRoutes);
app.use('/api/call-history',  callHistoryRoutes);
app.use('/api/whatsapp',      whatsappRoutes);
app.use('/api/v1/voice',      voiceRoutes);
app.use('/api/restaurant-ai', restaurantAIRoutes);

// Restaurant domain
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menus',       menuRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/riders',      riderRoutes);
app.use('/api/payments',    paymentRoutes);

// ── Health checks ─────────────────────────────────────────────────────────────
app.get('/health',      (_req: Request, res: Response) => res.json({ status: 'ok' }));
app.get('/api/health',  (_req: Request, res: Response) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  NovaGo backend running → http://localhost:${PORT}`);
  console.log(`📦  Database: ${process.env.MONGODB_URI?.replace(/:([^:@]+)@/, ':****@') || 'not set'}`);
  console.log(`🌍  Environment: ${process.env.NODE_ENV || 'development'}\n`);

  setTimeout(() => {
    whatsappEngine.restoreFromDb().catch((err) => {
      console.error('[WhatsAppEngine] restore on boot failed:', err);
    });
  }, 2000);
});

export default app;
