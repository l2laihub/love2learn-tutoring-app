# Love2Learn Tutoring App - Product Brief

## Executive Summary

**Love2Learn** is a cross-platform tutoring management application designed for solo tutors to manage lessons, students, parents, payments, and educational materials. Built with React Native/Expo for iOS, Android, and Web, with Supabase as the backend.

**Current Status**: MVP features complete; Phase 1 monetization in progress
**Target Users**: Solo tutors, parents seeking tutoring services
**Platforms**: iOS, Android, Web

---

## 1. Product Overview

### 1.1 Problem Statement

Solo tutors struggle to manage their tutoring business efficiently. They need to:
- Schedule and track lessons across multiple students
- Manage payments and invoicing
- Communicate with parents
- Create and assign educational materials
- Handle rescheduling and availability

### 1.2 Solution

Love2Learn provides an all-in-one platform where tutors can:
- Schedule lessons with calendar management
- Track payments with invoice and prepaid billing options
- Communicate with parents via messaging
- Generate worksheets and track assignments
- Manage availability and handle lesson requests

### 1.3 User Roles

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Tutor** | Business owner | Manage students, schedule lessons, track payments, create assignments |
| **Parent** | Child's guardian | View schedule, pay invoices, communicate with tutor, track assignments |

---

## 2. Core Features

### 2.1 Calendar & Lesson Scheduling

- **Weekly calendar view** with navigation
- **Color-coded lessons by subject**: Piano (#3D9CA8), Math (#7CB342), Reading (#9C27B0), Speech (#FF9800), English (#2196F3)
- **Multi-student lessons** - Schedule combined sessions with multiple students
- **Per-student subject selection** - Different subjects per student in combined sessions
- **Lesson duration**: 30, 45, 60, 90 min or custom (15-240 min)
- **Recurrence patterns**: Weekly, bi-weekly, monthly
- **Lesson status**: Scheduled, Completed, Cancelled, Uncompleted
- **Tutor availability** - Define weekly availability windows
- **Tutor breaks** - Block out vacations/unavailable times
- **Lesson requests** - Parents can request reschedules or drop-in sessions

### 2.2 Student & Parent Management

- Create, view, edit, delete students and parents
- Multiple subjects per student
- Per-student hourly rates with subject-specific overrides
- Student birthday tracking and avatars
- Link students to parent families
- Search functionality
- Import from Google Sheets/CSV
- Parent invitation system with unique tokens

### 2.3 Payment Tracking & Invoicing

**Two Billing Modes:**

1. **Invoice-based**: Generate invoices for completed lessons
2. **Prepaid sessions**: Pre-purchase session packages

**Features:**
- Auto-generate invoices from completed lessons
- Calculate amounts based on student/subject rates
- Track payment status (Paid, Partial, Unpaid)
- Send payment reminders via email
- Track sessions used/remaining for prepaid
- Parent visibility into payment status

### 2.4 Worksheets & Assignments

**Piano Worksheets:**
- Note naming and note drawing exercises
- Treble, bass, and grand staff clefs
- Difficulty levels: Beginner to Advanced
- Accidentals options
- Answer key generation
- SVG-based music notation

**Math Worksheets:**
- Grade level selection (K-6)
- Topics: Addition, Subtraction, Multiplication, Division, Fractions
- Problem count customization
- Word problems and visual aids options

**Assignment System:**
- Assign worksheets to students
- Track status and due dates
- PDF export capability
- Parent visibility

### 2.5 Messaging System

- Thread-based tutor-to-parent communication
- Individual and group messaging
- Real-time updates via Supabase subscriptions
- Archive and delete threads

### 2.6 Notifications

- Lesson scheduling confirmations
- Payment reminders
- Assignment due dates
- Reschedule/drop-in request notifications
- Configurable preferences

---

## 3. Technical Architecture

### 3.1 Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React Native 0.81 + Expo 54 |
| **Routing** | Expo Router 6 (file-based) |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) |
| **Language** | TypeScript (strict mode) |
| **State** | Supabase real-time + React hooks |

### 3.2 Directory Structure

```
app/                    # Expo Router screens (file-based routing)
├── (tabs)/            # Tab navigation (main app screens)
│   ├── index.tsx      # Home - role-aware dashboard
│   ├── calendar.tsx   # Lesson scheduling
│   ├── students.tsx   # Student/parent management
│   ├── payments.tsx   # Payment tracking
│   └── worksheets.tsx # Assignment creation
├── (auth)/            # Auth screens (login, register, onboarding)
├── admin/             # Admin panel
├── student/[id].tsx   # Dynamic routes
└── _layout.tsx        # Root layout with AuthProvider

src/
├── components/        # Reusable UI components
│   └── ui/           # Base components (Card, Button, Badge, etc.)
├── hooks/            # Data hooks wrapping Supabase queries
├── lib/              # Supabase client and auth
├── contexts/         # React contexts (AuthContext)
├── theme/            # Design system
└── types/            # TypeScript definitions

supabase/
├── migrations/       # SQL migrations
└── config.toml       # Supabase CLI config
```

### 3.3 Data Hooks Pattern

All data fetching uses custom hooks:

```typescript
const { data, loading, error, refetch, create, update, delete } = useStudents();
```

