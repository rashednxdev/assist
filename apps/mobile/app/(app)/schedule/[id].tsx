import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { describeRecurrence, type ScheduleChangeLogEntry, type ScheduleEventRecord } from '@ibas/shared-types';
import { Card, ErrorBox, SCH, SCH_SOFT, SectionLabel, Tag } from '@/components/schedule/ScheduleBits';
import { ScheduleChangeSheet } from '@/components/schedule/ScheduleChangeSheet';
import {
  deleteScheduleEvent,
  fetchScheduleEvent,
  formatAt,
  formatDayLong,
  formatDayShort,
  formatTime12,
  originalOccurrence,
  reminderLabel,
  slotText,
  useScheduleTypes,
  type ScheduleChangeMode,
} from '@/lib/schedule-api';
import { openProtectedFile } from '@/lib/protected-file';
import { openHref, webUrl } from '@/lib/web-href';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

const ACTION_LABEL: Record<ScheduleChangeLogEntry['action'], string> = {
  updated: 'Updated',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  restored: 'Back on schedule',
};

function changeSummary(c: ScheduleChangeLogEntry): string {
  const parts: string[] = [];
  if (c.occurrence_date) parts.push(`Date ${formatDayShort(c.occurrence_date)}`);
  if (c.action === 'postponed' && c.from && c.to) parts.push(`${slotText(c.from.date, c.from.time)} → ${slotText(c.to.date, c.to.time)}`);
  else if (c.action === 'updated' && c.from && c.to) parts.push(`Moved ${slotText(c.from.date, c.from.time)} → ${slotText(c.to.date, c.to.time)}`);
  else if (c.action === 'cancelled' && !c.occurrence_date && c.from) parts.push('Whole schedule');
  return parts.join(' · ');
}

