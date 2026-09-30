import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { TextField } from '@/components/ui/TextField';
import { FileLinks, IbasCard, ibasStyles, RefChips } from '@/components/ibas/IbasBits';
import { formatDdMmYyyy, toIsoDate } from '@/lib/date-format';
import { loadLocalDraft, saveLocalDraft } from '@/lib/ibas-api';
import { colors, spacing } from '@/theme';

interface SavedRun {
  reference: string;
  checked: string[];
  notes: Record<string, string>;
}

const EMPTY_RUN: SavedRun = { reference: '', checked: [], notes: {} };

export function ChecklistRunner({ item, code, color }: { item: ToolkitItemDetail; code: string; color: string }) {
  const items = useMemo(() => item.items ?? [], [item.items]);
  const storageKey = `checklist-${item.id}`;
  const [run, setRun] = useState<SavedRun>(EMPTY_RUN);
  const [loaded, setLoaded] = useState(false);
  const [openHelp, setOpenHelp] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    void loadLocalDraft<SavedRun>(storageKey).then((saved) => {
      if (!live) return;
      if (saved) setRun({ ...EMPTY_RUN, ...saved });
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (loaded) void saveLocalDraft(storageKey, run);
  }, [run, loaded, storageKey]);

  const checked = new Set(run.checked.filter((id) => items.some((i) => i.id === id)));
  const missingRequired = items.filter((i) => i.required && !checked.has(i.id));
  const pct = items.length ? Math.round((checked.size / items.length) * 100) : 0;

  const sections = useMemo(() => {
    const out: Array<{ name: string; items: typeof items }> = [];
    for (const it of items) {
      const name = it.section?.trim() || '';
      const last = out[out.length - 1];
      if (last && last.name === name) last.items.push(it);
      else out.push({ name, items: [it] });
    }
    return out;
  }, [items]);

  function toggle(id: string) {
    setRun((r) => ({ ...r, checked: r.checked.includes(id) ? r.checked.filter((x) => x !== id) : [...r.checked, id] }));
  }

  function toggleHelp(id: string) {
    setOpenHelp((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function shareResult() {
    const header = [
      item.title,
      run.reference ? `Reference: ${run.reference}` : '',
      `Date: ${formatDdMmYyyy(toIsoDate(new Date()))}`,
      `Completed: ${checked.size}/${items.length}`,
    ].filter(Boolean);
    const lines = items.map((i) => {
      const note = run.notes[i.id]?.trim();
      return `${checked.has(i.id) ? '[x]' : '[ ]'} ${i.text}${i.required ? '' : ' (optional)'}${note ? ` — ${note}` : ''}`;
    });
    void Share.share({ title: item.title, message: `${header.join('\n')}\n\n${lines.join('\n')}` });
  }

  function reset() {
    Alert.alert('Reset checklist?', 'Clear all ticks, notes and the reference for this checklist?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setRun(EMPTY_RUN) },
    ]);
  }

  let counter = 0;

  return (
    <>
      <IbasCard>
        <TextField
          label="Reference"
          hint="Bill no., file no. or case name — saved on this phone only"
          value={run.reference}
          onChangeText={(v) => setRun((r) => ({ ...r, reference: v }))}
          placeholder="e.g. Bill #1234 / Contractor X"
        />
        <View style={styles.progressHead}>
          <Text style={ibasStyles.small}>
            {checked.size} of {items.length} done
          </Text>
          <Text style={ibasStyles.small}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        {items.length > 0 ? (
          missingRequired.length === 0 ? (
            <View style={styles.okBox}>
              <Ionicons name="checkmark-circle" size={16} color="#047857" />
              <Text style={styles.okText}>All required items are ticked.</Text>
            </View>
          ) : (
            <Text style={styles.warnText}>
              {missingRequired.length} required item{missingRequired.length === 1 ? '' : 's'} still open.
            </Text>
          )
        ) : null}
        <View style={styles.actions}>
          <Pressable onPress={shareResult} style={({ pressed }) => [styles.action, { borderColor: color }, pressed && styles.pressed]}>
            <Ionicons name="share-outline" size={15} color={color} />
            <Text style={[styles.actionText, { color }]}>Share result</Text>
          </Pressable>
          <Pressable onPress={reset} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={15} color={colors.textMuted} />
            <Text style={styles.actionText}>Reset</Text>
          </Pressable>
        </View>
      </IbasCard>

      {sections.map((sec, si) => (
        <IbasCard key={`${sec.name}-${si}`}>
          {sec.name ? <Text style={ibasStyles.label}>{sec.name}</Text> : null}
          {sec.items.map((it) => {
            counter += 1;
            const done = checked.has(it.id);
            const helpOpen = openHelp.has(it.id);
            return (
              <View key={it.id} style={[styles.item, done && styles.itemDone]}>
                <Pressable onPress={() => toggle(it.id)} style={styles.itemHead} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
                  <Ionicons name={done ? 'checkbox' : 'square-outline'} size={22} color={done ? '#059669' : colors.textMuted} />
                  <Text style={[styles.itemText, done && styles.itemTextDone]}>
                    <Text style={styles.counter}>{counter}. </Text>
                    {it.text}
                    {!it.required ? <Text style={styles.optional}> (optional)</Text> : null}
                  </Text>
                </Pressable>
                <View style={styles.itemBody}>
                  <RefChips code={code} refs={it.refs} color={color} />
                  <FileLinks files={it.attachments ?? []} compact />
                  {it.help ? (
                    <>
                      <Pressable onPress={() => toggleHelp(it.id)} style={styles.helpBtn} hitSlop={6}>
                        <Ionicons name={helpOpen ? 'chevron-up' : 'chevron-down'} size={12} color={color} />
                        <Text style={[styles.helpBtnText, { color }]}>{helpOpen ? 'Hide guidance' : 'How to check'}</Text>
                      </Pressable>
                      {helpOpen ? <Text style={styles.help}>{it.help}</Text> : null}
                    </>
                  ) : null}
                  <TextInput
                    value={run.notes[it.id] ?? ''}
                    onChangeText={(v) => setRun((r) => ({ ...r, notes: { ...r.notes, [it.id]: v } }))}
                    placeholder="Note (optional)"
                    placeholderTextColor={colors.textMuted}
                    style={styles.note}
                  />
                </View>
              </View>
            );
          })}
        </IbasCard>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  okBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    padding: 8,
  },
  okText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  warnText: {
    fontSize: 13,
    color: '#b45309',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  item: {
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  itemDone: {
    borderColor: '#a7f3d0',
    backgroundColor: '#f0fdf4',
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  itemTextDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  counter: {
    color: colors.textMuted,
  },
  optional: {
    fontSize: 12,
    color: colors.textMuted,
  },
  itemBody: {
    gap: 6,
    paddingLeft: 30,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  help: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 8,
    overflow: 'hidden',
  },
  note: {
    fontSize: 12,
    color: colors.text,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.border,
    paddingVertical: 4,
  },
});
