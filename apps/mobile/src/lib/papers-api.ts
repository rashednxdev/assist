import { apiFetch } from './api';
import type { PaperComposeData, PaperItem, PaperType } from '@/types/papers';

export async function fetchPaperTypes() {
  const res = await apiFetch<{ data: PaperType[] }>('/papers/types');
  return res.data;
}

export async function fetchPapers(params?: { is_published?: 'true' | 'false' | '' }) {
  const search = new URLSearchParams();
  if (params?.is_published === 'true' || params?.is_published === 'false') {
    search.set('is_published', params.is_published);
  }
  const qs = search.toString();
  const res = await apiFetch<{ data: PaperItem[] }>(`/papers${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function fetchPaperCompose(id: string) {
  const res = await apiFetch<{ data: PaperComposeData }>(`/papers/${id}/compose`);
  return res.data;
}