function InfoLine({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.infoIcon} />
      <View style={styles.infoBody}>{children}</View>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, danger && styles.actionDanger, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={danger ? colors.error : SCH} />
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

export default function ScheduleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const occurrenceDate = typeof params.date === 'string' && params.date ? params.date : undefined;
  const { typeLabel, typeColor } = useScheduleTypes();
  const [ev, setEv] = useState<ScheduleEventRecord | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [changeMode, setChangeMode] = useState<ScheduleChangeMode | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.id) return;
    try {
      setEv(await fetchScheduleEvent(params.id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule');
    }
  }, [params.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmDelete() {
    if (!ev) return;
    Alert.alert('Delete schedule?', `Delete "${ev.title}"${ev.recurrence.freq !== 'none' ? ' and all its repeats' : ''}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteScheduleEvent(ev.id)
            .then(() => {
              showToast('Schedule deleted');
              router.back();
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Failed to delete'));
        },
      },
    ]);
  }

  async function openAttachment(fileId: string, name: string) {
    if (!ev) return;
    setOpening(fileId);
    try {
      await openProtectedFile(`/schedule/events/${ev.id}/attachments/${fileId}`, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open file');
    } finally {
      setOpening(null);
    }
  }

  if (!ev) {
    return <View style={styles.center}>{error ? <ErrorBox text={error} /> : <ActivityIndicator size="large" color={SCH} />}</View>;
  }

  const recurring = ev.recurrence.freq !== 'none';
  const origDate = originalOccurrence(ev, occurrenceDate);
  const override = origDate ? ev.overrides.find((o) => o.date === origDate) : undefined;
  const date = override?.new_date ?? occurrenceDate ?? ev.date;
  const time = override?.new_time ?? ev.time;
  const cancelled = ev.status === 'cancelled' || !!override?.cancelled;
  const moved = override?.new_date ? { date: override.date, time: ev.time } : !recurring && ev.postponed_from ? ev.postponed_from : undefined;
  const bannerNote = ev.status === 'cancelled' ? ev.cancel_note : override?.note;
  const postponeNote = !override && moved ? ev.change_log.find((c) => c.action === 'postponed' && !c.occurrence_date)?.note : undefined;
  const mine = ev.scope === 'personal' && ev.can_edit;
  const noteWho = ev.scope === 'universal' ? 'Note from admin' : 'Note';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      {error ? <ErrorBox text={error} /> : null}

      <Card>
        <View style={styles.tags}>
          <View style={[styles.kindDot, { backgroundColor: typeColor(ev.kind) }]} />
          <Text style={styles.kind}>{typeLabel(ev.kind)}</Text>
          <Tag label={ev.scope === 'universal' ? 'Official' : 'Personal'} tone={ev.scope === 'universal' ? 'info' : 'neutral'} />
          {cancelled ? <Tag label="Cancelled" tone="danger" /> : moved ? <Tag label="Postponed" tone="warning" /> : null}
        </View>
        <Text style={[styles.title, cancelled && styles.struck]}>{ev.title}</Text>

        {cancelled ? (
          <View style={[styles.banner, styles.bannerDanger]}>
            <View style={styles.bannerHead}>
              <Ionicons name="ban" size={16} color="#991b1b" />
              <Text style={[styles.bannerTitle, styles.dangerText]}>
                {ev.status === 'cancelled' ? 'This schedule has been cancelled' : `Cancelled for ${formatDayShort(origDate ?? date)}`}
              </Text>
            </View>
            {bannerNote ? <Text style={styles.dangerText}>{`${noteWho}: ${bannerNote}`}</Text> : null}
          </View>
        ) : moved ? (
          <View style={[styles.banner, styles.bannerWarn]}>
            <View style={styles.bannerHead}>
              <Ionicons name="calendar" size={16} color="#92400e" />
              <Text style={[styles.bannerTitle, styles.warnText]}>Postponed — was {slotText(moved.date, moved.time)}</Text>
            </View>
            {override?.note || postponeNote ? <Text style={styles.warnText}>{`${noteWho}: ${override?.note || postponeNote}`}</Text> : null}
          </View>
        ) : null}

        <InfoLine icon="calendar-outline">
          <Text style={styles.infoText}>
            {formatDayLong(date)}
            {ev.end_date && !recurring ? ` – ${formatDayLong(ev.end_date)}` : ''}
          </Text>
          <Text style={styles.infoMuted}>
            {time ? `${formatTime12(time)}${ev.end_time && !override?.new_time ? ` – ${formatTime12(ev.end_time)}` : ''}` : 'All day'}
          </Text>
        </InfoLine>
        {recurring ? (
          <InfoLine icon="repeat">
            <Text style={styles.infoText}>{describeRecurrence(ev.recurrence, ev.date)}</Text>
          </InfoLine>
        ) : null}
        {ev.location ? (
          <InfoLine icon="location-outline">
            <Text style={styles.infoText}>{ev.location}</Text>
          </InfoLine>
        ) : null}
        {ev.reminders.length > 0 ? (
          <InfoLine icon="notifications-outline">
            <Text style={styles.infoText}>{ev.reminders.map(reminderLabel).join(', ')}</Text>
          </InfoLine>
        ) : null}

        {ev.meeting_link && !cancelled ? (
          <Pressable style={({ pressed }) => [styles.join, pressed && styles.pressed]} onPress={() => void Linking.openURL(ev.meeting_link!)}>
            <Ionicons name="videocam" size={18} color={colors.white} />
            <Text style={styles.joinText}>Join online</Text>
          </Pressable>
        ) : null}
      </Card>

      {ev.description ? (
        <Card>
          <SectionLabel icon="document-text-outline" text="Details" />
          <Text style={styles.desc} selectable>
            {ev.description}
          </Text>
        </Card>
      ) : null}

      {ev.links.length > 0 ? (
        <Card>
          <SectionLabel icon="link" text="How to do it" />
          {ev.links.map((l) => (
            <Pressable key={`${l.type}:${l.id}`} style={({ pressed }) => [styles.item, pressed && styles.pressed]} onPress={() => openHref(router, l.href)}>
              <Tag label={l.subtitle} tone="info" />
              <Text style={styles.itemText} numberOfLines={2}>
                {l.title}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {ev.attachments.length > 0 ? (
        <Card>
          <SectionLabel icon="attach" text="Documents" />
          {ev.attachments.map((a) => (
            <Pressable
              key={a.id}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => void openAttachment(a.id, a.name)}
              disabled={opening === a.id}
            >
              <Ionicons name="document-text" size={20} color="#dc2626" />
              <Text style={styles.itemText} numberOfLines={2}>
                {a.name}
              </Text>
              {opening === a.id ? <ActivityIndicator size="small" color={SCH} /> : <Ionicons name="open-outline" size={16} color={colors.textMuted} />}
            </Pressable>
          ))}
        </Card>
      ) : null}

      {ev.change_log.length > 0 ? (
        <Card>
          <SectionLabel icon="chatbox-ellipses-outline" text={ev.scope === 'universal' ? 'Updates from admin' : 'Changes'} />
          <View style={styles.log}>
            {ev.change_log.slice(0, 10).map((c, i) => (
              <View key={`${c.at}-${i}`} style={styles.logItem}>
                <Text style={styles.logHead}>
                  <Text style={styles.logAction}>{ACTION_LABEL[c.action]}</Text> · {formatAt(c.at)}
                </Text>
                {changeSummary(c) ? <Text style={styles.infoMuted}>{changeSummary(c)}</Text> : null}
                {c.note ? <Text style={styles.infoText}>{c.note}</Text> : null}
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {mine ? (
        <View style={styles.actions}>
          <ActionBtn icon="create-outline" label="Edit" onPress={() => router.push(`/(app)/schedule/edit/${ev.id}` as Href)} />
          <ActionBtn icon="calendar-outline" label="Postpone" onPress={() => setChangeMode('postpone')} />
          {cancelled || ev.overrides.length > 0 ? <ActionBtn icon="refresh" label="Undo change" onPress={() => setChangeMode('restore')} /> : null}
          {ev.status !== 'cancelled' ? <ActionBtn icon="ban" label="Cancel" onPress={() => setChangeMode('cancel')} /> : null}
          <ActionBtn icon="trash-outline" label="Delete" danger onPress={confirmDelete} />
        </View>
      ) : ev.scope === 'universal' && ev.can_edit ? (
        <Pressable style={styles.webNote} onPress={() => void Linking.openURL(webUrl(`/admin/schedule?edit=${ev.id}`))}>
          <Ionicons name="globe-outline" size={16} color={SCH} />
          <Text style={styles.webNoteText}>Official schedules are managed on the website. Tap to open.</Text>
        </Pressable>
      ) : null}

      {changeMode ? (
        <ScheduleChangeSheet
          ev={ev}
          mode={changeMode}
          occurrenceDate={occurrenceDate}
          onClose={() => setChangeMode(null)}
          onDone={(rec) => {
            setEv(rec);
            setChangeMode(null);
            showToast('Schedule updated');
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  kindDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  kind: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 26,
  },
  struck: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  banner: {
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.sm + 4,
  },
  bannerDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  bannerWarn: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  bannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerTitle: {
    flex: 1,
    fontWeight: '700',
  },
  dangerText: {
    fontSize: 13,
    color: '#991b1b',
  },
  warnText: {
    fontSize: 13,
    color: '#92400e',
  },
  info: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  infoIcon: {
    marginTop: 1,
  },
  infoBody: {
    flex: 1,
    gap: 2,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  infoMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  join: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: SCH,
    marginTop: spacing.xs,
  },
  joinText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  log: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm + 4,
    gap: spacing.sm + 2,
  },
  logItem: {
    gap: 2,
  },
  logHead: {
    fontSize: 12,
    color: colors.textMuted,
  },
  logAction: {
    fontWeight: '800',
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: SCH_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionDanger: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: SCH,
  },
  actionTextDanger: {
    color: colors.error,
  },
  webNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: SCH_SOFT,
    padding: spacing.sm + 4,
  },
  webNoteText: {
    flex: 1,
    fontSize: 13,
    color: SCH,
  },
});
