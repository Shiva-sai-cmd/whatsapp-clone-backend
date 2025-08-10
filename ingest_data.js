const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Message = require('./models/Message');

dotenv.config();

const payloadsPath = path.join(__dirname, 'payloads');

const processPayloads = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.');

    const files = fs.readdirSync(payloadsPath);
    console.log(`Found ${files.length} payload files to process.`);

    for (const file of files) {
      if (path.extname(file) === '.json') {
        const filePath = path.join(payloadsPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const payload = JSON.parse(fileContent);

        const change = payload.metaData?.entry?.[0]?.changes?.[0]?.value;

        if (!change) {
            console.warn(`Skipping file ${file}: Invalid payload structure.`);
            continue;
        }

        if (change.messages) {
          const messageData = change.messages[0];
          const contactData = change.contacts[0];

          const newMessage = {
            id: messageData.id,
            wa_id: contactData.wa_id,
            name: contactData.profile.name,
            body: messageData.text?.body || 'Unsupported message type',
            type: messageData.type,
            from_me: false,
            status: 'delivered',
            createdAt: new Date(parseInt(messageData.timestamp) * 1000)
          };

          await Message.findOneAndUpdate({ id: newMessage.id }, newMessage, { upsert: true });
          console.log(`Processed INCOMING message from ${newMessage.name} (ID: ${newMessage.id})`);

        } else if (change.statuses) {
          const statusData = change.statuses[0];
          console.log(`Processing status update for message ID: ${statusData.id}...`);

          await Message.findOneAndUpdate(
            { id: statusData.id },
            { 
              $set: { 
                status: statusData.status,
                from_me: true,
                wa_id: statusData.recipient_id,
                createdAt: new Date(parseInt(statusData.timestamp) * 1000)
              },
              $setOnInsert: {
                  id: statusData.id,
                  body: "Message sent from Business Account",
              }
            },
            { upsert: true }
          );
          console.log(`Status for message ${statusData.id} updated to ${statusData.status}.`);
        }
      }
    }
    console.log('All payloads processed successfully!');

  } catch (error) {
    console.error('An error occurred during ingestion:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

processPayloads();