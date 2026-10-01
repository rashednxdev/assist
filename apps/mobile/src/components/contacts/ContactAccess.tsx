import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT_VERIFIER_GRADE_MAX, type ContactAccess } from '@ibas/shared-types';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { WorkIdentityForm } from '@/components/org/WorkIdentityForm';
import { Button } from '@/components/ui/Button';
import { fetchContactAccess, newVerificationCode } from '@/lib/contacts-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

interface Ctx {
  access: ContactAccess | null;
  error: string;
  reload: () => void;
  setAccess: (a: ContactAccess) => void;
  /** Explain that calling needs a package. */
  requestUpgrade: () => void;
}

const ContactAccessContext = createContext<Ctx | null>(null);

export function ContactAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<ContactAccess | null>(null);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);

  const reload = useCallback(() => {
    setError('');
    fetchContactAccess()
      .then(setAccess)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open contacts'));
  }, []);

  useEffect(reload, [reload]);

  const value = useMemo(
    () => ({ access, error, reload, setAccess, requestUpgrade: () => setUpgrade(true) }),
    [access, error, reload],
  );

  return (
    <ContactAccessContext.Provider value={value}>
      {children}
      <AccessRequiredScreen
        visible={upgrade}
        variant="unpaid"
        moduleTitle="Contacts calling"
        unpaidMessage="The contacts directory is free to browse. To see full phone numbers, call or WhatsApp colleagues, buy any package."
        onClose={() => setUpgrade(false)}
      />
    </ContactAccessContext.Provider>
  );
}

export function useContactAccess(): Ctx {
  const ctx = useContext(ContactAccessContext);
  if (!ctx) throw new Error('useContactAccess must be used inside <ContactAccessProvider>');
  return ctx;
}

/** Can the viewer dial? (false while loading) */
export function useCanDial(): boolean {
  return !!useContactAccess().access?.can_dial;
}

/** Renders children once the directory is open; asks for office + designation first. */
export function ContactsGate({ children }: { children: ReactNode }) {
  const { access, error, reload } = useContactAccess();

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
        <Text style={styles.error}>{error}</Text>
        <Button title="Try again" variant="secondary" onPress={reload} />
      </View>
    );
  }
  if (!access) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!access.ready) {
    return (
      <ScrollView contentContainerStyle={styles.gate} keyboardShouldPersistTaps="handled">
        <View style={styles.gateIcon}>
          <Ionicons name="book-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.gateTitle}>Contacts directory</Text>
        <Steps step={access.work ? 2 : 1} />
        {access.work ? (
          <VerificationStep access={access} />
        ) : (
          <>
            <Text style={styles.gateText}>
              Add your designation and office. Colleagues will find you under your office, and you can browse every office, sub-office and employee.
            </Text>
            <View style={styles.gateCard}>
              <WorkIdentityForm submitLabel="Save and continue" onSaved={reload} />
            </View>
          </>
        )}
        <View style={styles.gateNote}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={styles.gateNoteText}>You can hide your mobile number or email from the directory at any time.</Text>
        </View>
      </ScrollView>
    );
  }
  return <>{children}</>;
}

function Steps({ step }: { step: 1 | 2 }) {
  const items = ['Office & designation', 'Colleague verification'];
  return (
    <View style={styles.steps}>
      {items.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <View key={label} style={styles.step}>
            <View style={[styles.stepDot, (done || active) && styles.stepDotOn]}>
              {done ? <Ionicons name="checkmark" size={14} color={colors.white} /> : <Text style={[styles.stepNum, active && styles.stepNumOn]}>{n}</Text>}
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelOn]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function VerificationStep({ access }: { access: ContactAccess }) {
  const router = useRouter();
  const { reload, setAccess } = useContactAccess();
  const [busy, setBusy] = useState(false);
  const code = access.verification?.code;
  const pretty = code ? `${code.slice(0, 4)} ${code.slice(4)}` : '—';

  async function regenerate() {
    setBusy(true);
    try {
      const verification = await newVerificationCode();
      setAccess({ ...access, verification });
      showToast('New code ready — the old one no longer works');
    } catch (e) {
      Alert.alert('Could not get a new code', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={styles.gateText}>
        Share this code with a verified colleague of grade 1–{CONTACT_VERIFIER_GRADE_MAX}. They open “Verify a colleague” from their home menu and enter it. The directory opens as soon as they confirm.
      </Text>
      <View style={[styles.gateCard, styles.codeCard]}>
        <Text style={styles.codeLabel}>YOUR VERIFICATION CODE</Text>
        <Text style={styles.code} selectable>
          {pretty}
        </Text>
        <View style={styles.codeActions}>
          <Button
            title="Share code"
            onPress={() =>
              code
                ? void Share.share({ message: `Please verify me on ProAssist Contacts. My code: ${code}` })
                : undefined
            }
            disabled={!code}
          />
          <Button title="I've been verified" variant="secondary" onPress={reload} />
          <Button title={busy ? 'Getting a new code…' : 'Get a new code'} variant="ghost" onPress={() => void regenerate()} disabled={busy} />
        </View>
      </View>
      <Text style={styles.gateLink} onPress={() => router.push('/(app)/account/work' as Href)}>
        Wrong office or designation? Change it
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  error: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  gate: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  gateIcon: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#e8f2fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  gateText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
  },
  gateCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  gateNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gateNoteText: {
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 1,
  },
  gateLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  step: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepDotOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  stepNumOn: {
    color: colors.white,
  },
  stepLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepLabelOn: {
    color: colors.text,
    fontWeight: '700',
  },
  codeCard: {
    alignItems: 'stretch',
    gap: spacing.sm + 4,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textMuted,
    textAlign: 'center',
  },
  code: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 4,
    color: colors.primaryDark,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  codeActions: {
    gap: spacing.sm,
  },
});
