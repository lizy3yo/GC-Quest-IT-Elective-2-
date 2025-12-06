const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Usage: set MONGO_URI and run with node
// Example (PowerShell):
// $env:MONGO_URI="mongodb+srv://..."; node .\\scripts\\backfill\\backfill-studyroom-joins.js

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Please set MONGO_URI in the environment before running this script.');
    process.exit(1);
  }

  // Connect to MongoDB
  try {
    await mongoose.connect(uri, {
      dbName: 'gc-quest-db',
      appName: 'GC-Quest-backfill',
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }

  const roomsColl = mongoose.connection.collection('studyrooms');
  const usersColl = mongoose.connection.collection('users');

  try {
    const cursor = roomsColl.find({});
    let roomsProcessed = 0;
    let messagesInserted = 0;
    const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
    if (dryRun) console.log('Running in dry-run mode: no changes will be written');

    while (await cursor.hasNext()) {
      const room = await cursor.next();
      roomsProcessed++;

      const roomId = room._id;
      const roomCreatedAt = room.createdAt ? new Date(room.createdAt) : new Date();
      const members = Array.isArray(room.members) ? room.members : [];

      if (members.length === 0) continue;

      console.log(`Processing room: ${room.name || roomId} (${members.length} members)`);

      for (let i = 0; i < members.length; i++) {
        const memberId = members[i];
        // Resolve user to get firstName / lastName
        const user = await usersColl.findOne({ _id: typeof memberId === 'string' ? ObjectId(memberId) : memberId }, { projection: { firstName: 1, lastName: 1 } });
        if (!user) {
          console.warn(`  - User not found for id ${memberId}`);
          continue;
        }

        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        const systemMessage = `${name} joined the room`;

        // Check if similar system message already exists in the room.messages
        const already = Array.isArray(room.messages) && room.messages.some(m => {
          try {
            // m.userId might be an ObjectId or string
            const mUserId = m.userId && (typeof m.userId === 'object' ? m.userId.toString() : m.userId);
            const memberIdStr = typeof memberId === 'object' ? memberId.toString() : String(memberId);
            return m.type === 'system' && mUserId === memberIdStr && (m.message === systemMessage || (typeof m.message === 'string' && m.message.includes('joined')));
          } catch {
            return false;
          }
        });

        if (already) {
          // skip
          continue;
        }

        // Use roomCreatedAt plus small offset so messages don't all have identical timestamps
        const timestamp = new Date(roomCreatedAt.getTime() + i * 1000);

        const messageDoc = {
          userId: typeof memberId === 'string' ? ObjectId(memberId) : memberId,
          message: systemMessage,
          timestamp,
          type: 'system',
        };

        if (dryRun) {
          console.log(`  - [dry-run] Would insert system message for ${name}`);
        } else {
          // Push into messages array
          await roomsColl.updateOne({ _id: roomId }, { $push: { messages: messageDoc } });
          messagesInserted++;
          console.log(`  - Inserted system message for ${name}`);
        }
      }
    }

    console.log(`Done. Rooms processed: ${roomsProcessed}. System messages inserted: ${messagesInserted}` + (dryRun ? ' (dry-run)' : ''));
  } catch (err) {
    console.error('Error during backfill:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
