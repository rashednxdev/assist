import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { renderToolkitTemplate, type TemplateField, type ToolkitItemDetail } from '@ibas/shared-types';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { IbasCard, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { loadLocalDraft, saveLocalDraft } from '@/lib/ibas-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

interface Draft {
  values: Record<string, string>;
  rows: Array<Record<string, string>>;
}

const DOC_CSS = `
body{font-family:-apple-system,Roboto,'Noto Sans Bengali',sans-serif;font-size:14px;line-height:1.55;color:#0f172a;margin:0;padding:14px}
p{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:8px 0}
td,th{border:1px solid #94a3b8;padding:5px;vertical-align:top;text-align:left}th{background:#f8fafc}
h1{font-size:18px}h2{font-size:16px}h3{font-size:15px}ol,ul{padding-left:20px}`;

function documentHtml(title: string, body: string): string {
  const safeTitle = title.replace(/[<>&]/g, '');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safeTitle}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>`;
}

function FieldInput({ field, value, onChange }: { field: TemplateField; value: string; onChange: (v: string) => void }) {
  const label = field.required ? `${field.label} *` : field.label;
  if (field.type === 'date') return <DateField label={label} value={value} onChange={onChange} />;
  return (
    <TextField
      label={label}
      hint={field.help}
      value={value}
      onChangeText={onChange}
      placeholder={field.placeholder}
      autoCapitalize="sentences"
      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
      multiline={field.type === 'textarea'}
      style={field.type === 'textarea' ? styles.textarea : undefined}
    />
  );
}

export function TemplateFiller({ item, color }: { item: ToolkitItemDetail; color: string }) {
  const fields = useMemo(() => item.fields ?? [], [item.fields]);
  const rowFields = useMemo(() => item.row_fields ?? [], [item.row_fields]);
  const hasRows = rowFields.length > 0;
  const rowLabel = item.row_label || 'Row';
  const storageKey = `template-${item.id}`;
  const blankDraft = useMemo<Draft>(() => ({ values: {}, rows: hasRows ? [{}] : [] }), [hasRows]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void loadLocalDraft<Draft>(storageKey).then((saved) => {
      if (!live) return;
      if (saved) setDraft({ ...blankDraft, ...saved });
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [storageKey, blankDraft]);

  useEffect(() => {
    if (loaded) void saveLocalDraft(storageKey, draft);
  }, [draft, loaded, storageKey]);

  const render = (missing: 'mark' | 'blank') =>
    renderToolkitTemplate({
      body: item.body ?? '',
      row_template: item.row_template,
      fields,
      row_fields: rowFields,
      values: draft.values,
      rows: draft.rows,
      missing,
    });

  const missingRequired = [
    ...fields.filter((f) => f.required && !draft.values[f.key]?.trim()).map((f) => f.label),
    ...draft.rows.flatMap((row, i) => rowFields.filter((f) => f.required && !row[f.key]?.trim()).map((f) => `${rowLabel} ${i + 1}: ${f.label}`)),
  ];

  function updateRow(idx: number, key: string, value: string) {
    setDraft((d) => ({ ...d, rows: d.rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)) }));
  }

  function moveRow(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const rows = [...d.rows];
      const j = idx + dir;
      if (j < 0 || j >= rows.length) return d;
      [rows[idx], rows[j]] = [rows[j]!, rows[idx]!];
      return { ...d, rows };
    });
  }

  async function print() {
    try {
      await Print.printAsync({ html: documentHtml(item.title, render('blank')) });
    } catch {
      showToast('Printing was cancelled or is not available.');
    }
  }

  async function sharePdf() {
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: documentHtml(item.title, render('blank')) });
      if (!(await Sharing.isAvailableAsync())) throw new Error('unavailable');
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: item.title, UTI: 'com.adobe.pdf' });
    } catch {
      showToast('Could not create the PDF on this device.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    Alert.alert('Reset template?', 'Clear everything you typed in this template?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setDraft(blankDraft) },
    ]);
  }

  return (
    <>
      {fields.length > 0 ? (
        <IbasCard>
          <SectionHead icon="create-outline" title="Details" color={color} />
          {fields.map((f) => (
            <FieldInput key={f.key} field={f} value={draft.values[f.key] ?? ''} onChange={(v) => setDraft((d) => ({ ...d, values: { ...d.values, [f.key]: v } }))} />
          ))}
        </IbasCard>
      ) : null}

      {hasRows ? (
        <IbasCard>
          <SectionHead
            icon="list-outline"
            title={`${rowLabel}s (${draft.rows.length})`}
            color={color}
            right={
              <Pressable onPress={() => setDraft((d) => ({ ...d, rows: [...d.rows, {}] }))} style={styles.addBtn} hitSlop={6}>
                <Ionicons name="add" size={16} color={color} />
                <Text style={[styles.addText, { color }]}>Add</Text>
              </Pressable>
            }
          />
          {draft.rows.length === 0 ? <Text style={ibasStyles.small}>No {rowLabel.toLowerCase()}s yet.</Text> : null}
          {draft.rows.map((row, idx) => (
            <View key={idx} style={styles.rowCard}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>
                  {rowLabel} {idx + 1}
                </Text>
                <View style={styles.rowTools}>
                  <Pressable disabled={idx === 0} onPress={() => moveRow(idx, -1)} hitSlop={6} accessibilityLabel="Move up">
                    <Ionicons name="arrow-up" size={18} color={idx === 0 ? colors.border : colors.textMuted} />
                  </Pressable>
                  <Pressable disabled={idx === draft.rows.length - 1} onPress={() => moveRow(idx, 1)} hitSlop={6} accessibilityLabel="Move down">
                    <Ionicons name="arrow-down" size={18} color={idx === draft.rows.length - 1 ? colors.border : colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => setDraft((d) => ({ ...d, rows: [...d.rows.slice(0, idx + 1), { ...row }, ...d.rows.slice(idx + 1)] }))}
                    hitSlop={6}
                    accessibilityLabel="Duplicate"
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => setDraft((d) => ({ ...d, rows: d.rows.filter((_, i) => i !== idx) }))} hitSlop={6} accessibilityLabel="Remove">
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              </View>
              {rowFields.map((f) => (
                <FieldInput key={f.key} field={f} value={row[f.key] ?? ''} onChange={(v) => updateRow(idx, f.key, v)} />
              ))}
            </View>
          ))}
        </IbasCard>
      ) : null}

      <IbasCard>
        <SectionHead icon="document-text-outline" title="Preview" color={color} />
        <View style={styles.actions}>
          <Pressable onPress={() => void sharePdf()} disabled={busy} style={({ pressed }) => [styles.primary, { backgroundColor: color }, (pressed || busy) && styles.pressed]}>
            <Ionicons name="share-outline" size={15} color={colors.white} />
            <Text style={styles.primaryText}>{busy ? 'Preparing…' : 'Share PDF'}</Text>
          </Pressable>
          <Pressable onPress={() => void print()} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Ionicons name="print-outline" size={15} color={colors.textMuted} />
            <Text style={styles.actionText}>Print</Text>
          </Pressable>
          <Pressable onPress={reset} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={15} color={colors.textMuted} />
            <Text style={styles.actionText}>Reset</Text>
          </Pressable>
        </View>
        {missingRequired.length > 0 ? (
          <Text style={styles.warnText}>
            Still empty: {missingRequired.slice(0, 6).join(', ')}
            {missingRequired.length > 6 ? '…' : ''}
          </Text>
        ) : null}
        <View style={styles.preview}>
          <WebView originWhitelist={['*']} source={{ html: documentHtml(item.title, render('mark')) }} style={styles.webview} nestedScrollEnabled />
        </View>
        <Text style={ibasStyles.small}>Highlighted brackets are blanks you haven't filled. Your entries are saved on this phone only.</Text>
      </IbasCard>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowCard: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowTools: {
    flexDirection: 'row',
    gap: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  warnText: {
    fontSize: 12,
    color: '#b45309',
  },
  preview: {
    height: 440,
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
