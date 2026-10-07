import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.route.js';

const app = express();

app.use(cors({
	origin: process.env.FRONTEND_URL || 'http://localhost:5173',
	credentials: true,
}));
app.use(express.json());
app.use('/api/auth', authRoutes);

export default app;

///auth/userinfo .email
///auth/userinfo .username