import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTaka, type SalaryAccessListFilter, type SalaryBillAccessAdminRow } from '@ibas/shared-types';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { openWhatsAppToNumber } from '@/lib/contact';
import { isPlatformAdminUser } from '@/lib/module-access';
import { fetchAdminUsers, type AdminUserRow } from '@/lib/users-api';
import { colors, spacing } from '@/theme';

function money(n: number): string {
  return `৳ ${formatTaka(n)}`;
}

function GrantDirect({ onSaved }: { onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [bills, setBills] = useState('50');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    apiFetch<{ data: { bulk_size: number; bulk_price: number } }>('/salary/admin/bulk-size')
      .then((res) => {
        setBills(String(res.data.bulk_size || 50));
        if ((res.data.bulk_price ?? 0) > 0) setPrice(String(res.data.bulk_price));
      })
      .catch(() => undefined);
  }, []);

  async function search() {
    const q = `${name} ${phone}`.trim();
    if (!q) return;
    setNote('');
    try {
      const res = await fetchAdminUsers({ q, limit: 10 });
      setResults(res.data);
      setSelected(null);
      if (res.data.length === 0) setNote('No user found.');
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : 'Search failed');
    }
  }

  async function grant() {
    if (!selected) return;
    const value = Number(bills);
    const chargeValue = price.trim() === '' ? 0 : Number(price);
    if (!Number.isInteger(value) || value < 1) {
      Alert.alert('Enter a whole number of bills (1 or more).');
      return;
    }
    if (!Number.isInteger(chargeValue) || chargeValue < 0) {
      Alert.alert('Enter a whole Taka amount for the price.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/salary/admin/access/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ bill_limit: value, charge_amount: chargeValue > 0 ? chargeValue : undefined }),
      });
      setNote(`${selected.full_name_en} can use up to ${value} bills${chargeValue > 0 ? ` · charged ${money(chargeValue)}` : ''}.`);
      setSelected(null);
      setResults([]);
      setName('');
      setPhone('');
      await onSaved();
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : 'Could not approve');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.grant}>
      <Text style={styles.grantTitle}>Approve a user directly</Text>
      <Text style={styles.meta}>For someone who has not requested bill access and is not approved yet.</Text>
      {note ? <Text style={styles.suggest}>{note}</Text> : null}
      <View style={styles.searchRow}>
        <Ionicons name="person-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          keyboardType="default"
          returnKeyType="search"
          onSubmitEditing={() => void search()}
        />
      </View>
      <View style={styles.searchRow}>
        <Ionicons name="call-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={phone}
          onChangeText={setPhone}
          placeholder="Mobile number"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          onSubmitEditing={() => void search()}
        />
      </View>
      <Pressable style={styles.searchBtn} onPress={() => void search()}>
        <Text style={styles.chipTextOn}>Find user</Text>
      </Pressable>
      {!selected && results.length > 0 ? (
        <View style={styles.results}>
          {results.map((person) => (
            <Pressable key={person.id} style={styles.resultRow} onPress={() => setSelected(person)}>
              <Text style={styles.name}>{person.full_name_en}</Text>
              <Text style={styles.phone}>{person.phone}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {selected ? (
        <View style={styles.selectedBox}>
          <Text style={styles.name}>{selected.full_name_en}</Text>
          <Text style={styles.phone}>{selected.phone}</Text>
          <View style={styles.editor}>
            <View style={styles.editorField}>
              <Text style={styles.payLabel}>Total bills</Text>
              <TextInput value={bills} onChangeText={setBills} keyboardType="number-pad" style={styles.editorInput} />
            </View>
            <View style={styles.editorField}>
              <Text style={styles.payLabel}>Price (৳)</Text>
              <TextInput value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={styles.editorInput} />
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable style={[styles.searchBtn, busy && styles.pressed]} disabled={busy} onPress={() => void grant()}>
              <Text style={styles.chipTextOn}>{busy ? 'Saving…' : 'Approve'}</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={() => setSelected(null)}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function wholeTaka(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function BillingEditor({ item, onSaved }: { item: SalaryBillAccessAdminRow; onSaved: () => Promise<void> }) {
  const [charged, setCharged] = useState(String(item.billing.charged_total));
  const [received, setReceived] = useState(String(item.billing.received_total));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCharged(String(item.billing.charged_total));
    setReceived(String(item.billing.received_total));
  }, [item.user.id, item.billing.charged_total, item.billing.received_total]);

  async function save() {
    const chargedTotal = wholeTaka(charged);
    const receivedTotal = wholeTaka(received);
    if (chargedTotal == null || receivedTotal == null) {
      Alert.alert('Enter whole Taka amounts for the charged total and the received total.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/salary/admin/access/${item.user.id}/billing`, {
        method: 'PUT',
        body: JSON.stringify({ charged_total: chargedTotal, received_total: receivedTotal }),
      });
      await onSaved();
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : 'Could not update the amounts');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.editor}>
      <View style={styles.editorField}>
        <Text style={styles.payLabel}>Total charged</Text>
        <TextInput
          value={charged}
          onChangeText={setCharged}
          keyboardType="number-pad"
          style={styles.editorInput}
        />
      </View>
      <View style={styles.editorField}>
        <Text style={styles.payLabel}>Received</Text>
        <TextInput
          value={received}
          onChangeText={setReceived}
          keyboardType="number-pad"
          style={styles.editorInput}
        />
      </View>
      <Pressable style={[styles.searchBtn, busy && styles.pressed]} disabled={busy} onPress={() => void save()}>
        <Text style={styles.chipTextOn}>{busy ? 'Saving…' : 'Update'}</Text>
      </Pressable>
    </View>
  );
}

const FILTERS: Array<{ id: SalaryAccessListFilter | 'all'; label: string }> = [
  { id: 'pending', label: 'Requests' },
  { id: 'approved', label: 'Approved' },
  { id: 'active', label: 'Both' },
];

export default function SalaryBillAccessScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<SalaryAccessListFilter | 'all'>('pending');
  const [nameQuery, setNameQuery] = useState('');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [rows, setRows] = useState<SalaryBillAccessAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [draft, setDraft] = useState<{ row: SalaryBillAccessAdminRow; add: boolean; text: string } | null>(null);

  const load = useCallback(async (status: SalaryAccessListFilter | 'all', q: string) => {
    setError('');
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (status !== 'all') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const res = await apiFetch<{ data: SalaryBillAccessAdminRow[] }>(`/salary/admin/access?${params.toString()}`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load salary bill access');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!isPlatformAdminUser(user)) return;
      setLoading(true);
      void load(filter, applied);
    }, [user, filter, applied, load]),
  );

  function openDraft(row: SalaryBillAccessAdminRow, add: boolean) {
    const current = add
      ? String(row.request.requested_bills || 1)
      : String(row.request.pending ? row.bills_used + (row.request.requested_bills ?? 0) : row.bill_limit);
    setDraft({ row, add, text: current });
  }

  async function saveDraft() {
    if (!draft) return;
    const value = Number(draft.text);
    if (!Number.isInteger(value) || value < (draft.add ? 1 : 0)) {
      Alert.alert('Enter a whole number of bills.');
      return;
    }
    const bill_limit = draft.add ? draft.row.bill_limit + value : value;
    setBusyId(draft.row.user.id);
    try {
      await apiFetch(`/salary/admin/access/${draft.row.user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ bill_limit }),
      });
      setDraft(null);
      await load(filter, applied);
    } catch (err) {
      Alert.alert(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusyId('');
    }
  }

  if (!isPlatformAdminUser(user)) {
    return <BookEmpty title="Admin only" subtitle="Salary bill access is available to admins on this device." />;
  }
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <GrantDirect onSaved={() => load(filter, applied)} />
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={nameQuery}
            onChangeText={setNameQuery}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={() => setApplied(`${nameQuery} ${phoneQuery}`.trim())}
          />
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="call-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={phoneQuery}
            onChangeText={setPhoneQuery}
            placeholder="Mobile number"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            returnKeyType="search"
            onSubmitEditing={() => setApplied(`${nameQuery} ${phoneQuery}`.trim())}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={() => setApplied(`${nameQuery} ${phoneQuery}`.trim())}>
          <Text style={styles.chipTextOn}>Search</Text>
        </Pressable>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, filter === f.id && styles.chipOn]}>
              <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {loading && rows.length === 0 ? (
        <BookLoading />
      ) : error && rows.length === 0 ? (
        <BookError message={error} />
      ) : (
      <FlatList
        data={rows}
        keyExtractor={(row) => row.user.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<BookEmpty title="No users" subtitle="No salary bill requests in this list." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.user.full_name_en}</Text>
            <Text style={styles.phone}>{item.user.phone}</Text>
            <Text style={styles.meta}>{item.office_label || 'Office not selected'}</Text>
            <View style={styles.statRow}>
              <Text style={[styles.stat, styles.statApproved]}>Approved {item.bill_limit}</Text>
              <Text style={[styles.stat, styles.statUsed]}>Used {item.bills_used}</Text>
              <Text style={[styles.stat, styles.statLeft]}>Remaining {item.remaining}</Text>
              {item.request.pending ? (
                <Text style={[styles.stat, styles.statRequest]}>Request +{item.request.requested_bills ?? 0}</Text>
              ) : null}
            </View>
            <View style={styles.payRow}>
              <View style={styles.payCell}>
                <Text style={styles.payLabel}>Charged</Text>
                <Text style={styles.payCharged}>{money(item.billing.charged_total)}</Text>
              </View>
              <View style={styles.payCell}>
                <Text style={styles.payLabel}>Received</Text>
                <Text style={styles.payReceived}>{money(item.billing.received_total)}</Text>
              </View>
              <View style={styles.payCell}>
                <Text style={styles.payLabel}>Due</Text>
                <Text style={item.billing.due > 0 ? styles.payDue : styles.payReceived}>{money(item.billing.due)}</Text>
              </View>
            </View>
            {item.billing.suggested_charge != null ? (
              <Text style={styles.suggest}>Suggest now {money(item.billing.suggested_charge)}</Text>
            ) : null}
            <BillingEditor item={item} onSaved={() => load(filter, applied)} />
            {item.billing.payments.length > 0 ? (
              <View style={styles.payments}>
                {item.billing.payments.map((payment) => (
                  <View key={payment.id} style={styles.paymentLine}>
                    <Text style={styles.paymentDate}>{payment.received_at.split('-').reverse().join('-')}</Text>
                    <Text style={styles.payReceived}>{money(payment.amount)}</Text>
                    {payment.note ? <Text style={styles.meta}>{payment.note}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                style={styles.action}
                disabled={busyId === item.user.id}
                onPress={() => openDraft(item, false)}
              >
                <Text style={styles.actionText}>{item.request.pending ? 'Approve' : 'Set total'}</Text>
              </Pressable>
              {item.bill_limit > 0 ? (
                <Pressable style={styles.action} disabled={busyId === item.user.id} onPress={() => openDraft(item, true)}>
                  <Text style={styles.actionText}>More approval</Text>
                </Pressable>
              ) : null}
              {item.user.phone ? (
                <Pressable
                  style={styles.action}
                  onPress={() =>
                    openWhatsAppToNumber(item.user.phone, `Hi ${item.user.full_name_en}, regarding your ProAssist salary bill.`)
                  }
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#059669" />
                  <Text style={styles.actionText}>WhatsApp</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
      )}
      <Modal visible={draft != null} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDraft(null)}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text style={styles.name}>{draft?.add ? 'More approval' : draft?.row.request.pending ? 'Approve' : 'Set total'}</Text>
            <Text style={styles.meta}>
              {draft?.add
                ? `Adds to the current allowance (${draft.row.bill_limit}).`
                : 'Total bills allowed, including bills already used.'}
            </Text>
            <TextInput
              value={draft?.text ?? ''}
              onChangeText={(text) => setDraft((d) => (d ? { ...d, text } : d))}
              keyboardType="number-pad"
              style={styles.dialogInput}
            />
            <View style={styles.actions}>
              <Pressable style={styles.action} onPress={() => setDraft(null)}>
                <Text style={styles.actionText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.chipOn]} onPress={() => void saveDraft()}>
                <Text style={styles.chipTextOn}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  grant: {
    margin: spacing.md,
    marginBottom: 0,
    gap: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: spacing.md,
  },
  grantTitle: { fontSize: 16, fontWeight: '800', color: '#065f46' },
  results: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  resultRow: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  selectedBox: { gap: 4, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.sm },
  toolbar: { padding: spacing.md, gap: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: colors.text },
  searchBtn: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.text },
  chipTextOn: { color: colors.white },
  list: { padding: spacing.md, gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text },
  phone: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: 0.3 },
  meta: { fontSize: 12, color: colors.textMuted },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  stat: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 12, fontWeight: '800' },
  statApproved: { backgroundColor: '#dcfce7', color: '#166534' },
  statUsed: { backgroundColor: '#ffedd5', color: '#9a3412' },
  statLeft: { backgroundColor: '#dbeafe', color: '#1d4ed8' },
  statRequest: { backgroundColor: '#fce7f3', color: '#9d174d' },
  payRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  payCell: { flex: 1, borderRadius: 10, backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 6 },
  payLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  payCharged: { marginTop: 2, fontSize: 14, fontWeight: '800', color: '#0f172a' },
  payReceived: { marginTop: 2, fontSize: 14, fontWeight: '800', color: '#047857' },
  payDue: { marginTop: 2, fontSize: 14, fontWeight: '800', color: '#be123c' },
  suggest: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#92400e' },
  editor: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  editorField: { flex: 1, gap: 4 },
  editorInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: { opacity: 0.6 },
  payments: { marginTop: 6, gap: 4 },
  paymentLine: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  paymentDate: { fontSize: 12, fontWeight: '700', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: spacing.lg },
  dialog: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, gap: 8 },
  dialogInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
});
