import { z } from 'zod';

/*
 * Community: users start discussions, others answer. Discussions and answers can be tagged with a
 * guided process (workflow), a toolkit item (checklist, template, guide) or a circular so readers
 * can open the related procedure directly.
 */

const mongoId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const COMMUNITY_LINK_TYPES = ['task', 'toolkit', 'circular'] as const;
export type CommunityLinkType = (typeof COMMUNITY_LINK_TYPES)[number];

/** Chip label per resolved item: "Workflow", "Checklist", "Template", "Guide", "Circular". */
export type CommunityLinkKind = 'workflow' | 'checklist' | 'template' | 'guide' | 'circular';

export const COMMUNITY_LINK_KIND_LABELS: Record<CommunityLinkKind, string> = {
  workflow: 'Workflow',
  checklist: 'Checklist',
  template: 'Template',
  guide: 'Guide',
  circular: 'Circular',
};

export const COMMUNITY_MAX_LINKS = 8;
export const COMMUNITY_MAX_TAGS = 5;

export interface CommunityLinkRecord {
  type: CommunityLinkType;
  id: string;
  kind: CommunityLinkKind;
  title: string;
  /** e.g. circular number and date, or the process module. */
  subtitle?: string;
  href: string;
}

const linkRefSchema = z.object({ type: z.enum(COMMUNITY_LINK_TYPES), id: mongoId });

const linksSchema = z
  .array(linkRefSchema)
  .max(COMMUNITY_MAX_LINKS, `Tag at most ${COMMUNITY_MAX_LINKS} items`)
  .default([])
  .transform((list) => list.filter((l, i) => list.findIndex((x) => x.type === l.type && x.id === l.id) === i));

/** Free hashtags: lowercase, letters/digits/dashes, Bangla allowed. */
const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .toLowerCase()
      .transform((t) => t.replace(/^#/, '').replace(/\s+/g, '-'))
      .pipe(z.string().min(2, 'Tags need 2+ characters').max(30, 'Tags are at most 30 characters')),
  )
  .max(COMMUNITY_MAX_TAGS, `Use at most ${COMMUNITY_MAX_TAGS} tags`)
  .default([])
  .transform((list) => [...new Set(list)]);

export const communityThreadInputSchema = z.object({
  title: z.string().trim().min(8, 'Title needs at least 8 characters').max(160),
  body: z.string().trim().min(10, 'Add a few more details (10+ characters)').max(10_000),
  category_id: mongoId,
  tags: tagsSchema,
  links: linksSchema,
});
export type CommunityThreadInput = z.input<typeof communityThreadInputSchema>;

export const communityAnswerInputSchema = z.object({
  body: z.string().trim().min(2, 'Write an answer').max(10_000),
  links: linksSchema,
});
export type CommunityAnswerInput = z.input<typeof communityAnswerInputSchema>;

export const COMMUNITY_SORTS = ['active', 'new', 'top', 'unanswered'] as const;
export type CommunitySort = (typeof COMMUNITY_SORTS)[number];
export const COMMUNITY_SORT_LABELS: Record<CommunitySort, string> = {
  active: 'Latest activity',
  new: 'Newest',
  top: 'Top voted',
  unanswered: 'Unanswered',
};

export const COMMUNITY_FILTERS = ['all', 'following', 'mine', 'solved', 'unsolved'] as const;
export type CommunityFilter = (typeof COMMUNITY_FILTERS)[number];

export const communityThreadQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: mongoId.optional().or(z.literal('')),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  link_type: z.enum(COMMUNITY_LINK_TYPES).optional(),
  link_id: mongoId.optional(),
  sort: z.enum(COMMUNITY_SORTS).default('active'),
  filter: z.enum(COMMUNITY_FILTERS).default('all'),
  /** Admin: include hidden discussions. */
  include_hidden: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const communityCategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  name_bn: z.string().trim().max(60).optional().or(z.literal('')),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, 'Use a hex colour like #0f766e')
    .default('#0f766e'),
  sort_order: z.coerce.number().int().min(0).max(9999).default(100),
  is_active: z.boolean().default(true),
});
export type CommunityCategoryInput = z.input<typeof communityCategoryInputSchema>;

