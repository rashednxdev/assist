import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BLOOD_DONATION_GAP_MONTHS, BLOOD_GROUPS, donorGroupsFor, recipientGroupsOf, type BloodGroup } from '@ibas/shared-types';
import { Panel } from '@/components/ui/Panel';
import { RED_BORDER, RED_SOFT } from '@/components/blood/BloodBits';
import { colors, spacing } from '@/theme';

const CAN_DONATE = [
  'Aged 18–60 and in good health',
  'Weight at least 50 kg',
  `At least ${BLOOD_DONATION_GAP_MONTHS} months since your last whole-blood donation`,
  'Haemoglobin around 12.5 g/dL or higher',
  'Had a proper meal and plenty of water beforehand',
];

const PLEASE_WAIT = [
  'Fever, cold or any infection in the last 2 weeks',
  'Pregnant, breastfeeding, or gave birth in the last 6 months',
  'Tattoo, piercing or surgery in the last 6 months',
  'Took antibiotics in the last week',
  'History of hepatitis B/C, HIV or other blood-borne disease',
];

const CELL = 44;

export function BloodGuide({ myGroup }: { myGroup: BloodGroup | null }) {
  return (
    <View style={styles.wrap}>
      {myGroup ? (
        <View style={styles.mine}>
          <View style={styles.mineBox}>
            <Text style={styles.mineLabel}>You ({myGroup}) can give to</Text>
            <Text style={styles.mineValue}>{recipientGroupsOf(myGroup).join(' · ')}</Text>
          </View>
          <View style={styles.mineBox}>
            <Text style={styles.mineLabel}>You ({myGroup}) can receive from</Text>
            <Text style={styles.mineValue}>{donorGroupsFor(myGroup).join(' · ')}</Text>
          </View>
        </View>
      ) : null}

      <Panel title="Who can donate to whom" subtitle="Rows are the donor, columns the patient. O− can give to everyone; AB+ can receive from everyone.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.tr}>
              <View style={[styles.cell, styles.corner]}>
                <Text style={styles.cornerText}>Donor ↓</Text>
              </View>
              {BLOOD_GROUPS.map((g) => (
                <View key={g} style={[styles.cell, g === myGroup && styles.hl]}>
                  <Text style={styles.th}>{g}</Text>
                </View>
              ))}
            </View>
            {BLOOD_GROUPS.map((donor) => (
              <View key={donor} style={[styles.tr, styles.trBorder]}>
                <View style={[styles.cell, styles.corner, donor === myGroup && styles.hl]}>
                  <Text style={styles.th}>{donor}</Text>
                </View>
                {BLOOD_GROUPS.map((patient) => {
                  const ok = donorGroupsFor(patient).includes(donor);
                  return (
                    <View key={patient} style={[styles.cell, (donor === myGroup || patient === myGroup) && styles.hlSoft]}>
                      <Ionicons name={ok ? 'checkmark' : 'close'} size={16} color={ok ? '#059669' : '#cbd5e1'} />
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </Panel>

      <Panel title="You can usually donate if" icon="shield-checkmark">
        {CAN_DONATE.map((t) => (
          <View key={t} style={styles.li}>
            <Ionicons name="checkmark" size={16} color="#059669" />
            <Text style={styles.liText}>{t}</Text>
          </View>
        ))}
      </Panel>
      <Panel title="Please wait if" icon="pulse">
        {PLEASE_WAIT.map((t) => (
          <View key={t} style={styles.li}>
            <Ionicons name="close" size={16} color="#ef4444" />
            <Text style={styles.liText}>{t}</Text>
          </View>
        ))}
      </Panel>
      <Text style={styles.foot}>This is general guidance. The blood bank or doctor makes the final decision on the day.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  mine: {
    gap: spacing.sm,
  },
  mineBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RED_BORDER,
    backgroundColor: RED_SOFT,
    padding: spacing.md,
    gap: 4,
  },
  mineLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#b91c1c',
  },
  mineValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#7f1d1d',
  },
  tr: {
    flexDirection: 'row',
  },
  trBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cell: {
    width: CELL,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    width: 64,
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  cornerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  th: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b91c1c',
  },
  hl: {
    backgroundColor: RED_SOFT,
  },
  hlSoft: {
    backgroundColor: '#fff7f7',
  },
  li: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  liText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  foot: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
