require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();


const uploadRoutes = require('./routes/upload');
const askRoutes = require('./routes/ask');

// Middleware
app.use(cors());
app.use(express.json());

// 2. Use the routes

app.use('/api', uploadRoutes);
app.use('/api', askRoutes);

// Basic Route
app.get('/', (req, res) => res.send('Doc QA Server Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));