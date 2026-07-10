import { apiFetch } from './api';
import {
  calculateJoiningPeriod,
  type JoiningPeriodCalculateDto,
  type JoiningPeriodResult,
} from '@ibas/shared-types';

export async function calculateJoiningPeriodApi(body: JoiningPeriodCalculateDto) {
  try {
    const res = await apiFetch<{ data: JoiningPeriodResult }>('/joining-period/calculate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.data;
  } catch {
    return calculateJoiningPeriod(body);
  }
}
