# Parent Portal Implementation Plan

> **Status**: In Progress
> **Started**: January 3, 2026
> **Last Updated**: January 3, 2026

## Overview

This document outlines the implementation plan for the Parent Portal feature, enabling parents to access their children's tutoring information, view calendars, print worksheets, and manage their account.

---

## Current State

| Component | Status |
|-----------|--------|
| Parent Records | Imported by tutor with `user_id = NULL` |
| Students | Already linked to parents via `parent_id` |
| Signup Trigger | **FIXED** - Now links existing parents on signup |
| RLS Policies | Configured for parent access via `get_parent_id()` |
| Parent View | Basic home screen exists but limited functionality |

---

## Phase Summary

| Phase | Description | Status | Priority |
|-------|-------------|--------|----------|
| Phase 1 | Parent Onboarding Flow | ✅ Complete | High |
| Phase 1.5 | Email Invitation System | ✅ Complete | High |
| Phase 2 | Parent Calendar View | ✅ Complete | High |
| Phase 3 | Parent Worksheets View | ✅ Complete | High |
| Phase 4 | Profile & Settings | ✅ Complete | Medium |
| Phase 5 | Enhanced Features | ⏳ Pending | Low |

---

## Phase 1: Parent Onboarding Flow

### Objective
Enable imported parents to activate their accounts and link to their existing parent records with children.

### Tasks

| Task | Description | Status | File(s) |
|------|-------------|--------|---------|
| 1.1 | Fix `handle_new_user` trigger to link existing parents | ✅ Complete | `supabase/migrations/20260103000002_fix_handle_new_user.sql` |
| 1.2 | Add onboarding columns to parents table | ✅ Complete | `supabase/migrations/20260103000003_parent_onboarding.sql` |
| 1.3 | Create onboarding layout | ✅ Complete | `app/(auth)/onboarding/_layout.tsx` |
| 1.4 | Create Welcome screen | ✅ Complete | `app/(auth)/onboarding/welcome.tsx` |
| 1.5 | Create Profile completion screen | ✅ Complete | `app/(auth)/onboarding/profile.tsx` |
| 1.6 | Create Notifications preferences screen | ✅ Complete | `app/(auth)/onboarding/notifications.tsx` |
| 1.7 | Create Completion screen | ✅ Complete | `app/(auth)/onboarding/complete.tsx` |
| 1.8 | Create useOnboarding hook | ✅ Complete | `src/hooks/useOnboarding.ts` |
| 1.9 | Update root layout for onboarding redirect | ✅ Complete | `app/_layout.tsx` |
| 1.10 | Update database types | ✅ Complete | `src/types/database.ts` |
| 1.11 | Test full onboarding flow | ⏳ Pending | - |

### Database Changes

```sql
-- 1. Fix handle_new_user trigger (20260103000001)
-- Links existing imported parents instead of creating duplicates
-- Updates user_id on parent record when they register

-- 2. Add onboarding tracking (20260103000002)
ALTER TABLE parents ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE parents ADD COLUMN preferences JSONB;
-- Added helper functions: parent_needs_onboarding(), complete_parent_onboarding()
```

### Screen Flow

```
Sign Up → [Imported Parent?]
              ├── YES → Welcome (shows children) → Profile → Notifications → Complete → Dashboard
              └── NO  → Welcome (no children) → Profile → Notifications → Complete → Dashboard
```

### Files Created

```
app/(auth)/onboarding/
├── _layout.tsx           # Stack navigator for onboarding flow
├── welcome.tsx           # Shows welcome message and linked children
├── profile.tsx           # Name, phone, contact preference
├── notifications.tsx     # Notification toggles
└── complete.tsx          # Success screen with next steps

src/hooks/
└── useOnboarding.ts      # Hook for onboarding state & completion

supabase/migrations/
├── 20260103000002_fix_handle_new_user.sql    # Fixed trigger
└── 20260103000003_parent_onboarding.sql      # New columns & functions
```

### Files Modified

```
app/_layout.tsx           # Added onboarding redirect logic
app/(auth)/_layout.tsx    # Added onboarding screen route
src/types/database.ts     # Added ParentPreferences types, updated Parent type
```

---

## Phase 1.5: Email Invitation System

### Objective
Enable tutors to send email invitations to imported parents, providing them with a secure registration link that automatically links their account to their existing parent record.

### Tasks

