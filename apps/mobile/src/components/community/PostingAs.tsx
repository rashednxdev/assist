import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkIdentityForm } from '@/components/org/WorkIdentityForm';
import { useAuth } from '@/lib/auth-context';
import { isPlatformAdmin } from '@/lib/community-api';
import { officeLabel, useWorkIdentity } from '@/lib/org-api';
import { TEAL } from '@/components/community/CommunityBits';
import { colors, spacing } from '@/theme';

/** Whether the user may post now: members need office + designation, admins don't. */
export function useCanPost() {
  const { user } = useAuth();
  const { identity, loading, complete, refresh } = useWorkIdentity();
  const admin = isPlatformAdmin(user);
  return { identity, complete, admin, loading, ready: complete || admin, refresh };
}

/** "Posting as Designation, Office" bar; asks for the details inline when they're missing. */
export function PostingAs() {
  const { identity, complete, admin, loading } = useCanPost();
  const [editing, setEditing] = useState(false);

  if (loading) return <ActivityIndicator color={TEAL} style={styles.loader} />;

  if (!complete && !admin) {
    return (
      <View style={styles.missing}>
        <View style={styles.missingHead}>
          <Ionicons name="business-outline" size={16} color="#78350f" />
          <Text style={styles.missingText}>
            <Text style={styles.bold}>Add your designation and office to post.</Text> They are shown with your name so colleagues know who is asking or
            answering. You only need to do this once.
          </Text>
        </View>
        <WorkIdentityForm submitLabel="Save and continue" />
      </View>
    );
  }

  if (editing) {
    return (
      <View style={styles.editBox}>
        <View style={styles.editHead}>
          <Text style={styles.editTitle}>Update your designation and office</Text>
          <Pressable onPress={() => setEditing(false)} hitSlop={8}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
        <WorkIdentityForm submitLabel="Save" onSaved={() => setEditing(false)} />
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Ionicons name="checkmark-circle" size={16} color={TEAL} />
      <Text style={styles.barText} numberOfLines={2}>
        <Text style={styles.muted}>Posting as </Text>
        {complete && identity?.designation && identity.office ? `${identity.designation.name}, ${officeLabel(identity.office)}` : 'Administrator'}
      </Text>
      <Pressable onPress={() => setEditing(true)} hitSlop={8}>
        <Text style={styles.link}>{complete ? 'Change' : 'Add office'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: spacing.sm,
  },
  bold: {
    fontWeight: '800',
  },
  muted: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  missing: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  missingHead: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  missingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#78350f',
  },
  editBox: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
  },
  editHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#f8fafc',
  },
  barText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: TEAL,
  },
});
