const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  wa_id: { type: String, required: true },
  type: { type: String, required: false, default: 'text' },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  metadata: { type: Object },
  body: { type: String },
  name: { type: String },
  from_me: {
    type: Boolean,
    default: false
  },
}, { 
  timestamps: true 
});

const Message = mongoose.model('Message', messageSchema, 'processed_messages');

module.exports = Message;