/**
 * useTutorAvailability Hook
 * Data fetching hooks for tutor availability management in Love2Learn tutoring app
 *
 * Tutors can manage their available time slots, and parents can view them
 * when requesting to reschedule lessons.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  TutorAvailability,
  CreateTutorAvailabilityInput,
  ListQueryState,
  QueryState,
} from '../types/database';

/**
 * Update input for tutor availability
 */
export interface UpdateTutorAvailabilityInput {
  day_of_week?: number | null;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  specific_date?: string | null;
  notes?: string | null;
}

/**
 * Filter options for availability queries
 */
export interface AvailabilityFilterOptions {
  tutorId?: string;
  dayOfWeek?: number;
  startDate?: string;
  endDate?: string;
  isRecurring?: boolean;
}

/**
 * Day names for display
 */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Format time string for display (e.g., "14:00" -> "2:00 PM")
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Fetch all availability slots for a tutor
 * @param options - Filter options
 * @returns List of availability slots, loading state, and error
 */
export function useTutorAvailability(
  options: AvailabilityFilterOptions = {}
): ListQueryState<TutorAvailability> {
  const [data, setData] = useState<TutorAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { tutorId, dayOfWeek, startDate, endDate, isRecurring } = options;

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('tutor_availability')
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

      const { data: availability, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((availability as TutorAvailability[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch availability');
      setError(errorMessage);
      console.error('useTutorAvailability error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tutorId, dayOfWeek, startDate, endDate, isRecurring]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return { data, loading, error, refetch: fetchAvailability };
}

/**
 * Fetch a single availability slot by ID
 * @param id - Availability slot UUID
 * @returns Single availability slot, loading state, and error
 */
export function useAvailabilitySlot(
  id: string | null
): QueryState<TutorAvailability> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<TutorAvailability | null>(null);
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
        .from('tutor_availability')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(slot as TutorAvailability);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch availability slot');
      setError(errorMessage);
      console.error('useAvailabilitySlot error:', errorMessage);
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
 * Create a new availability slot
 * @returns Mutation function, loading state, and error
 */
export function useCreateAvailability(): {
  createAvailability: (
    input: CreateTutorAvailabilityInput
  ) => Promise<TutorAvailability | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createAvailability = useCallback(
    async (input: CreateTutorAvailabilityInput): Promise<TutorAvailability | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: createError } = await supabase
          .from('tutor_availability')
          .insert(input)
          .select()
          .single();

        if (createError) {
          throw new Error(createError.message);
        }

        return data as TutorAvailability;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to create availability slot');
        setError(errorMessage);
        console.error('useCreateAvailability error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createAvailability, loading, error };
}

/**
 * Update an existing availability slot
 * @returns Mutation function, loading state, and error
 */
export function useUpdateAvailability(): {
  updateAvailability: (
    id: string,
    input: UpdateTutorAvailabilityInput
  ) => Promise<TutorAvailability | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateAvailability = useCallback(
    async (
      id: string,
      input: UpdateTutorAvailabilityInput
    ): Promise<TutorAvailability | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: updateError } = await supabase
          .from('tutor_availability')
          .update(input)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        return data as TutorAvailability;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to update availability slot');
        setError(errorMessage);
        console.error('useUpdateAvailability error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateAvailability, loading, error };
}

/**
 * Delete an availability slot
 * @returns Mutation function, loading state, and error
 */
export function useDeleteAvailability(): {
  deleteAvailability: (id: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteAvailability = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('tutor_availability')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to delete availability slot');
      setError(errorMessage);
      console.error('useDeleteAvailability error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteAvailability, loading, error };
}

/**
 * Get availability slots grouped by day of week
 * Useful for displaying a weekly availability calendar
 */
export function useWeeklyAvailability(tutorId?: string): {
  data: Map<number, TutorAvailability[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { data, loading, error, refetch } = useTutorAvailability({
    tutorId,
    isRecurring: true,
  });

  // Group by day of week
  const groupedData = new Map<number, TutorAvailability[]>();
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
 * Check if a specific time slot is available
 * @param tutorId - Tutor UUID
 * @param date - Date to check
 * @param startTime - Start time (HH:MM format)
 * @param endTime - End time (HH:MM format)
 */
export function useCheckAvailability(
  tutorId: string,
  date: string,
  startTime: string,
  endTime: string
): { isAvailable: boolean; loading: boolean; error: Error | null } {
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get day of week from date (0-6, Sunday-Saturday)
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();

        // Check for recurring availability on this day
        const { data: recurringSlots, error: recurringError } = await supabase
          .from('tutor_availability')
          .select('*')
          .eq('tutor_id', tutorId)
          .eq('is_recurring', true)
          .eq('day_of_week', dayOfWeek)
          .lte('start_time', startTime)
          .gte('end_time', endTime);

        if (recurringError) {
          throw new Error(recurringError.message);
        }

        // Check for specific date availability
        const { data: specificSlots, error: specificError } = await supabase
          .from('tutor_availability')
          .select('*')
          .eq('tutor_id', tutorId)
          .eq('is_recurring', false)
          .eq('specific_date', date)
          .lte('start_time', startTime)
          .gte('end_time', endTime);

        if (specificError) {
          throw new Error(specificError.message);
        }

        // Available if either recurring or specific slot covers the time
        setIsAvailable(
          (recurringSlots?.length ?? 0) > 0 || (specificSlots?.length ?? 0) > 0
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to check availability');
        setError(errorMessage);
        console.error('useCheckAvailability error:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (tutorId && date && startTime && endTime) {
      checkAvailability();
    } else {
      setLoading(false);
    }
  }, [tutorId, date, startTime, endTime]);

  return { isAvailable, loading, error };
}

/**
 * Get available slots for a specific date, considering both recurring and specific availability
 * Returns slots that can be used for scheduling
 */
export function useAvailableSlotsForDate(
  tutorId: string | undefined,
  date: string | undefined
): ListQueryState<TutorAvailability> {
  const [data, setData] = useState<TutorAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSlots = useCallback(async () => {
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

      // Fetch recurring slots for this day of week
      const { data: recurringSlots, error: recurringError } = await supabase
        .from('tutor_availability')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('is_recurring', true)
        .eq('day_of_week', dayOfWeek)
        .order('start_time', { ascending: true });

      if (recurringError) {
        throw new Error(recurringError.message);
      }

      // Fetch specific date slots
      const { data: specificSlots, error: specificError } = await supabase
        .from('tutor_availability')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('is_recurring', false)
        .eq('specific_date', date)
        .order('start_time', { ascending: true });

      if (specificError) {
        throw new Error(specificError.message);
      }

      // Combine and dedupe (specific slots take priority)
      const allSlots = [...(specificSlots || []), ...(recurringSlots || [])];
      setData(allSlots as TutorAvailability[]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch available slots');
      setError(errorMessage);
      console.error('useAvailableSlotsForDate error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tutorId, date]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { data, loading, error, refetch: fetchSlots };
}

/**
 * Busy slot information returned from database function
 */
export interface BusySlot {
  start_time: string;
  end_time: string;
}

/**
 * Get busy time slots for a specific date
 * Uses a database function to bypass RLS and get ALL scheduled lessons
 * This ensures parents see all booked times, not just their own children's lessons
 * @param date - Date string (YYYY-MM-DD format)
 */
export function useBusySlotsForDate(
  date: string | undefined
): { data: BusySlot[]; loading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const [data, setData] = useState<BusySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBusySlots = useCallback(async () => {
    if (!date) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: busySlots, error: fetchError } = await supabase
        .rpc('get_busy_slots_for_date', { check_date: date });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((busySlots as BusySlot[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch busy slots');
      setError(errorMessage);
      console.error('useBusySlotsForDate error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchBusySlots();
  }, [fetchBusySlots]);

  return { data, loading, error, refetch: fetchBusySlots };
}
