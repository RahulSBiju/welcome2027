import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { LAST_SELECTABLE_DATE } from '@/lib/config';
import { datesInRange, formatRange, todayString } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { Availability } from '@/lib/types';

type Props = {
  tripId: string;
  myUserId: string;
  myLeaveDays: number | null;
  myRanges: Availability[];
  onChanged: () => void;
};

type MarkedDates = Record<
  string,
  { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string }
>;

/** My leave days + a calendar to pick the date ranges I could travel. */
export function MyAvailabilityCard({ tripId, myUserId, myLeaveDays, myRanges, onChanged }: Props) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const today = todayString();

  // Leave days
  const [leaveDaysInput, setLeaveDaysInput] = useState(myLeaveDays != null ? String(myLeaveDays) : '');
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveMessage, setLeaveMessage] = useState<string | null>(null);

  // Calendar range selection
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [savingRange, setSavingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  async function saveLeaveDays() {
    const days = Number(leaveDaysInput);
    if (leaveDaysInput.trim() === '' || !Number.isInteger(days) || days < 0 || days > 365) {
      setLeaveMessage('Enter a whole number of days (0–365).');
      return;
    }
    setSavingLeave(true);
    const { error } = await supabase
      .from('trip_members')
      .update({ leave_days: days })
      .eq('trip_id', tripId)
      .eq('user_id', myUserId);
    setSavingLeave(false);

    if (error) {
      setLeaveMessage(error.message);
      return;
    }
    setLeaveMessage('Saved ✓');
    onChanged();
  }

  // Tap 1 picks the start, tap 2 picks the end, tap 3 starts a new range.
  function handleDayPress(day: DateData) {
    setRangeError(null);
    const date = day.dateString;
    if (!rangeStart || rangeEnd) {
      setRangeStart(date);
      setRangeEnd(null);
    } else if (date < rangeStart) {
      setRangeStart(date);
    } else {
      setRangeEnd(date);
    }
  }

  function clearSelection() {
    setRangeStart(null);
    setRangeEnd(null);
    setRangeError(null);
  }

  async function saveRange() {
    if (!rangeStart) return;
    setSavingRange(true);
    const { error } = await supabase.from('availability').insert({
      trip_id: tripId,
      user_id: myUserId,
      start_date: rangeStart,
      end_date: rangeEnd ?? rangeStart,
    });
    setSavingRange(false);

    if (error) {
      setRangeError(error.message);
      return;
    }
    clearSelection();
    onChanged();
  }

  // Calendar colouring: my saved ranges in a light tint, the current selection in solid blue.
  const marked: MarkedDates = {};
  const paint = (start: string, end: string, color: string, textColor: string) => {
    const days = datesInRange(start, end);
    days.forEach((date, i) => {
      marked[date] = { color, textColor, startingDay: i === 0, endingDay: i === days.length - 1 };
    });
  };
  myRanges.forEach((r) => paint(r.start_date, r.end_date, `${theme.primary}40`, theme.text));
  if (rangeStart) paint(rangeStart, rangeEnd ?? rangeStart, theme.primary, theme.onPrimary);

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        YOUR AVAILABILITY
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {/* Leave days */}
        <View style={styles.gapSmall}>
          <ThemedText type="smallBold">How many leave days can you take?</ThemedText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label="Leave days available"
                placeholder="e.g. 5"
                value={leaveDaysInput}
                onChangeText={(text) => {
                  setLeaveDaysInput(text.replace(/[^0-9]/g, ''));
                  setLeaveMessage(null);
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <Button title="Save" variant="secondary" onPress={saveLeaveDays} loading={savingLeave} />
          </View>
          {leaveMessage && (
            <ThemedText type="small" themeColor="textSecondary">
              {leaveMessage}
            </ThemedText>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {/* Calendar */}
        <View style={styles.gapSmall}>
          <ThemedText type="smallBold">When can you go?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap a start date, then an end date. You can add more than one range.
          </ThemedText>
        </View>

        <Calendar
          key={scheme}
          initialDate={today}
          minDate={today}
          maxDate={LAST_SELECTABLE_DATE}
          markingType="period"
          markedDates={marked}
          onDayPress={handleDayPress}
          firstDay={1}
          enableSwipeMonths
          disableAllTouchEventsForDisabledDays
          style={[styles.calendar, { borderColor: theme.border }]}
          theme={{
            calendarBackground: theme.background,
            dayTextColor: theme.text,
            monthTextColor: theme.text,
            textSectionTitleColor: theme.textSecondary,
            textDisabledColor: `${theme.textSecondary}66`,
            todayTextColor: theme.primary,
            arrowColor: theme.primary,
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
          }}
        />

        {rangeStart && (
          <View style={styles.gapSmall}>
            <ThemedText style={styles.bold}>{formatRange(rangeStart, rangeEnd ?? rangeStart)}</ThemedText>
            {!rangeEnd && (
              <ThemedText type="small" themeColor="textSecondary">
                Now tap an end date, or save this single day.
              </ThemedText>
            )}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button title="Add these dates" onPress={saveRange} loading={savingRange} />
              </View>
              <Button title="Clear" variant="secondary" onPress={clearSelection} />
            </View>
          </View>
        )}

        {rangeError && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {rangeError}
          </ThemedText>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          Your saved dates show under Members → More details, where you can tap &quot;Reset dates&quot; to remove them.
        </ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  gapSmall: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  calendar: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: Spacing.two,
  },
  bold: {
    fontWeight: 600,
  },
});
