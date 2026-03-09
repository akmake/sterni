import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Migration script: rename `password` → `passwordHash` for users
 * that were created with the wrong field name.
 *
 * Usage:  cd server && node fixPasswords.js
 */

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCol = db.collection('users');

    // Find users that have `password` but NOT `passwordHash`
    const broken = await usersCol.find({
      password: { $exists: true },
      passwordHash: { $exists: false },
    }).toArray();

    if (broken.length === 0) {
      console.log('✅ No users to fix — all users already have passwordHash.');
      return process.exit(0);
    }

    console.log(`🔧 Found ${broken.length} user(s) to fix:`);
    for (const u of broken) {
      console.log(`   - ${u.email} (_id: ${u._id})`);
    }

    // Rename field: password → passwordHash, then remove old `password` field
    const result = await usersCol.updateMany(
      { password: { $exists: true }, passwordHash: { $exists: false } },
      { $rename: { password: 'passwordHash' } },
    );

    console.log(`✅ Fixed ${result.modifiedCount} user(s).`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

run();
