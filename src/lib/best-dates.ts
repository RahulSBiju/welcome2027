import { LAST_SELECTABLE_DATE } from '@/lib/config';
import { datesInRange, dayCount, todayString } from '@/lib/dates';
import type { Availability } from '@/lib/types';

export type Stretch = {
  start: string;
  end: string;
  days: number;
  /** user_ids of everyone free on every day of this stretch */
  freeUserIds: string[];
};

/**
 * Finds the best stretches of consecutive days for the group to travel.
 *
 * For every group of people who are free together on some day, we find the
 * longest runs of days when that whole group is free. Stretches already
 * covered by a bigger group over a longer period are dropped.
 * Ranked by: most people free → longest stretch → earliest.
 */
export function findBestStretches(
  memberIds: string[],
  availability: Availability[],
  limit = 5
): Stretch[] {
  const members = new Set(memberIds);
  const today = todayString();

  // For each date, who is free?
  const freeByDate = new Map<string, Set<string>>();
  for (const range of availability) {
    if (!members.has(range.user_id)) continue;
    const start = range.start_date < today ? today : range.start_date;
    const end = range.end_date > LAST_SELECTABLE_DATE ? LAST_SELECTABLE_DATE : range.end_date;
    if (start > end) continue;
    for (const date of datesInRange(start, end)) {
      if (!freeByDate.has(date)) freeByDate.set(date, new Set());
      freeByDate.get(date)!.add(range.user_id);
    }
  }
  const dates = [...freeByDate.keys()].sort();

  // Every distinct group of people that is free together on at least one day.
  const groups = new Map<string, string[]>();
  for (const free of freeByDate.values()) {
    const group = [...free].sort();
    groups.set(group.join(), group);
  }

  // For each group, find the runs of consecutive days when all of them are free.
  const candidates: Stretch[] = [];
  for (const group of groups.values()) {
    let current: Stretch | null = null;
    for (const date of dates) {
      const free = freeByDate.get(date)!;
      const everyoneFree = group.every((id) => free.has(id));
      const continues = current && dayCount(current.end, date) === 2;
      if (everyoneFree && continues) {
        current!.end = date;
        current!.days += 1;
      } else if (everyoneFree) {
        if (current) candidates.push(current);
        current = { start: date, end: date, days: 1, freeUserIds: group };
      } else if (current) {
        candidates.push(current);
        current = null;
      }
    }
    if (current) candidates.push(current);
  }

  // Drop a stretch if a bigger-or-equal group is free for a longer-or-equal period around it.
  const covers = (a: Stretch, b: Stretch) =>
    a !== b &&
    a.start <= b.start &&
    a.end >= b.end &&
    b.freeUserIds.every((id) => a.freeUserIds.includes(id));
  const useful = candidates.filter((c) => !candidates.some((other) => covers(other, c)));

  return useful
    .sort(
      (a, b) =>
        b.freeUserIds.length - a.freeUserIds.length || b.days - a.days || a.start.localeCompare(b.start)
    )
    .slice(0, limit);
}
