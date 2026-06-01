import 'dotenv/config';
import mongoose from 'mongoose';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected to database:', mongoose.connection.name);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});
