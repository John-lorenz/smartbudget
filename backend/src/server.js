require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const goalRoutes = require('./routes/goals');
const stockRoutes = require('./routes/stocks');
const cryptoRoutes = require('./routes/crypto');
const whatsappRoutes = require('./routes/whatsapp');
const telegramRoutes = require('./routes/telegram');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/telegram', telegramRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    situacao: 'ok',
    mensagem: 'Serviço em operação',
    horario: new Date().toISOString(),
  });
});

if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`SmartBudget API rodando na porta ${PORT}`);
  });
}

module.exports = app;