| Task | Description | Status | File(s) |
|------|-------------|--------|---------|
| 1.5.1 | Add invitation tracking columns to parents table | ✅ Complete | `supabase/migrations/20260103000010_parent_invitation.sql` |
| 1.5.2 | Create Edge Function for sending invitations | ✅ Complete | `supabase/functions/send-parent-invite/index.ts` |
| 1.5.3 | Create useParentInvitation hook | ✅ Complete | `src/hooks/useParentInvitation.ts` |
| 1.5.4 | Add invitation UI to parent cards | ✅ Complete | `app/(tabs)/students.tsx` |
| 1.5.5 | Update registration to handle invite tokens | ✅ Complete | `app/(auth)/register.tsx` |
| 1.5.6 | Update auth functions for invitation token | ✅ Complete | `src/lib/auth.ts`, `src/contexts/AuthContext.tsx` |

### Database Changes

```sql
-- Add invitation tracking to parents table
ALTER TABLE parents
ADD COLUMN invitation_token UUID,
ADD COLUMN invitation_sent_at TIMESTAMPTZ,
ADD COLUMN invitation_expires_at TIMESTAMPTZ,
ADD COLUMN invitation_accepted_at TIMESTAMPTZ;

-- Helper functions
CREATE FUNCTION generate_parent_invitation(parent_id UUID) RETURNS UUID;
CREATE FUNCTION validate_invitation_token(token UUID) RETURNS TABLE(...);
CREATE FUNCTION accept_parent_invitation(token UUID, auth_user_id UUID) RETURNS UUID;

-- Updated handle_new_user trigger to check for invitation_token in user metadata
```

### Flow

```
Tutor View (Students tab):
  Parent Card → [Has Account?]
    ├── YES → Shows "Account Active" badge
    └── NO  → Shows "Invite" / "Resend" button
              ↓
              Tap Invite → Confirm dialog → Edge Function sends email
              ↓
              Email arrives with registration link:
              love2learn://register?token=<UUID>&email=<parent_email>

Parent Registration Flow:
  Opens link → Register screen
    ├── Validates token (shows error if expired/invalid)
    ├── Pre-fills email (locked) and name from parent record
    └── Parent sets password → Creates account → Auto-linked to children
```

### Files Created

```
supabase/
├── migrations/
│   └── 20260103000010_parent_invitation.sql  # Invitation columns + functions
└── functions/
    └── send-parent-invite/
        └── index.ts                           # Edge Function for Resend email

src/hooks/
└── useParentInvitation.ts                     # Invitation hooks & helpers
```

### Files Modified

```
app/(tabs)/
└── students.tsx          # Added invitation status badges + Send/Resend buttons

app/(auth)/
└── register.tsx          # Token validation, pre-fill email, locked input

src/lib/
└── auth.ts               # signUp accepts optional invitationToken

src/contexts/
└── AuthContext.tsx       # Updated signUp type signature

src/types/
└── database.ts           # Added invitation fields to Parent type
```

### Email Template Features
- Personalized greeting with parent name
- List of linked children
- Clear call-to-action button
- 7-day expiration notice
- Tutor contact information
- Responsive HTML design

### Security Considerations
- Tokens expire after 7 days
- Only tutors can send invitations (Edge Function validates role)
- Tokens are invalidated after use
- Email must match the parent record
- Token validation before pre-filling form data

---

## Phase 2: Parent Calendar View

### Objective
Provide parents with a read-only view of their children's lesson schedules and tutor availability.

### Tasks

| Task | Description | Status | File(s) |
|------|-------------|--------|---------|
| 2.1 | Add tutor availability table | ✅ Complete | `supabase/migrations/20260103000004_tutor_availability.sql` |
| 2.2 | Create lesson_requests table | ✅ Complete | `supabase/migrations/20260103000005_lesson_requests.sql` |
| 2.3 | Update calendar tab for parent role | ✅ Complete | `app/(tabs)/calendar.tsx` |
| 2.4 | Update LessonDetailModal for parent view | ✅ Complete | `src/components/LessonDetailModal.tsx` |
| 2.5 | Add lesson request functionality | ⏳ Future | `src/components/LessonRequestModal.tsx` |

### Database Changes

```sql
-- Tutor availability slots
CREATE TABLE tutor_availability (
  id UUID PRIMARY KEY,
  tutor_id UUID REFERENCES parents(id),
  day_of_week INTEGER,
  start_time TIME,
  end_time TIME,
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE
);

-- Lesson requests from parents
CREATE TABLE lesson_requests (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES parents(id),
  student_id UUID REFERENCES students(id),
  subject TEXT,
  preferred_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
);
```

### Features
- Month/week view of children's lessons
- Color-coded by subject
- Lesson details on tap
- Tutor availability display
- Request new lesson functionality

---

## Phase 3: Parent Worksheets View

