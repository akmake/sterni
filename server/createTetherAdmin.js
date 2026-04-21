// Run once: node createTetherAdmin.js
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/userModel.js';

await mongoose.connect(process.env.MONGO_URI);

const email = 'yosefdaean@gmail.com';
const existing = await User.findOne({ email });

if (existing) {
  console.log('✅ User already exists:', existing.email, '| role:', existing.role);
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    await existing.save();
    console.log('🔄 Role updated to admin');
  }
} else {
  const passwordHash = await bcrypt.hash('2904', 12);
  const user = await User.create({
    name: 'Yosef Dahan',
    email,
    passwordHash,
    role: 'admin',
  });
  console.log('✅ Admin created:', user.email);
}

await mongoose.disconnect();
process.exit(0);
