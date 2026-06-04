import type { CodeType, TestResult } from '@/types';
import { typeData, defaultType } from '@/data/typeData';

export function calcResult(scores: Record<CodeType, number>): TestResult {
  const entries = Object.entries(scores) as [CodeType, number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);

  const primary = sorted[0][0];
  const secondary = sorted[1][0];
  const typeKey = `${primary}${secondary}`;

  const type = typeData[typeKey] ?? defaultType;

  return { scores, primary, secondary, typeKey, type };
}