### Objective
Allow parents to view, print, and mark worksheets as completed.

### Tasks

| Task | Description | Status | File(s) |
|------|-------------|--------|---------|
| 3.1 | Update RLS for parent completion updates | ✅ Complete | `supabase/migrations/20260103000006_parent_worksheet_permissions.sql` |
| 3.2 | Update worksheets tab for parent role | ✅ Complete | `app/(tabs)/worksheets.tsx` |
| 3.3 | Add filtering by child/status | ✅ Complete | `app/(tabs)/worksheets.tsx` |
| 3.4 | Add "mark as completed" feature | ✅ Complete | `app/(tabs)/worksheets.tsx` |
| 3.5 | Implement print/share functionality | ✅ Complete | `app/(tabs)/worksheets.tsx` |

### Features Implemented
- List of assigned worksheets per child
- Filter by child (when multiple children)
- Filter by status (all, pending, completed)
- Print/share worksheet PDFs
- Mark as completed by parent
- Parent-only view (no Generate tab)

---

## Phase 4: Profile & Settings

### Objective
Enable parents to manage their profile, children info, and notification preferences.

### Tasks

| Task | Description | Status | File(s) |
|------|-------------|--------|---------|
| 4.1 | Update tabs layout for role-based visibility | ✅ Complete | `app/(tabs)/_layout.tsx` |
| 4.2 | Add "My Children" section to home screen | ✅ Complete | `app/(tabs)/index.tsx` |
| 4.3 | Hide Students/Payments tabs for parents | ✅ Complete | `app/(tabs)/_layout.tsx` |
| 4.4 | Update header titles for parent role | ✅ Complete | `app/(tabs)/_layout.tsx` |
| 4.5 | Add notification settings screen | ⏳ Future | `app/settings/notifications.tsx` |
| 4.6 | Add change password functionality | ⏳ Future | - |

### Features Implemented
- Role-based tab visibility (Students/Payments hidden for parents)
- "My Children" section showing all linked children with subjects
- Parent-friendly header titles ("My Schedule", "My Worksheets", etc.)
- Sign out functionality from home screen

---

## Phase 5: Enhanced Features

### Objective
Add advanced features for better parent-tutor communication and engagement.

### Tasks

| Task | Description | Status | File(s) |
|------|-------------|--------|---------|
| 5.1 | In-app messaging with tutor | ⏳ Pending | - |
| 5.2 | Progress reports view | ⏳ Pending | - |
| 5.3 | Lesson rescheduling requests | ⏳ Pending | - |
| 5.4 | Push notifications | ⏳ Pending | - |
| 5.5 | Payment processing integration | ⏳ Pending | - |

---

## File Structure

### New Files Created (Phase 1)

```
app/
├── (auth)/
│   └── onboarding/           # Phase 1 ✅
│       ├── _layout.tsx       ✅
│       ├── welcome.tsx       ✅
│       ├── profile.tsx       ✅
│       ├── notifications.tsx ✅
│       └── complete.tsx      ✅

src/
├── hooks/
│   └── useOnboarding.ts      # Phase 1 ✅

supabase/migrations/
├── 20260103000002_fix_handle_new_user.sql    # Phase 1 ✅
└── 20260103000003_parent_onboarding.sql      # Phase 1 ✅
```

### Files Created (Phases 2-4)

```
supabase/migrations/
├── 20260103000004_tutor_availability.sql     # Phase 2 - Tutor availability slots
├── 20260103000005_lesson_requests.sql        # Phase 2 - Parent lesson requests
└── 20260103000006_parent_worksheet_permissions.sql # Phase 3 - Parent worksheet RLS
```

### Files Modified (Phases 2-4)

```
app/(tabs)/
├── _layout.tsx               # Phase 4 - Role-based tab visibility
├── calendar.tsx              # Phase 2 - Parent view with "My Schedule" title
├── worksheets.tsx            # Phase 3 - Parent filters, mark complete, no Generate
└── index.tsx                 # Phase 4 - "My Children" section for parents

src/
├── components/
│   └── LessonDetailModal.tsx # Phase 2 - Read-only for parents, info bar
└── types/
    └── database.ts           # Added TutorAvailability, LessonRequest types
```

### Files to Create (Future Phases)

```
app/
├── settings/                  # Phase 5
│   ├── notifications.tsx
│   └── profile.tsx

src/
├── components/
│   └── LessonRequestModal.tsx # Phase 5 - Request new lessons
```

### Files Modified (Phase 1)

```
app/
├── _layout.tsx               # Added onboarding redirect ✅
├── (auth)/
│   └── _layout.tsx          # Added onboarding route ✅

src/
├── types/
│   └── database.ts          # Added ParentPreferences, updated Parent type ✅
```

