// ===========================================
// Express Server Entry Point
// ===========================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import eventRoutes from './routes/events.js';
import planningRoutes from './routes/planning.js';
import aiRoutes from './routes/ai.js';
import ideaRoutes from './routes/ideas.js';
import { errorHandler } from './middleware/errorHandler.js';
import { deploymentGuard } from './middleware/deploymentGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env['PORT'] || '3001', 10);

// ===========================================
// Security & Parsing Middleware
// ===========================================
app.use(helmet({
  contentSecurityPolicy: process.env['NODE_ENV'] === 'production' ? undefined : false,
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', deploymentGuard);

// ===========================================
// API Routes
// ===========================================
app.use('/api/events', eventRoutes);
app.use('/api', planningRoutes);
app.use('/api', aiRoutes);
app.use('/api', ideaRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================================
// Static Files (Production)
// ===========================================
if (process.env['NODE_ENV'] === 'production') {
  const clientDist = path.join(__dirname, '../../client');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API routes
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ===========================================
// Error Handler (must be last)
// ===========================================
app.use(errorHandler);

// ===========================================
// Start Server
// ===========================================
app.listen(PORT, () => {
  console.log(`✨ EventCraft AI server running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env['NODE_ENV'] || 'development'}`);
});

export default app;
