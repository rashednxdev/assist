import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ContactPrivacy } from '@ibas/shared-types';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { fetchContactAccess, saveContactPrivacy } from '@/lib/contacts-api';
import { colors, spacing } from '@/theme';

/** Lets the signed-in user hide their mobile number / email from the contacts directory. */
export function DirectoryPrivacy({ initial, onChange }: { initial?: ContactPrivacy; onChange?: (p: ContactPrivacy) => void }) {
  const [privacy, setPrivacy] = useState<ContactPrivacy | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) return;
    fetchContactAccess()
      .then((a) => setPrivacy(a.privacy))
      .catch(() => setPrivacy({ hide_phone: false, hide_email: false }));
  }, [initial]);

  async function save(next: ContactPrivacy) {
    const prev = privacy;
    setPrivacy(next);
    setBusy(true);
    setError('');
    try {
      const saved = await saveContactPrivacy(next);
      setPrivacy(saved);
      onChange?.(saved);
    } catch (e) {
      setPrivacy(prev);
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!privacy) return null;
  return (
    <View style={styles.wrap}>
      <SwitchRow
        label="Hide my mobile number"
        hint="Colleagues see your name, designation and office, but not your number."
        value={privacy.hide_phone}
        disabled={busy}
        onChange={(v) => void save({ ...privacy, hide_phone: v })}
      />
      <SwitchRow
        label="Hide my email"
        hint="Your email is left out of the contacts directory."
        value={privacy.hide_email}
        disabled={busy}
        onChange={(v) => void save({ ...privacy, hide_email: v })}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  error: {
    fontSize: 12,
    color: colors.error,
  },
});
