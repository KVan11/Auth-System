import type { SubjectCandidate } from '../../types/medicine';

// Lọc danh sách theo phần đầu PTID (chạy trên trình duyệt)

// Phần đầu hợp lệ của PTID dạng 1234567A
const VALID_PREFIX = /^([1-9][0-9]{0,6}|[1-9][0-9]{6}[A-Z])$/;

export type SubjectFilter = { kind: 'all' } | { kind: 'invalid' } | { kind: 'prefix'; prefix: string };

// Bỏ khoảng trắng, in hoa chữ người dùng gõ
export const parseSubjectFilter = (input: string): SubjectFilter => {
  const normalized = input.replace(/\s/g, '').toUpperCase();
  if (normalized === '') return { kind: 'all' };
  return VALID_PREFIX.test(normalized) ? { kind: 'prefix', prefix: normalized } : { kind: 'invalid' };
};

// PTID null chỉ hiện khi ô lọc trống
export const applySubjectFilter = (items: SubjectCandidate[], filter: SubjectFilter) => {
  if (filter.kind === 'all') return items;
  if (filter.kind === 'invalid') return [];
  return items.filter((item) => item.ptid !== null && item.ptid.startsWith(filter.prefix));
};

// 'YYYY-MM-DD' → 'dd/mm/yyyy'; null → '—'
export const formatNgaySinh = (value: string | null) => {
  if (value === null) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};
