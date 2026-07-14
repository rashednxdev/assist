import { useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import { colors } from '@/theme';

interface HtmlContentProps {
  html?: string;
}

const baseStyle = {
  color: colors.text,
  fontSize: 15,
  lineHeight: 24,
  textAlign: 'justify' as const,
};

const tagsStyles = {
  body: baseStyle,
  p: { marginTop: 0, marginBottom: 8, textAlign: 'justify' as const },
  li: { marginBottom: 4, textAlign: 'justify' as const },
  h1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8, textAlign: 'justify' as const },
  h2: { fontSize: 18, fontWeight: '700' as const, marginBottom: 8, textAlign: 'justify' as const },
  h3: { fontSize: 16, fontWeight: '700' as const, marginBottom: 6, textAlign: 'justify' as const },
  strong: { fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const },
  div: { textAlign: 'justify' as const },
  span: { textAlign: 'justify' as const },
};

/** Match web RichTextView: wrap plain text in a paragraph so RenderHtml displays it. */
export function normalizeBookHtml(html?: string) {
  const trimmed = html?.trim();
  if (!trimmed) return '';
  const withBreaks = insertBookListMarkerLineBreaks(trimmed, '<br/>');
  return withBreaks.startsWith('<') ? withBreaks : `<p>${withBreaks}</p>`;
}

export function HtmlContent({ html }: HtmlContentProps) {
  const { width } = useWindowDimensions();
  const normalized = normalizeBookHtml(html);
  if (!normalized) return null;

  return (
    <RenderHtml
      contentWidth={width - 48}
      source={{ html: normalized }}
      baseStyle={baseStyle}
      tagsStyles={tagsStyles}
    />
  );
}
