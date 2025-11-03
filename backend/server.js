import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Tax Assistant API running' });
});

// Use routes
app.use('/api', routes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
});

export default app;