---

## Testing Checklist

### Phase 1: Onboarding
- [ ] Imported parent can sign up and link to existing record
- [ ] Parent sees their pre-imported children on welcome screen
- [ ] Profile completion saves correctly (name, phone, contact pref)
- [ ] Notification preferences save correctly
- [ ] Onboarding completion flag is set in database
- [ ] Subsequent logins skip onboarding and go to dashboard
- [ ] New parent (not imported) sees appropriate welcome message
- [ ] Animations work on completion screen

### Phase 1.5: Email Invitation
- [ ] "Not Invited" status shows for parents without accounts
- [ ] Send Invite button visible for non-registered parents
- [ ] Invitation email sent successfully via Resend
- [ ] Email contains correct parent name and children list
- [ ] "Invited (Xd left)" status shows after sending
- [ ] Resend button works for already-invited parents
- [ ] "Invitation Expired" shows after 7 days
- [ ] Registration link opens app with token parameter
- [ ] Token validation shows error for expired tokens
- [ ] Email field is pre-filled and locked for invited users
- [ ] Name is pre-filled from parent record
- [ ] Registration links account to existing parent record
- [ ] "Account Active" status shows after registration
- [ ] Invitation accepted_at timestamp is set

### Phase 2: Calendar
- [ ] Parent sees only their children's lessons
- [ ] Calendar displays correct dates/times
- [ ] Tutor availability slots display
- [ ] Lesson request modal works
- [ ] Lesson details show on tap

### Phase 3: Worksheets
- [ ] Parent sees worksheets for all their children
- [ ] Filter by child works
- [ ] Print functionality works
- [ ] Mark as completed works
- [ ] Due date indicators display correctly

### Phase 4: Profile
- [ ] Profile edits save correctly
- [ ] Children display with subjects
- [ ] Payment history displays
- [ ] Notification settings save
- [ ] Password change works

---

## How to Test Phase 1

### Prerequisites
1. Run migrations: `npx supabase db push` or apply migrations manually
2. Have an imported parent record (with `user_id = NULL`) in the database

### Test Steps
1. Register with the email matching an imported parent
2. Verify you're redirected to onboarding welcome screen
3. Check that your children are displayed
4. Complete profile step
5. Set notification preferences
6. Verify completion screen shows
7. Go to dashboard
8. Sign out and sign back in - should skip onboarding

---

## Progress Log

### January 3, 2026
- Created implementation plan document
- **Phase 1 Implementation Complete:**
  - Created database migrations for trigger fix and onboarding columns
  - Built 4 onboarding screens (welcome, profile, notifications, complete)
  - Created useOnboarding hook for state management
  - Updated root layout for automatic onboarding redirect
  - Updated database types with ParentPreferences
  - Updated auth layout to include onboarding route

- **Phase 2 Implementation Complete:**
  - Created tutor_availability migration for availability slots
  - Created lesson_requests migration for parent lesson requests
  - Updated calendar.tsx to show "My Schedule" for parents
  - Updated LessonDetailModal to be read-only for parents (hide edit/delete/complete buttons)
  - Added informational bar for parents to contact tutor for changes

- **Phase 3 Implementation Complete:**
  - Created parent_worksheet_permissions migration for RLS
  - Updated worksheets.tsx with parent-only view (no Generate tab)
  - Added child filter for parents with multiple children
  - Added status filter (all, pending, completed)
  - Implemented mark-as-complete functionality for parents
  - Added print/share worksheet functionality

- **Phase 4 Implementation Complete:**
  - Updated tabs layout to hide Students and Payments tabs for parents
  - Updated header titles for parent-friendly naming
  - Added "My Children" section to home screen
  - Added database types for new tables (TutorAvailability, LessonRequest)

- **Phase 1.5 Email Invitation System Complete:**
  - Created invitation tracking migration with columns and helper functions
  - Created send-parent-invite Edge Function using Resend API
  - Built useParentInvitation hook for sending invites and checking status
  - Added invitation status badges and Send/Resend buttons to parent cards
  - Updated registration screen to validate tokens and pre-fill email
  - Modified auth.ts to pass invitation_token to Supabase during signup
  - Updated AuthContext type signature for new signUp parameter
  - Implemented token validation with clear error messages for expired/invalid tokens

---

## Notes

- All parent features respect existing RLS policies
- Parent role is determined by `parents.role` column
- Tutor retains full admin access to all data
- Parents have read-only access to most data except their profile and worksheet completion status
- Onboarding is skipped for tutors (they have `role = 'tutor'`)
