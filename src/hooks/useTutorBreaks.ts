/**
 * useTutorBreaks Hook
 * Data fetching hooks for tutor break management in Love2Learn tutoring app
 *
 * Tutors can manage break time slots within their availability windows.
 * Breaks are hidden from parents (shown as "unavailable") and block scheduling.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  TutorBreak,
  TutorAvailability,
  CreateTutorBreakInput,
  UpdateTutorBreakInput,
  ListQueryState,
  QueryState,
} from '../types/database';

/**
 * Filter options for break queries
 */
export interface BreakFilterOptions {
  tutorId?: string;
  dayOfWeek?: number;
  startDate?: string;
  endDate?: string;
  isRecurring?: boolean;
}

/**
 * Fetch all break slots for a tutor
 * @param options - Filter options
 * @returns List of break slots, loading state, and error
 */
export function useTutorBreaks(
  options: BreakFilterOptions = {}
): ListQueryState<TutorBreak> {
  const [data, setData] = useState<TutorBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { tutorId, dayOfWeek, startDate, endDate, isRecurring } = options;

  const fetchBreaks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('tutor_breaks')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      // Apply tutor filter
      if (tutorId) {
        query = query.eq('tutor_id', tutorId);
      }

      // Apply day of week filter
      if (dayOfWeek !== undefined) {
        query = query.eq('day_of_week', dayOfWeek);
      }

      // Apply recurring filter
      if (isRecurring !== undefined) {
        query = query.eq('is_recurring', isRecurring);
      }

      // Apply date range for specific dates
      if (startDate) {
        query = query.or(`specific_date.gte.${startDate},is_recurring.eq.true`);
      }
      if (endDate) {
        query = query.or(`specific_date.lte.${endDate},is_recurring.eq.true`);
      }

      const { data: breaks, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((breaks as TutorBreak[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch breaks');
      setError(errorMessage);
      console.error('useTutorBreaks error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tutorId, dayOfWeek, startDate, endDate, isRecurring]);

  useEffect(() => {
    fetchBreaks();
  }, [fetchBreaks]);

  return { data, loading, error, refetch: fetchBreaks };
}

/**
 * Fetch a single break slot by ID
 * @param id - Break slot UUID
 * @returns Single break slot, loading state, and error
 */
export function useBreakSlot(
  id: string | null
): QueryState<TutorBreak> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<TutorBreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSlot = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: slot, error: fetchError } = await supabase
        .from('tutor_breaks')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(slot as TutorBreak);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch break slot');
      setError(errorMessage);
      console.error('useBreakSlot error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSlot();
  }, [fetchSlot]);

  return { data, loading, error, refetch: fetchSlot };
}

/**
 * Create a new break slot
 * @returns Mutation function, loading state, and error
 */
export function useCreateBreak(): {
  createBreak: (input: CreateTutorBreakInput) => Promise<TutorBreak | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createBreak = useCallback(
    async (input: CreateTutorBreakInput): Promise<TutorBreak | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: createError } = await supabase
          .from('tutor_breaks')
          .insert(input)
          .select()
          .single();

        if (createError) {
          throw new Error(createError.message);
        }

        return data as TutorBreak;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to create break slot');
        setError(errorMessage);
        console.error('useCreateBreak error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createBreak, loading, error };
}

/**
 * Update an existing break slot
 * @returns Mutation function, loading state, and error
 */
export function useUpdateBreak(): {
  updateBreak: (
    id: string,
    input: UpdateTutorBreakInput
  ) => Promise<TutorBreak | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateBreak = useCallback(
    async (
      id: string,
      input: UpdateTutorBreakInput
    ): Promise<TutorBreak | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: updateError } = await supabase
          .from('tutor_breaks')
          .update(input)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        return data as TutorBreak;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to update break slot');
        setError(errorMessage);
        console.error('useUpdateBreak error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateBreak, loading, error };
}

/**
 * Delete a break slot
 * @returns Mutation function, loading state, and error
 */
export function useDeleteBreak(): {
  deleteBreak: (id: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteBreak = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('tutor_breaks')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to delete break slot');
      setError(errorMessage);
      console.error('useDeleteBreak error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteBreak, loading, error };
}

/**
 * Get break slots grouped by day of week
 * Useful for displaying weekly break schedule
 */
export function useWeeklyBreaks(tutorId?: string): {
  data: Map<number, TutorBreak[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { data, loading, error, refetch } = useTutorBreaks({
    tutorId,
    isRecurring: true,
  });

  // Group by day of week
  const groupedData = new Map<number, TutorBreak[]>();
  for (let i = 0; i < 7; i++) {
    groupedData.set(i, []);
  }

  data.forEach((slot) => {
    if (slot.day_of_week !== null) {
      const daySlots = groupedData.get(slot.day_of_week) || [];
      daySlots.push(slot);
      groupedData.set(slot.day_of_week, daySlots);
    }
  });

  return { data: groupedData, loading, error, refetch };
}

/**
 * Validate that a break falls within an availability window
 * @param breakStart - Break start time (HH:MM)
 * @param breakEnd - Break end time (HH:MM)
 * @param availabilitySlots - Available slots for the same day
 * @returns true if break is within at least one availability window
 */
export function isBreakWithinAvailability(
  breakStart: string,
  breakEnd: string,
  availabilitySlots: TutorAvailability[]
): boolean {
  // Convert time strings to comparable values
  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const breakStartMin = parseTime(breakStart);
  const breakEndMin = parseTime(breakEnd);

  // Check if break falls within any availability slot
  return availabilitySlots.some((slot) => {
    const slotStartMin = parseTime(slot.start_time);
    const slotEndMin = parseTime(slot.end_time);
    return breakStartMin >= slotStartMin && breakEndMin <= slotEndMin;
  });
}

/**
 * Get breaks for a specific date, considering both recurring and specific breaks
 */
export function useBreaksForDate(
  tutorId: string | undefined,
  date: string | undefined
): ListQueryState<TutorBreak> {
  const [data, setData] = useState<TutorBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBreaks = useCallback(async () => {
    if (!tutorId || !date) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get day of week from date
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();

      // Fetch recurring breaks for this day of week
      const { data: recurringBreaks, error: recurringError } = await supabase
        .from('tutor_breaks')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('is_recurring', true)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true });

      if (recurringError) {
        throw new Error(recurringError.message);
      }

      // Fetch specific date breaks
      const { data: specificBreaks, error: specificError } = await supabase
        .from('tutor_breaks')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('is_recurring', false)
        .eq('specific_date', date)
        .order('start_time', { ascending: true });

      if (specificError) {
        throw new Error(specificError.message);
      }

      // Combine breaks
      const allBreaks = [...(specificBreaks || []), ...(recurringBreaks || [])];
      setData(allBreaks as TutorBreak[]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch breaks for date');
      setError(errorMessage);
      console.error('useBreaksForDate error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tutorId, date]);

  useEffect(() => {
    fetchBreaks();
  }, [fetchBreaks]);

  return { data, loading, error, refetch: fetchBreaks };
}
