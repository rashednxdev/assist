import Anthropic from '@anthropic-ai/sdk';
import type { GenerateQuestionAiDto, GeneratedQuestionDraft } from '@ibas/shared-types';
import { parseLegacyExplanation } from '@ibas/shared-types';
import { env } from '../../config/env.js';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookTopic } from '../books/models/BookTopic.model.js';
import { BookTopicDetail } from '../books/models/BookTopicDetail.model.js';
import { BookSubTopic } from '../books/models/BookSubTopic.model.js';
import { BookSubTopicDetail } from '../books/models/BookSubTopicDetail.model.js';
import { QuestionType } from './models/QuestionType.model.js';

const MAX_SOURCE_CHARS = 8000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw badRequest('AI question generation is not configured (missing ANTHROPIC_API_KEY)');
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return client;
}

function stripHtml(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildSourceContext(dto: GenerateQuestionAiDto): Promise<{ heading: string; text: string }> {
  const chapter = await BookChapter.findById(dto.book_chapter_id);
  if (!chapter || !chapter.is_active) throw notFound('Book chapter not found');
  const book = await BookInfo.findById(chapter.book_info_id);

  const headingParts: string[] = [];
  if (book) headingParts.push(book.short_name || book.name_bn || book.name);
  headingParts.push(`Chapter ${chapter.chapter_number}${chapter.name ? ` — ${chapter.name}` : ''}`);

  const parts: string[] = [];
  if (chapter.description) parts.push(stripHtml(chapter.description));

  if (dto.book_sub_topic_id) {
    const subTopic = await BookSubTopic.findById(dto.book_sub_topic_id);
    if (!subTopic || !subTopic.is_active) throw notFound('Sub-rule not found');
    headingParts.push(subTopic.rule_number ? `Sub-rule ${subTopic.rule_number}` : subTopic.name || 'Sub-rule');
    if (subTopic.name) parts.push(subTopic.name);
    if (subTopic.description) parts.push(stripHtml(subTopic.description));
    const details = await BookSubTopicDetail.find({ book_sub_topic_id: subTopic._id, is_active: true }).sort({
      sort_order: 1,
    });
    parts.push(...details.map((d) => stripHtml(d.detail_text)));
  } else if (dto.book_topic_id) {
    const topic = await BookTopic.findById(dto.book_topic_id);
    if (!topic || !topic.is_active) throw notFound('Rule not found');
    headingParts.push(topic.rule_number ? `Rule ${topic.rule_number}` : topic.name || 'Rule');
    if (topic.name) parts.push(topic.name);
    if (topic.description) parts.push(stripHtml(topic.description));
    const details = await BookTopicDetail.find({ book_topic_id: topic._id, is_active: true }).sort({
      sort_order: 1,
    });
    parts.push(...details.map((d) => stripHtml(d.detail_text)));
  } else {
    const topics = await BookTopic.find({ book_chapter_id: chapter._id, is_active: true })
      .sort({ sort_order: 1 })
      .limit(20);
    for (const topic of topics) {
      const label = topic.rule_number ? `${topic.rule_number} ${topic.name ?? ''}`.trim() : topic.name;
      if (label) parts.push(label);
      if (topic.description) parts.push(stripHtml(topic.description));
      const details = await BookTopicDetail.find({ book_topic_id: topic._id, is_active: true })
        .sort({ sort_order: 1 })
        .limit(3);
      parts.push(...details.map((d) => stripHtml(d.detail_text)));
    }
  }

  let text = parts.filter(Boolean).join('\n\n');
  if (text.length > MAX_SOURCE_CHARS) text = `${text.slice(0, MAX_SOURCE_CHARS)}…`;
  if (!text.trim()) {
    throw badRequest('No book content found for this chapter/rule to generate a question from');
  }
  return { heading: headingParts.join(' › '), text };
}

const draftJsonSchema = {
  type: 'object',
  properties: {
    body_bn: {
      type: 'string',
      description: 'The question text, written in the same language as the source content (usually Bengali).',
    },
    body_en: {
      type: 'string',
      description: 'An English rendering of the question text (translate if the source is Bengali).',
    },
    options: {
      type: 'array',
      description:
        'Exactly 4 answer options when the question type is MCQ. Empty array for every other question type.',
      items: {
        type: 'object',
        properties: {
          option_key: { type: 'string', enum: ['a', 'b', 'c', 'd'] },
          option_text_en: { type: 'string' },
          option_text_bn: { type: 'string' },
        },
        required: ['option_key', 'option_text_en', 'option_text_bn'],
        additionalProperties: false,
      },
    },
    correct_option_key: {
      type: 'string',
      enum: ['a', 'b', 'c', 'd', ''],
      description: 'The key of the correct option for MCQ questions. Empty string for every other question type.',
    },
    correct_true_false: {
      type: 'string',
      enum: ['true', 'false', ''],
      description: 'The correct answer for True/False questions. Empty string for every other question type.',
    },
    explanation: {
      type: 'string',
      description:
        'A short explanation of why the answer is correct, grounded in the source text. Used for MCQ and True/False questions; empty string otherwise.',
    },
    model_answer: {
      type: 'string',
      description:
        'A model answer for descriptive / short-note question types. Empty string for MCQ and True/False questions.',
    },
  },
  required: [
    'body_bn',
    'body_en',
    'options',
    'correct_option_key',
    'correct_true_false',
    'explanation',
    'model_answer',
  ],
  additionalProperties: false,
} as const;

interface RawDraft {
  body_bn: string;
  body_en: string;
  options: { option_key: string; option_text_en: string; option_text_bn: string }[];
  correct_option_key: string;
  correct_true_false: string;
  explanation: string;
  model_answer: string;
}

export async function generateQuestionDraft(dto: GenerateQuestionAiDto): Promise<GeneratedQuestionDraft> {
  const qType = await QuestionType.findById(dto.question_type_id);
  if (!qType || !qType.is_active) throw notFound('Question type not found');

  const { heading, text } = await buildSourceContext(dto);

  const typeGuidance = !qType.has_options
    ? `This is a "${qType.name}" question: it has no answer options. Write the question in "body_bn"/"body_en", leave "options", "correct_option_key" and "correct_true_false" empty, and put a clear model answer in "model_answer" (leave "explanation" empty).`
    : qType.code === 'TF'
      ? 'This is a True/False question. Leave "options" and "correct_option_key" empty, set "correct_true_false" to "true" or "false", and put a short supporting explanation in "explanation" (leave "model_answer" empty).'
      : 'This is a multiple-choice question. Provide exactly 4 distinct options (keys a-d), set "correct_option_key" to the correct one, and put a short supporting explanation in "explanation" (leave "model_answer" empty).';

  const difficulty = dto.difficulty ?? 'medium';
  const extraInstructions = dto.instructions?.trim();

  const prompt = `Source material (from "${heading}"):\n"""\n${text}\n"""\n\n${typeGuidance}\n\nWrite one exam-quality question at "${difficulty}" difficulty, based only on the source material above. Do not invent facts that aren't supported by it.${
    extraInstructions ? `\n\nAdditional instructions from the question setter: ${extraInstructions}` : ''
  }`;

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: draftJsonSchema },
    },
    system:
      'You are an exam-question writer for a professional certification study platform. ' +
      'You write precise, unambiguous questions strictly grounded in the provided source text, ' +
      'with exactly one unambiguously correct answer. Respond only with the requested JSON.',
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
  if (!textBlock) throw badRequest('AI did not return a question — please try again');

  let raw: RawDraft;
  try {
    raw = JSON.parse(textBlock.text) as RawDraft;
  } catch {
    throw badRequest('AI returned an invalid response — please try again');
  }

  const isMcq = qType.has_options && qType.code === 'MCQ';
  const isTf = qType.has_options && qType.code === 'TF';

  return {
    body_bn: raw.body_bn?.trim() || raw.body_en?.trim() || '',
    body_en: raw.body_en?.trim() || raw.body_bn?.trim() || '',
    options: isMcq
      ? raw.options
          .filter((o) => o.option_text_en?.trim())
          .map((o) => ({
            option_key: o.option_key as 'a' | 'b' | 'c' | 'd',
            option_text_en: o.option_text_en.trim(),
            option_text_bn: o.option_text_bn?.trim() || undefined,
          }))
      : [],
    correct_option_key: isMcq && raw.correct_option_key ? (raw.correct_option_key as 'a' | 'b' | 'c' | 'd') : undefined,
    correct_true_false: isTf && raw.correct_true_false ? (raw.correct_true_false as 'true' | 'false') : undefined,
    explanation_sections: isMcq || isTf ? parseLegacyExplanation(raw.explanation ?? '') : [],
    model_answer_sections: !qType.has_options ? parseLegacyExplanation(raw.model_answer ?? '') : [],
  };
}
