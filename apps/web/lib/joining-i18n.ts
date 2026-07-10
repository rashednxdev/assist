import {
  JOINING_APPROACH_EXCLUDE_KM,
  JOINING_MAX_DAYS_INCLUDING_WEEKLY,
  JOINING_PREPARATION_DAYS,
  type JoiningTravelMode,
} from '@ibas/shared-constants';
import type { JoiningPeriodResult } from '@ibas/shared-types';

type T = (key: string, values?: Record<string, string | number | Date>) => string;

const MODE_KEYS: Record<JoiningTravelMode, string> = {
  rail: 'modeRail',
  sea: 'modeSea',
  river: 'modeRiver',
  bus: 'modeBus',
  road: 'modeRoad',
  air: 'modeAir',
};

export function joiningModeLabel(t: T, mode: JoiningTravelMode): string {
  return t(MODE_KEYS[mode]);
}

/** Build localized rules from calculation result (ignores English rules_applied from shared calc). */
export function buildJoiningRulesLocalized(result: JoiningPeriodResult, t: T): string[] {
  const rules: string[] = [];
  const max = JOINING_MAX_DAYS_INCLUDING_WEEKLY;
  const prep = JOINING_PREPARATION_DAYS;

  if (!result.residence_change) {
    rules.push(t('ruleSameStation'));
    return rules;
  }

  rules.push(t('ruleChangeResidence'));
  rules.push(t('rulePrep', { prep }));
  rules.push(t('ruleWeekly'));
  rules.push(t('ruleMax', { max }));

  if (result.calc_method === 'actual') {
    rules.push(t('ruleActual'));
  } else {
    rules.push(t('ruleDistance'));
    rules.push(t('ruleApproach', { km: JOINING_APPROACH_EXCLUDE_KM }));
  }

  if (result.hod_extension_days > 0) {
    rules.push(t('ruleHod', { days: result.hod_extension_days, max }));
  }
  if (result.journeys.length > 1) {
    rules.push(t('ruleMulti'));
  }

  if (!result.start_date) {
    rules.push(t('ruleHandoverNoDate'));
    if (result.capped) rules.push(t('ruleCappedNoDate', { max }));
  } else {
    // Infer handover note from whether start equals a typical morning start — use generic morning assume if we can't tell
    rules.push(t('ruleHandoverAssume'));
    if (result.capped) rules.push(t('ruleCapped', { max }));
  }

  return rules;
}
