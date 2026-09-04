require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const {
  redisClient,
  connectRedis,
} = require('./config/redis');

const shortenRoutes = require('./routes/shorten');
const redirectRoutes = require('./routes/redirect');
const authRoutes = require('./routes/auth');

const app = express();

connectDB();
connectRedis();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: process.env.SERVER_ID
  });
});

app.use('/api', authRoutes);
app.use('/api', shortenRoutes);
app.use('/', redirectRoutes);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);

  server.close(async () => {
    await mongoose.connection.close();
    await redisClient.quit();

    process.exit(0);
  });
};

process.on('SIGINT', () =>
  gracefulShutdown('SIGINT')
);

process.on('SIGTERM', () =>
  gracefulShutdown('SIGTERM')
);