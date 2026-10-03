import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CONTACT_VERIFIER_GRADE_MAX, type ContactAccess } from '@ibas/shared-types';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { WorkIdentityForm } from '@/components/org/WorkIdentityForm';
import { Button } from '@/components/ui/Button';
import { fetchContactAccess, newVerificationCode, saveContactConsent } from '@/lib/contacts-api';
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
    const step = !access.consented ? 1 : !access.work ? 2 : 3;
    return (
      <ScrollView contentContainerStyle={styles.gate} keyboardShouldPersistTaps="handled">
        <View style={styles.gateIcon}>
          <Ionicons name="book-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.gateTitle}>Contacts directory</Text>
        <Steps step={step} />
        {step === 1 ? (
          <ConsentStep />
        ) : step === 2 ? (
          <>
            <Text style={styles.gateText}>
              Add your department, office and designation. Colleagues will find you under your office, and you can browse the offices and employees of your department — and other departments too.
            </Text>
            <View style={styles.gateCard}>
              <WorkIdentityForm submitLabel="Save and continue" onSaved={reload} />
            </View>
          </>
        ) : (
          <VerificationStep access={access} />
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

const SHARED_DETAILS = [
  'Your name',
  'Department, office, section and designation',
  'Mobile, desk telephone and PABX',
  'Email address',
  'Additional charges you hold',
];

function ConsentStep() {
  const { setAccess } = useContactAccess();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      setAccess(await saveContactConsent(true));
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={styles.gateText}>Contacts is a shared directory. To use it, you agree that other Contacts users can see these details about you:</Text>
      <View style={[styles.gateCard, styles.consentCard]}>
        {SHARED_DETAILS.map((d) => (
          <View key={d} style={styles.consentRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            <Text style={styles.consentText}>{d}</Text>
          </View>
        ))}
        <Text style={styles.consentNote}>You can hide your mobile number or email at any time, and stop sharing from Privacy — you then leave the directory.</Text>
        <Pressable
          onPress={() => setAgree(!agree)}
          style={styles.agreeRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agree }}
        >
          <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={22} color={agree ? colors.primary : colors.textMuted} />
          <Text style={styles.agreeText}>I agree to share my details with Contacts users</Text>
        </Pressable>
        <Button title="Agree and continue" onPress={() => void accept()} loading={busy} disabled={!agree || busy} />
      </View>
    </>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ['Consent to share', 'Office & designation', 'Colleague verification'];
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
  consentCard: {
    gap: spacing.sm + 2,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  consentNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  agreeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
