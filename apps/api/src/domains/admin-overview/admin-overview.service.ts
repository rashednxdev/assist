import { User } from '../users/models/User.model.js';
import { UserActivityLog } from '../users/models/UserActivityLog.model.js';
import { Question } from '../questions/models/Question.model.js';
import { PaperDetail } from '../papers/models/PaperDetail.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { SubmittedQuestion } from '../user-questions/models/SubmittedQuestion.model.js';
import { AdminNotification } from '../notifications/models/AdminNotification.model.js';
import { LiveStream } from '../live-stream/models/LiveStream.model.js';
import { QotdEntry } from '../qotd/models/QotdEntry.model.js';
import { ExamRoutine } from '../exam-routine/models/ExamRoutine.model.js';
import { PaperAttempt } from '../evaluation/models/PaperAttempt.model.js';
import { Module } from '../setup/models/Module.model.js';
import { getSalaryUsageStats } from '../salary/salary.service.js';

const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getAdminOverview() {
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const today = isoDate(now);

  const [
    usersTotal,
    usersActive,
    usersPending,
    usersSuspended,
    usersPaid,
    usersNew7,
    usersNew30,
    usersByType,
    activeUsers7,
    questionsTotal,
    questionsPublished,
    questionsDraft,
    questionsQc,
    papersTotal,
    papersPublished,
    booksTotal,
    booksPublished,
    submittedPending,
    submittedTotal,
    notificationsSent,
    notificationsSent30,
    liveUpcoming,
    liveNow,
    qotdUpcoming,
    qotdToday,
    routinesTotal,
    attempts7,
    attempts30,
    stoppedModules,
    recentUsers,
    recentSubmitted,
    salary,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: 'active' }),
    User.countDocuments({ status: 'pending_verify' }),
    User.countDocuments({ status: { $in: ['suspended', 'inactive'] } }),
    User.countDocuments({ amount_received: { $gt: 0 } }),
    User.countDocuments({ created_at: { $gte: since7 } }),
    User.countDocuments({ created_at: { $gte: since30 } }),
    User.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$user_type', count: { $sum: 1 } } },
    ]),
    UserActivityLog.distinct('user_id', { created_at: { $gte: since7 } }).then((ids) => ids.length),
    Question.countDocuments({ is_active: true }),
    Question.countDocuments({ is_active: true, is_published: true }),
    Question.countDocuments({ is_active: true, review_status: 'draft' }),
    Question.countDocuments({ is_active: true, review_status: 'quality_check' }),
    PaperDetail.countDocuments({ is_active: true }),
    PaperDetail.countDocuments({ is_active: true, is_published: true }),
    BookInfo.countDocuments({ is_active: true }),
    BookInfo.countDocuments({ is_active: true, is_published: true }),
    SubmittedQuestion.countDocuments({ status: 'pending' }),
    SubmittedQuestion.countDocuments({}),
    AdminNotification.countDocuments({ status: 'sent', source: { $nin: ['schedule', 'billing', 'community'] } }),
    AdminNotification.countDocuments({ status: 'sent', source: { $nin: ['schedule', 'billing', 'community'] }, sent_at: { $gte: since30 } }),
    LiveStream.countDocuments({ is_active: true, status: 'scheduled', scheduled_at: { $gte: now } }),
    LiveStream.countDocuments({ is_active: true, status: { $in: ['live', 'paused'] } }),
    QotdEntry.distinct('date', { is_active: true, date: { $gte: today } }).then((d) => d.length),
    QotdEntry.countDocuments({ is_active: true, date: today }),
    ExamRoutine.countDocuments({}),
    PaperAttempt.countDocuments({ submitted_at: { $gte: since7 } }),
    PaperAttempt.countDocuments({ submitted_at: { $gte: since30 } }),
    Module.find({ is_active: false }).select('code name_en stopped_reason').lean(),
    User.find({})
      .sort({ created_at: -1 })
      .limit(6)
      .select('full_name_en email phone user_type status created_at')
      .lean(),
    SubmittedQuestion.find({ status: 'pending' })
      .sort({ created_at: -1 })
      .limit(5)
      .select('body created_at')
      .lean(),
    getSalaryUsageStats().catch(() => null),
  ]);

  return {
    generated_at: now.toISOString(),
    users: {
      total: usersTotal,
      active: usersActive,
      pending_verify: usersPending,
      suspended: usersSuspended,
      paid: usersPaid,
      new_7d: usersNew7,
      new_30d: usersNew30,
      active_7d: activeUsers7,
      by_type: Object.fromEntries(usersByType.map((r) => [r._id, r.count])) as Record<string, number>,
    },
    content: {
      questions: { total: questionsTotal, published: questionsPublished, draft: questionsDraft, quality_check: questionsQc },
      papers: { total: papersTotal, published: papersPublished },
      books: { total: booksTotal, published: booksPublished },
      exam_routines: routinesTotal,
      qotd: { upcoming_dates: qotdUpcoming, today_entries: qotdToday },
    },
    engagement: {
      paper_attempts_7d: attempts7,
      paper_attempts_30d: attempts30,
    },
    submitted_questions: { pending: submittedPending, total: submittedTotal },
    notifications: { sent: notificationsSent, sent_30d: notificationsSent30 },
    live: { upcoming: liveUpcoming, live_now: liveNow },
    stopped_modules: stoppedModules.map((m) => ({
      code: m.code,
      name: m.name_en,
      reason: m.stopped_reason ?? '',
    })),
    recent_users: recentUsers.map((u) => ({
      id: String(u._id),
      name: u.full_name_en,
      email: u.email,
      phone: u.phone,
      user_type: u.user_type,
      status: u.status,
      created_at: u.created_at?.toISOString?.() ?? '',
    })),
    recent_submitted_questions: recentSubmitted.map((q) => ({
      id: String(q._id),
      body: q.body,
      created_at: q.created_at?.toISOString?.() ?? '',
    })),
    salary,
  };
}

export type AdminOverview = Awaited<ReturnType<typeof getAdminOverview>>;
