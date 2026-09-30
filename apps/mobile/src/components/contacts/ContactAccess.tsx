import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContactAccess } from '@ibas/shared-types';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { WorkIdentityForm } from '@/components/org/WorkIdentityForm';
import { Button } from '@/components/ui/Button';
import { fetchContactAccess } from '@/lib/contacts-api';
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
        <Text style={styles.gateText}>
          Add your designation and office to open the directory. Colleagues will find you under your office, and you can browse every office, sub-office and employee.
        </Text>
        <View style={styles.gateCard}>
          <WorkIdentityForm submitLabel="Save and open contacts" onSaved={reload} />
        </View>
        <View style={styles.gateNote}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={styles.gateNoteText}>You can hide your mobile number or email from the directory at any time.</Text>
        </View>
      </ScrollView>
    );
  }
  return <>{children}</>;
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
});
