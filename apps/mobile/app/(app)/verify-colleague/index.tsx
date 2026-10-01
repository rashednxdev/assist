import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT_CODE_LENGTH, type ContactVerificationCandidate, type ContactVerifiedRecord } from '@ibas/shared-types';
import { Avatar } from '@/components/contacts/ContactBits';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { fetchVerifiedByMe, lookupVerificationCode, verifyColleague } from '@/lib/contacts-api';
import { formatDate } from '@/lib/profile-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

export default function VerifyColleagueScreen() {
  const [code, setCode] = useState('');
  const [candidate, setCandidate] = useState<ContactVerificationCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [given, setGiven] = useState<ContactVerifiedRecord[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadGiven = useCallback(async () => {
    setGiven(await fetchVerifiedByMe().catch(() => []));
  }, []);

  useEffect(() => {
    void loadGiven();
  }, [loadGiven]);

  async function lookup() {
    setError('');
    setCandidate(null);
    if (code.length !== CONTACT_CODE_LENGTH) return setError(`Enter the ${CONTACT_CODE_LENGTH}-digit code.`);
    setBusy(true);
    try {
      setCandidate(await lookupVerificationCode(code));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check this code');
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!candidate) return;
    Alert.alert(
      'Verify this colleague?',
      `You confirm that ${candidate.person.name} works as ${candidate.person.designation?.name ?? 'the stated post'}${candidate.person.office ? ` at ${candidate.person.office.name}` : ''}. Your name is recorded as the verifier.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Verify', onPress: () => void doVerify() },
      ],
    );
  }

  async function doVerify() {
    if (!candidate) return;
    setBusy(true);
    try {
      const rec = await verifyColleague(candidate.code);
      setGiven((cur) => [rec, ...(cur ?? [])]);
      setCandidate(null);
      setCode('');
      showToast(`${rec.person.name} can now open contacts`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await loadGiven();
            setRefreshing(false);
          }}
        />
      }
    >
      <Text style={styles.intro}>
        A colleague who has set their office and designation gets an 8-digit code. Enter it here, check that the details are right, then verify — their
        contact directory opens straight away.
      </Text>

      <Panel title="Enter code" icon="keypad-outline">
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, CONTACT_CODE_LENGTH));
            setCandidate(null);
            setError('');
          }}
          placeholder="12345678"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={CONTACT_CODE_LENGTH}
          style={styles.codeInput}
          onSubmitEditing={() => void lookup()}
          returnKeyType="search"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!candidate ? (
          <Button title="Check code" onPress={() => void lookup()} loading={busy} disabled={code.length !== CONTACT_CODE_LENGTH} />
        ) : null}
      </Panel>

      {candidate ? (
        <Panel title="Is this your colleague?" icon="person-circle-outline">
          <View style={styles.person}>
            <Avatar id={candidate.person.id} initials={candidate.person.initials} size={52} />
            <View style={styles.flex}>
              <Text style={styles.name}>{candidate.person.name}</Text>
              {candidate.person.designation ? <Text style={styles.line}>{candidate.person.designation.name}</Text> : null}
              {candidate.person.section ? <Text style={styles.sub}>{candidate.person.section}</Text> : null}
              {candidate.person.office ? (
                <Text style={styles.sub}>
                  {candidate.person.office.name}
                  {candidate.person.office.parent_path ? ` · ${candidate.person.office.parent_path}` : ''}
                </Text>
              ) : null}
              {candidate.person.phone_masked ? <Text style={styles.sub}>Mobile {candidate.person.phone_masked}</Text> : null}
              <Text style={styles.sub}>Requested {formatDate(candidate.requested_at)}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Button title="Verify" onPress={confirm} loading={busy} style={styles.flex} />
            <Button
              title="Not them"
              variant="secondary"
              onPress={() => {
                setCandidate(null);
                setCode('');
              }}
              disabled={busy}
              style={styles.flex}
            />
          </View>
        </Panel>
      ) : null}

      <Panel title="Colleagues you verified" icon="shield-checkmark-outline" subtitle={given ? `${given.length} so far` : undefined}>
        {!given ? (
          <ActivityIndicator color={colors.primary} />
        ) : given.length === 0 ? (
          <Text style={styles.sub}>Nobody yet.</Text>
        ) : (
          given.map((g) => (
            <View key={g.id} style={styles.row}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.rowName}>{g.person.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {[g.person.designation, g.person.office].filter(Boolean).join(', ')}
                </Text>
              </View>
              <Text style={styles.sub}>{formatDate(g.verified_at)}</Text>
            </View>
          ))
        )}
      </Panel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
    fontVariant: ['tabular-nums'],
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
  person: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  line: {
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
