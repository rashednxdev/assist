import mongoose from 'mongoose';
import { BookType } from '../../src/domains/books/models/BookType.model.js';
import { BookInfo } from '../../src/domains/books/models/BookInfo.model.js';
import { BookChapter } from '../../src/domains/books/models/BookChapter.model.js';
import { BookTopic } from '../../src/domains/books/models/BookTopic.model.js';
import { BookTopicDetail } from '../../src/domains/books/models/BookTopicDetail.model.js';
import { BookSubTopic } from '../../src/domains/books/models/BookSubTopic.model.js';
import { Regulation } from '../../src/domains/books/models/Regulation.model.js';
import { RegulationAmendment } from '../../src/domains/books/models/RegulationAmendment.model.js';

export async function seedBooksData() {
  let bookType = await BookType.findOne({ code: 'GOVT_RULES' });
  if (!bookType) {
    bookType = await BookType.create({
      name: 'Government Financial Rules',
      name_bn: 'সরকারি আর্থিক বিধি',
      code: 'GOVT_RULES',
      description: 'Official government financial and accounting rules',
      sort_order: 1,
      is_active: true,
    });
    console.log('Created book type: GOVT_RULES');
  }

  let book = await BookInfo.findOne({ short_name: 'GFR' });
  if (!book) {
    book = await BookInfo.create({
      book_type_id: bookType._id,
      name: 'General Financial Rules 2005',
      name_bn: 'সাধারণ আর্থিক বিধিমালা ২০০৫',
      short_name: 'GFR',
      description:
        '<p>The General Financial Rules (GFR) govern public financial management in Bangladesh. They define procedures for budget execution, accounting, and audit compliance for all government offices.</p>',
      edition: '2005',
      published_by: 'Ministry of Finance',
      effective_date: new Date('2005-07-01'),
      is_part: false,
      language: 'both',
      is_active: true,
      is_superseded: false,
      tags: ['gfr', 'finance', 'budget', 'audit'],
    });
    console.log('Created book: GFR 2005');
  } else {
    const chapters = await BookChapter.find({ book_info_id: book._id });
    const chapterIds = chapters.map((c) => c._id);
    const topics = await BookTopic.find({ book_chapter_id: { $in: chapterIds } });
    const topicIds = topics.map((t) => t._id);
    await BookSubTopic.deleteMany({ book_topic_id: { $in: topicIds } });
    await BookTopicDetail.deleteMany({ book_topic_id: { $in: topicIds } });
    await BookTopic.deleteMany({ book_chapter_id: { $in: chapterIds } });
    await BookChapter.deleteMany({ book_info_id: book._id });
    const regs = await Regulation.find({ book_info_id: book._id });
    await RegulationAmendment.deleteMany({ regulation_id: { $in: regs.map((r) => r._id) } });
    await Regulation.deleteMany({ book_info_id: book._id });
    console.log('Reset GFR chapters and regulations');
  }

  const ch1 = await BookChapter.create({
    book_info_id: book._id,
    name: 'General System and Structure of Accounts',
    sub_name: 'Chapter IV',
    chapter_number: 'IV',
    description: '<p>Covers the general system of accounts and classification of receipts and payments.</p>',
    sort_order: 1,
    is_active: true,
  });

  const ch2 = await BookChapter.create({
    book_info_id: book._id,
    name: 'Contingent Bills and Charges',
    sub_name: 'Chapter VIII',
    chapter_number: 'VIII',
    description: '<p>Rules relating to contingent bills, charges, and office expenditure.</p>',
    sort_order: 2,
    is_active: true,
  });

  const topic45 = await BookTopic.create({
    book_chapter_id: ch1._id,
    name: 'Classification of Receipts',
    sub_name: 'Rule 45',
    rule_number: '45',
    description:
      '<p>All moneys received by or on behalf of the Government shall be classified under the appropriate minor head of account in accordance with the classification prescribed in the Chart of Accounts.</p>',
    note: 'See also Rule 46 for classification of payments.',
    effective_date: new Date('2005-07-01'),
    is_amended: true,
    sort_order: 1,
    is_active: true,
  });

  await BookTopicDetail.create({
    book_topic_id: topic45._id,
    detail_text:
      '<p>The receiving officer shall ensure that every receipt is entered in the cash book on the same day it is received, with the correct head of account.</p>',
    sort_order: 1,
    is_active: true,
  });

  await BookSubTopic.create({
    book_topic_id: topic45._id,
    name: 'Daily reconciliation',
    rule_number: '45(1)',
    description: '<p>The DDO shall reconcile daily receipts with the treasury challan before close of business.</p>',
    sort_order: 1,
    is_active: true,
  });

  await BookTopic.create({
    book_chapter_id: ch1._id,
    name: 'Classification of Payments',
    sub_name: 'Rule 46',
    rule_number: '46',
    description: '<p>All payments shall be charged to the appropriate head of account as shown in the sanction order.</p>',
    sort_order: 2,
    is_active: true,
    is_amended: false,
  });

  await BookTopic.create({
    book_chapter_id: ch2._id,
    name: 'Contingent Bills',
    sub_name: 'Rule 161',
    rule_number: '161',
    description:
      '<p>Contingent bills shall be prepared in the prescribed form and submitted to the DDO for verification before payment.</p>',
    sort_order: 1,
    is_active: true,
    is_amended: false,
  });

  let regulation = await Regulation.findOne({ regulation_no: 'GFR-45' });
  if (!regulation) {
    regulation = await Regulation.create({
      book_info_id: book._id,
      book_chapter_id: ch1._id,
      book_topic_id: topic45._id,
      regulation_no: 'GFR-45',
      title: 'Classification of Receipts',
      full_text:
        '<p>All moneys received by or on behalf of the Government shall be classified under the appropriate minor head of account. The receiving officer shall ensure daily reconciliation with treasury challan.</p>',
      regulation_type: 'rule',
      effective_date: new Date('2005-07-01'),
      is_active: true,
      is_amended: true,
      applicable_to: ['DDO', 'AO', 'all'],
      payment_related: true,
      receipt_related: true,
      tags: ['receipts', 'classification', 'treasury'],
    });
    console.log('Created regulation GFR-45');
  } else {
    regulation.is_amended = true;
    await regulation.save();
    await RegulationAmendment.deleteMany({ regulation_id: regulation._id });
  }

  const existingAmendment = await RegulationAmendment.findOne({
    regulation_id: regulation._id,
    amendment_no: 'AMD-2021-003',
  });
  if (!existingAmendment) {
    await RegulationAmendment.create({
      regulation_id: regulation._id,
      amendment_no: 'AMD-2021-003',
      amendment_date: new Date('2021-06-15'),
      issued_by: 'Finance Division',
      circular_ref: 'FD Circular No. 12/2021',
      old_text:
        '<p>All moneys received by or on behalf of the Government shall be classified under the appropriate minor head of account.</p>',
      new_text:
        '<p>All moneys received by or on behalf of the Government shall be classified under the appropriate minor head of account. The receiving officer shall ensure daily reconciliation with treasury challan and submit a monthly summary to the DDO.</p>',
      change_summary:
        'Added requirement for daily reconciliation with treasury challan and monthly summary submission to DDO.',
      is_active: true,
    });
    console.log('Created amendment AMD-2021-003 for GFR-45');
  }
}
