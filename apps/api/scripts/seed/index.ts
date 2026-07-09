import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { hashPassword } from '../../src/domains/auth/auth.service.js';
import { User } from '../../src/domains/users/models/User.model.js';
import { Credentials } from '../../src/domains/users/models/Credentials.model.js';
import { seedSetupData } from './setup-data.js';
import { seedWorkflowData } from './workflow-data.js';
import { seedBooksData } from './books-data.js';
import { seedQuestionsData } from './questions-data.js';
import { seedExamsData } from './exams-data.js';
import { seedPapersData } from './papers-data.js';
import { seedSubscriptionPlans } from './subscription-data.js';
import { seedPensionData } from './pension-data.js';

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');

  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');
  await mongoose.connect(uri);

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@ibas.gov.bd';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
  const nameEn = process.env.SEED_ADMIN_NAME_EN ?? 'System Administrator';
  const nameBn = process.env.SEED_ADMIN_NAME_BN;

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      full_name_en: nameEn,
      ...(nameBn ? { full_name_bn: nameBn } : {}),
      email,
      phone: '01700000001',
      user_type: 'system_admin',
      workflow_roles: [],
      status: 'active',
      is_verified: true,
      is_super_admin: true,
      created_by: new mongoose.Types.ObjectId(),
    });
    user.created_by = user._id;
    await user.save();
    console.log('Created super admin user:', email);
  } else {
    console.log('Super admin already exists:', email);
  }

  const creds = await Credentials.findOne({ user_id: user._id });
  if (!creds) {
    await Credentials.create({
      user_id: user._id,
      password_hash: await hashPassword(password),
      status: 'active',
      failed_attempts: 0,
      password_changed_at: new Date(),
      two_fa_enabled: false,
    });
    console.log('Created credentials for super admin');
  }

  await seedSetupData();
  await seedWorkflowData(user._id);
  await seedBooksData();
  await seedQuestionsData();
  await seedExamsData();
  await seedPensionData();
  await seedPapersData();
  await seedSubscriptionPlans();

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