export const COMMUNITY_REPORT_REASONS = ['spam', 'abusive', 'off_topic', 'wrong_info', 'other'] as const;
export type CommunityReportReason = (typeof COMMUNITY_REPORT_REASONS)[number];
export const COMMUNITY_REPORT_REASON_LABELS: Record<CommunityReportReason, string> = {
  spam: 'Spam or advertising',
  abusive: 'Abusive or disrespectful',
  off_topic: 'Off topic',
  wrong_info: 'Misleading information',
  other: 'Something else',
};

export const communityReportInputSchema = z.object({
  target_type: z.enum(['thread', 'answer']),
  target_id: mongoId,
  reason: z.enum(COMMUNITY_REPORT_REASONS),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const communityThreadModerationSchema = z
  .object({
    is_hidden: z.boolean().optional(),
    is_locked: z.boolean().optional(),
    is_pinned: z.boolean().optional(),
    category_id: mongoId.optional(),
    note: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .refine((d) => Object.keys(d).some((k) => k !== 'note'), 'Nothing to change');

export const communityAnswerModerationSchema = z.object({
  is_hidden: z.boolean(),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});

export const communityResolveReportSchema = z.object({
  action: z.enum(['dismiss', 'hide']),
});

export interface CommunityCategoryRecord {
  id: string;
  name: string;
  name_bn?: string;
  description?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  thread_count: number;
}

export interface CommunityAuthor {
  id: string;
  name: string;
  initials: string;
  is_admin: boolean;
  /** Designation and office as they were when the post was written. */
  designation?: string;
  designation_short?: string;
  office?: string;
  office_short?: string;
}

export interface CommunityThreadSummary {
  id: string;
  title: string;
  excerpt: string;
  category?: { id: string; name: string; color: string };
  tags: string[];
  link_kinds: CommunityLinkKind[];
  author: CommunityAuthor;
  answer_count: number;
  vote_score: number;
  view_count: number;
  is_solved: boolean;
  is_pinned: boolean;
  is_locked: boolean;
  is_hidden: boolean;
  created_at: string;
  last_activity_at: string;
  last_answer_by?: string;
  /** Current user state. */
  voted: boolean;
  following: boolean;
}

export interface CommunityAnswerRecord {
  id: string;
  body: string;
  links: CommunityLinkRecord[];
  author: CommunityAuthor;
  vote_score: number;
  voted: boolean;
  is_accepted: boolean;
  is_hidden: boolean;
  created_at: string;
  edited_at?: string;
  can_edit: boolean;
}

export interface CommunityThreadDetail extends Omit<CommunityThreadSummary, 'excerpt' | 'link_kinds'> {
  body: string;
  links: CommunityLinkRecord[];
  answers: CommunityAnswerRecord[];
  accepted_answer_id?: string;
  edited_at?: string;
  follower_count: number;
  can_edit: boolean;
  can_accept: boolean;
  can_moderate: boolean;
}

export interface CommunityOverview {
  categories: CommunityCategoryRecord[];
  trending_tags: Array<{ tag: string; count: number }>;
  top_contributors: Array<CommunityAuthor & { answers: number; accepted: number }>;
  stats: { threads: number; answers: number; solved: number };
}

export interface CommunityReportRecord {
  id: string;
  target_type: 'thread' | 'answer';
  target_id: string;
  thread_id: string;
  thread_title: string;
  excerpt: string;
  target_hidden: boolean;
  reason: CommunityReportReason;
  note?: string;
  reporter: { id: string; name: string };
  status: 'open' | 'resolved';
  resolution?: 'dismissed' | 'hidden';
  report_count: number;
  created_at: string;
}
