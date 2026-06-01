import mongoose from 'mongoose';
import { Task } from '../../src/domains/workflow/models/Task.model.js';
import { TaskStep } from '../../src/domains/workflow/models/TaskStep.model.js';
import { Module } from '../../src/domains/setup/models/Module.model.js';
import { Role } from '../../src/domains/workflow/models/Role.model.js';
import { User } from '../../src/domains/users/models/User.model.js';

function field(
  name: string,
  label: string,
  type: 'text' | 'number' | 'select' | 'date' | 'otp' | 'file',
  sortOrder: number,
  required = true,
) {
  return { name, label, type, required, sort_order: sortOrder };
}

export async function seedWorkflowData(adminUserId: mongoose.Types.ObjectId) {
  const billModule = await Module.findOne({ code: 'BILL' });
  if (!billModule) {
    console.log('Skip workflow seed: BILL module not found');
    return;
  }

  const roles = await Role.find({ is_active: true });
  const roleByCode = Object.fromEntries(roles.map((r) => [r.code, r]));

  let task = await Task.findOne({ code: 'SALARY_BILL_SUBMIT' });
  if (!task) {
    task = await Task.create({
      name_en: 'Submit monthly salary bill',
      name_bn: 'মাসিক বেতন বিল জমা',
      code: 'SALARY_BILL_SUBMIT',
      module_id: billModule._id,
      module_code: billModule.code,
      module_name_en: billModule.name_en,
      description_en:
        'Officers submit their monthly pay bill online. DDO forwards to accounts office who processes and issues EFT.',
      description_bn: 'কর্মকর্তারা অনলাইনে মাসিক বেতন বিল জমা দেন।',
      roles_involved: ['SDO', 'DDO', 'AO', 'SYSTEM'],
      total_steps: 6,
      estimated_time: 30,
      is_active: true,
      is_published: true,
      version: 1,
      tags: ['salary', 'bill'],
      created_by: adminUserId,
      run_count: 0,
    });
    console.log('Created task: Submit monthly salary bill');
  } else {
    task.is_published = true;
    task.total_steps = 6;
    await task.save();
    await TaskStep.deleteMany({ task_id: task._id });
    console.log('Reset steps for salary bill task');
  }

  const stepDefs = [
    {
      role_code: 'SDO',
      title_en: 'Login & open bill submission',
      description_en:
        'Go to Budget Execution → Bill Submission. Select fiscal year and month, press Go.',
      fields: [
        field('fiscal_year', 'Fiscal year', 'text', 1),
        field('month', 'Month', 'text', 2),
      ],
      handoff_msg: 'System shows gross & net salary amount',
    },
    {
      role_code: 'SDO',
      title_en: 'Verify salary details',
      description_en: 'Check payment and deduction details carefully before submitting.',
      fields: [
        field('audit_volume_no', 'Audit volume no.', 'text', 1),
        field('page_number', 'Page number', 'text', 2),
      ],
      condition_text: 'Details must match payslip',
    },
    {
      role_code: 'SDO',
      title_en: 'Submit bill & enter OTP',
      description_en: 'Click Submit. Enter the OTP received via SMS. Bill is submitted successfully.',
      fields: [field('otp', 'OTP (from SMS)', 'otp', 1)],
      handoff_msg: 'Token number generated. DDO notified.',
      handoff_role: 'DDO',
    },
    {
      role_code: 'DDO',
      title_en: 'Review & forward bill',
      description_en:
        'DDO reviews the submitted bill. Verifies employee details and forwards to Accounts Office.',
      fields: [],
      condition_text: 'Fund must be available',
      handoff_msg: 'Bill sent to Accounts Office',
      handoff_role: 'AO',
    },
    {
      role_code: 'AO',
      title_en: 'Audit & approve bill',
      description_en: 'Accounts office checks bill, audits, and approves. Issues EFT or cheque.',
      fields: [],
      handoff_msg: 'Payment issued via EFT to employee bank account',
      handoff_role: 'SYSTEM',
    },
    {
      role_code: 'SYSTEM',
      title_en: 'EFT payment processed',
      description_en:
        'Bangladesh Bank processes EFT. Employee receives salary. SMS confirmation sent.',
      fields: [],
      is_auto: true,
    },
  ];

  for (let i = 0; i < stepDefs.length; i++) {
    const def = stepDefs[i]!;
    const role = roleByCode[def.role_code];
    if (!role) continue;

    await TaskStep.create({
      task_id: task._id,
      step_number: i + 1,
      title_en: def.title_en,
      description_en: def.description_en,
      role_id: role._id,
      role_code: role.code,
      role_name_en: role.name_en,
      fields: def.fields,
      condition_text: def.condition_text,
      handoff_msg: def.handoff_msg,
      handoff_role: def.handoff_role,
      is_optional: false,
      is_auto: def.is_auto ?? role.is_system,
      sort_order: i + 1,
      version: 1,
    });
  }
  console.log(`Seeded ${stepDefs.length} steps for salary bill task`);

  const admin = await User.findById(adminUserId);
  if (admin) {
    const tags = ['SDO', 'DDO', 'AO', 'ADMIN'];
    for (const code of tags) {
      const role = roleByCode[code];
      if (!role) continue;
      const has = admin.workflow_roles.some((r) => r.role_code === code && r.is_active);
      if (!has) {
        admin.workflow_roles.push({
          role_id: role._id,
          role_code: code,
          is_active: true,
          assigned_at: new Date(),
          assigned_by: adminUserId,
        });
      }
    }
    await admin.save();
    console.log('Assigned workflow roles (SDO, DDO, AO, ADMIN) to super admin for demo');
  }
}
