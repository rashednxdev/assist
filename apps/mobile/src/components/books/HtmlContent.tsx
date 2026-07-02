import { useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { colors } from '@/theme';

interface HtmlContentProps {
  html?: string;
}

const baseStyle = {
  color: colors.text,
  fontSize: 15,
  lineHeight: 24,
};

const tagsStyles = {
  body: baseStyle,
  p: { marginTop: 0, marginBottom: 8 },
  li: { marginBottom: 4 },
  h1: { fontSize: 20, fontWeight: '700' as const, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: '700' as const, marginBottom: 8 },
  h3: { fontSize: 16, fontWeight: '700' as const, marginBottom: 6 },
  strong: { fontWeight: '700' as const },
  em: { fontStyle: 'italic' as const },
};

export function HtmlContent({ html }: HtmlContentProps) {
  const { width } = useWindowDimensions();
  if (!html?.trim()) return null;

  return (
    <RenderHtml
      contentWidth={width - 48}
      source={{ html }}
      baseStyle={baseStyle}
      tagsStyles={tagsStyles}
    />
  );
}