**Key Hooks:**
- `useStudents()` - Student CRUD
- `useParents()` - Parent management
- `useLessons()` - Lesson scheduling and management
- `usePayments()` - Payment tracking
- `useAssignments()` - Assignment tracking
- `useTutorAvailability()` - Availability management
- `useMessages()` - Thread-based messaging
- `useNotifications()` - Notification management

### 3.4 Database Schema (Key Tables)

```sql
parents (users)
├── id, user_id, email, name, role
├── business_name, timezone
├── subscription_status, stripe_customer_id

students
├── id, parent_id, tutor_id, name, age, grade
├── subjects (text[]), birthday
├── hourly_rate, subject_rates (JSONB)

scheduled_lessons
├── id, student_id, tutor_id, scheduled_at
├── status, duration_min, subject, notes

lesson_sessions (combined lessons)
├── id, tutor_id, scheduled_at
├── [has many: scheduled_lessons]

payments
├── id, parent_id, tutor_id, month, status
├── amount_due, amount_paid, payment_date

payment_lessons (junction)
├── payment_id, lesson_id, amount_calculated

assignments
├── id, student_id, tutor_id, worksheet_type
├── config, status, due_date

tutor_settings
├── tutor_id, subjects, rates, business_name

tutor_availability
├── tutor_id, day_of_week, start_time, end_time

message_threads
├── id, tutor_id, parent_id, subject

notifications
├── id, user_id, tutor_id, type, read
```

### 3.5 Authentication

- **Hybrid storage**: AsyncStorage for session + SecureStore for tokens
- iOS SecureStore limited to 2048 bytes
- Role-based navigation (tutor vs parent)
- Row-Level Security (RLS) at database level
- `is_tutor()` function determines permissions

### 3.6 Path Aliases

```typescript
import { Button } from '@components/ui/Button';
import { useStudents } from '@hooks';
import { theme } from '@theme';
import { supabase } from '@lib/supabase';
```

---

## 4. Business Model

### 4.1 Pricing (Phase 1 - In Progress)

| Plan | Price | Features |
|------|-------|----------|
| Solo | $29/month | Up to 20 students, basic support |
| Pro | $49/month | Unlimited students, priority support |

- 14-day free trial
- No credit card required to start
- 3-day grace period for failed payments

### 4.2 Monetization Status

**In Progress:**
- Multi-tutor authentication and RLS policies
- Stripe subscription integration
- Configurable tutor branding

**Planned:**
- App Store submission (iOS + Android)
- Landing page and marketing site

---

## 5. Platform Considerations

| Platform | Notes |
|----------|-------|
| **iOS** | SecureStore 2048-byte limit; session in AsyncStorage |
| **Android** | 20s timeout for initial auth |
| **Web** | React Native Web; full feature parity |

---

## 6. Environment Variables

**Required:**
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

**Optional:**
```
EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-xxx  # AI worksheets
RESEND_API_KEY=re_xxx                   # Email notifications
STRIPE_SECRET_KEY=sk_xxx                # Payments (future)
```

---

## 7. Common Commands

```bash
# Development
npm start              # Expo dev server
npm run web            # Web browser
npm run ios            # iOS simulator
npm run android        # Android emulator

# Code Quality
npm run typecheck      # TypeScript checking
npm run lint           # ESLint

# Database
npx supabase db push              # Push migrations
npx supabase db reset             # Reset local DB
npx supabase migration new <name> # New migration
```

---

## 8. Feature Status

### Complete
- User authentication & authorization
- Role-based access control
- Calendar & lesson scheduling (including combined sessions)
- Student & parent management
- Payment tracking (invoice + prepaid)
- Payment reminders
- Piano worksheet generation
- Assignment tracking
- Messaging system
- Availability management
- Lesson requests (reschedule/drop-in)
- Admin panel

### In Progress
- Multi-tutor RLS policies
- Stripe subscription integration
- Configurable branding
- Math worksheet API integration

### Planned
- Push notifications
- App Store submission
- Advanced analytics
- Landing page

---

## 9. Key Implementation Details

### Lesson Color Coding
```typescript
const subjectColors = {
  Piano: '#3D9CA8',
  Math: '#7CB342',
  Reading: '#9C27B0',
  Speech: '#FF9800',
  English: '#2196F3',
};
```

### Combined Lessons
- Multiple students can be scheduled for the same time slot
- `lesson_sessions` table groups lessons together
- Calendar displays as single card with multiple avatars

### Payment Flow
1. Tutor marks lessons complete
2. Tutor generates invoice for family/month
3. System calculates amount from student rates
4. Links payments to lessons via `payment_lessons`
5. Parent receives notification
6. Parent marks as paid

### RLS Strategy
- All tables filtered by `tutor_id`
- Parents see only their own data
- `get_current_user_parent()` RPC prevents circular RLS issues

---

## 10. Documentation

Additional docs in `/docs/`:
- `QUICKSTART.md` - 5-minute setup
- `ARCHITECTURE.md` - Design patterns
- `COMPONENTS.md` - UI component reference
- `IMPLEMENTATION_STATUS.md` - MVP tracking
- `roadmap/` - Monetization roadmap documents

---

*Last updated: February 2026*
