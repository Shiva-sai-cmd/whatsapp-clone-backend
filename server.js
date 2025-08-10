const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http'); 
const { Server } = require("socket.io"); 
const Message = require('./models/Message');

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));


app.get('/api/chats', async (req, res) => {
  try {
    const chats = await Message.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$wa_id',
          name: { $first: { $ifNull: ["$name", null] } },
          lastMessage: { $first: '$body' },
          timestamp: { $first: '$createdAt' }, 
          wa_id: { $first: '$wa_id' }
        }
      },
      {
          $group: {
              _id: '$_id',
              name: { $max: '$name' }, // Take the first valid name found
              lastMessage: { $first: '$lastMessage' },
              timestamp: { $first: '$timestamp' },
              wa_id: { $first: '$wa_id' }
          }
      },
      { $sort: { timestamp: -1 } } 
    ]);
    res.json(chats);
  } catch (err) {
    console.error("Error fetching chats:", err);
    res.status(500).json({ error: 'Failed to fetch chats.' });
  }
});

app.get('/api/chats/:wa_id', async (req, res) => {
  try {
    const messages = await Message.find({ wa_id: req.params.wa_id }).sort('timestamp');
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages for this chat.' });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(' A user connected via socket.io');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});


app.post('/api/messages', async (req, res) => {
  try {
    const { to, body } = req.body;
    if (!to || !body) {
      return res.status(400).json({ error: 'to and body are required.' });
    }
    
    const newMessageDoc = new Message({
      id: `demo-${Date.now()}`,
      wa_id: to, 
      body: body,
      from_me: true, 
      type: 'text',
      timestamp: new Date(),
      status: 'sent',
    });

    const savedMessage = await newMessageDoc.save();

    io.emit('newMessage', savedMessage);
 

    
    res.status(201).json(savedMessage);
  } catch (err) {
    console.error("Error saving message:", err);
    res.status(500).json({ error: 'Failed to save message.' });
  }
});


server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});