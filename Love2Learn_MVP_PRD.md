# Love2Learn

## 🎹 Piano & Math Tutoring App ➗

**MVP Product Requirements Document**

For Love To Learn Academy | [lovetolearn.site](https://lovetolearn.site)

Version 1.0 • January 2026 • Target Build: 3-4 Weeks

---

## 1. Overview

### 1.1 Product Vision

Love2Learn is the companion mobile app for Love To Learn Academy. It helps Trang manage her piano and math tutoring business while providing parents with a seamless way to stay connected, receive reminders, and access AI-generated practice worksheets for their children.

### 1.2 MVP Philosophy

> *Build the differentiators, simplify the commodities.*

The AI worksheet generators are the unique value—they save time and delight families. Scheduling and payment tracking are kept intentionally simple: manual processes that work today, automated later based on real pain points.

### 1.3 Target Users

| User | Description |
|------|-------------|
| **Tutor (Trang)** | Manages 5-15 students, teaches piano and K-6 math, currently uses texts and Venmo |
| **Parents** | Busy families who want reminders, progress visibility, and practice materials |

### 1.4 Success Criteria

- All current students enrolled in the app within first week
- Parents receive lesson reminders automatically (no more manual texts)
- Worksheet generation saves 30+ minutes per week
- Positive feedback from parents on ease of use

---

## 2. MVP Feature Scope

| Feature | Description | Priority |
|---------|-------------|----------|
| Scheduling Calendar | Simple calendar with lesson time slots | P0 - Must Have |
| Parent Contact List | Contact info + push notification reminders | P0 - Must Have |
| Payment Tracking | Manual paid/unpaid status logging | P0 - Must Have |
| AI Piano Worksheets | Note naming and note drawing exercises | P0 - Must Have |
| AI Math Worksheets | Grade-appropriate math problems (K-6) | P0 - Must Have |
| Practice Assignments | Assign worksheets, track completion | P1 - Important |

### 2.1 Explicitly Out of Scope (MVP)

- Stripe/payment processing (continue using Venmo/Zelle)
- SMS reminders (push notifications only—free)
- Parent self-service booking
- Google/Apple Calendar sync
- In-app worksheet grading or scoring
- Video lessons or recordings

---

## 3. Feature Specifications

### 3.1 Scheduling Calendar

A tutor-facing calendar to visualize and manage all lesson slots.

#### Requirements

- Week view showing 7 days with time slots
- Create lesson: select student, date, time, duration (30/45/60 min), subject
- Edit or cancel existing lessons
- Color-coded by subject (Piano = coral, Math = green)
- Quick view: today's lessons on home screen

#### User Flow

*Trang opens Calendar → Taps empty slot → Selects student → Confirms → Lesson created → Parent notified*

#### Data Model: Lesson

```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  subject TEXT CHECK (subject IN ('piano', 'math')) NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_min INT CHECK (duration_min IN (30, 45, 60)) NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 3.2 Parent Contact List & Reminders

Central contact management with automated push notification reminders.

#### Requirements

- Add parent: name, email, phone, linked students
- Quick-call and quick-text buttons from contact card
- Automated push notification 24 hours before lesson
- Automated push notification 1 hour before lesson
- Trang receives daily schedule summary each morning

#### Reminder Messages

| Timing | Message |
|--------|---------|
| 24 hours before | "🎵 Reminder: [Student]'s [Subject] lesson is tomorrow at [Time]!" |
| 1 hour before | "⏰ [Student]'s [Subject] lesson starts in 1 hour!" |
| Tutor morning | "☀️ Today's lessons: [Student] at [Time], [Student] at [Time]..." |

#### Data Model: Parent

```sql
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  push_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Data Model: Student

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) NOT NULL,
  name TEXT NOT NULL,
  grade INT CHECK (grade >= 0 AND grade <= 6), -- K=0, 1-6
  subjects TEXT[] DEFAULT '{}', -- ['piano'], ['math'], or both
  piano_level TEXT CHECK (piano_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 3.3 Payment Tracking

Simple manual ledger for tracking payment status. No payment processing—Trang continues using Venmo/Zelle externally.

#### Requirements

- Monthly view showing each family's payment status
- Status options: Unpaid, Partial, Paid
- Record payment amount and date when received
- Optional notes field (e.g., "Paid via Venmo 1/5")
- Visual indicator for overdue payments (>7 days into month)

#### Data Model: Payment

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) NOT NULL,
  month DATE NOT NULL, -- First of month (2026-01-01)
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status TEXT CHECK (status IN ('unpaid', 'partial', 'paid')) DEFAULT 'unpaid',
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_id, month)
);
```

---

## 4. AI Worksheet Generators

The core differentiating features that save Trang time and delight families with professional practice materials.

### 4.1 AI Piano Note Worksheets

Generate printable worksheets for music note reading practice. Two types help students learn to both recognize and write notes.

#### Worksheet Types

| Type | How It Works | Student Task |
|------|--------------|--------------|
| 🎵 **Note Naming** | Staff displays notes at various positions | Write the letter name (A-G) below each note |
| ✏️ **Note Drawing** | Letter names shown with blank staff | Draw the note in correct staff position |

#### Configuration Options

| Option | Values |
|--------|--------|
| Clef | Treble only, Bass only, or Both (Grand Staff) |
| Difficulty | Beginner (lines only) → Intermediate (lines + spaces) → Advanced (ledger lines) |
| Number of Problems | 10, 15, or 20 |
| Accidentals | None / Sharps / Flats / Mixed |
| Fun Theme | Space 🚀, Animals 🐱, Ocean 🐠 — adds themed graphics for young learners |
| Answer Key | Always generates separate answer sheet |

#### Note Range by Difficulty

| Level | Treble Clef Range | Bass Clef Range |
|-------|-------------------|-----------------|
| Beginner | E4, G4, B4, D5, F5 (lines only - "Every Good Boy Does Fine") | — |
| Elementary | C4 to G5 (middle C to G above staff) | — |
| Intermediate | C4 to C6 | C2 to C4 |
| Advanced | A3 to E6 (includes ledger lines) | E1 to E4 |

#### Technical Approach

- **Note Naming:** Use pre-rendered note images (PNG) positioned on staff template. Avoids VexFlow complexity.
- **Note Drawing:** Render empty staff lines with letter prompts underneath. No music library needed.
- **AI Role:** GPT-4.1 mini selects note positions ensuring variety and appropriate difficulty progression
- **PDF Generation:** React-PDF or Puppeteer (same pattern as SheetMagic)

#### Pre-rendered Asset Strategy

Generate ~50 note position images covering the common range (C3 to C6). Each image shows a single note on a staff snippet. The worksheet generator randomly selects and arranges these into a printable grid.

*This approach renders instantly and avoids music notation library complexity for MVP.*

#### Piano Worksheet Config Schema

```typescript
interface PianoWorksheetConfig {
  type: 'note_naming' | 'note_drawing';
  clef: 'treble' | 'bass' | 'grand';
  difficulty: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  problemCount: 10 | 15 | 20;
  accidentals: 'none' | 'sharps' | 'flats' | 'mixed';
  theme?: 'space' | 'animals' | 'ocean';
}
```

---

### 4.2 AI Math Worksheets

Generate grade-appropriate math practice sheets aligned with what students learn in school. Leverages SheetMagic architecture.

#### Topics by Grade Level

| Grade | Topics | Example Problems |
|-------|--------|------------------|
| K | Counting, number recognition, simple addition | 2 + 1 = ?, Count 5 apples |
| 1st | Addition/subtraction to 20, place value | 8 + 7 = ?, 15 - 9 = ? |
| 2nd | Two-digit add/subtract, intro multiplication | 34 + 28 = ?, 3 × 4 = ? |
| 3rd | Multiplication/division facts, intro fractions | 7 × 8 = ?, 1/2 of 10 |
| 4th | Multi-digit multiplication, fraction operations | 234 × 6 = ?, 2/3 + 1/4 |
| 5th | Decimals, percentages, order of operations | 3.5 × 2.4 = ?, 25% of 80 |
| 6th | Pre-algebra, ratios, negative numbers | Solve: 2x + 5 = 13 |

#### Configuration Options

| Option | Values |
|--------|--------|
| Grade Level | K, 1, 2, 3, 4, 5, or 6 |
| Topic | Specific topic or "Mixed Review" |
| Number of Problems | 10, 15, 20, or 25 |
| Word Problems | Include story-based problems: Yes / No |
| Visual Aids | Include pictures for K-2: Yes / No |
| Answer Key | Always generates separate answer sheet |

#### Technical Approach

- **AI Model:** GPT-4.1 mini — excellent math reasoning at low cost ($0.15/1M input tokens)
- **Prompt Strategy:** Request JSON array of problems with answers. AI validates all answers before returning.
- **PDF Generation:** Same pipeline as SheetMagic — proven and reliable

#### Math Worksheet Config Schema

```typescript
interface MathWorksheetConfig {
  grade: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Kindergarten
  topic: string; // e.g., 'addition', 'multiplication', 'mixed'
  problemCount: 10 | 15 | 20 | 25;
  includeWordProblems: boolean;
  includeVisualAids: boolean; // For K-2
}
```

#### Sample AI Prompt for Math Worksheet

```
Generate a math worksheet for a 3rd grade student.

Requirements:
- Topic: Multiplication facts
- Number of problems: 15
- Include 3 word problems
- Return as JSON array

Format:
{
  "problems": [
    { "question": "7 × 8 = ___", "answer": "56", "type": "equation" },
    { "question": "Sarah has 4 bags with 6 apples each. How many apples total?", "answer": "24", "type": "word_problem" }
  ]
}

Ensure variety in numbers used. Double-check all answers are correct.
```

---

### 4.3 Practice Assignment Tracking

Simple workflow for assigning worksheets to students and tracking completion.

#### Assignment Flow

1. Trang generates worksheet (piano or math)
2. Trang assigns to student with optional due date
3. Parent receives notification, sees assignment in app
4. Parent downloads PDF, student completes on paper
5. Parent marks assignment "Done" in app
6. Trang sees completion status before next lesson

#### Data Model: Assignment

```sql
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  worksheet_type TEXT CHECK (worksheet_type IN ('piano_naming', 'piano_drawing', 'math')) NOT NULL,
  config JSONB NOT NULL, -- Worksheet generation settings
  pdf_url TEXT, -- Supabase storage URL
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date DATE,
  status TEXT CHECK (status IN ('assigned', 'completed')) DEFAULT 'assigned',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 5. Technical Architecture

### 5.1 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Mobile App | React Native + Expo | Cross-platform, fast iteration, familiar stack |
| Backend | Supabase | PostgreSQL, Auth, Storage, Edge Functions |
| Push Notifications | Firebase Cloud Messaging | Free tier, reliable, cross-platform |
| AI | OpenAI GPT-4.1 mini | Best math reasoning at lowest cost |
| PDF Generation | React-PDF / Puppeteer | Same approach as SheetMagic |
| File Storage | Supabase Storage | Worksheet PDFs, included in Supabase |

### 5.2 Project Structure

```
love2learn/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Home / Today's lessons
│   │   ├── calendar.tsx   # Scheduling calendar
│   │   ├── students.tsx   # Student list
│   │   ├── worksheets.tsx # Worksheet generator
│   │   └── payments.tsx   # Payment tracking
│   ├── student/[id].tsx   # Student detail
│   ├── parent/[id].tsx    # Parent detail
│   └── _layout.tsx        # Root layout
├── components/
│   ├── Calendar/
│   ├── StudentCard/
│   ├── WorksheetGenerator/
│   └── PaymentStatus/
├── lib/
│   ├── supabase.ts        # Supabase client
│   ├── notifications.ts   # Push notification helpers
│   └── ai.ts              # OpenAI API helpers
├── hooks/
│   ├── useStudents.ts
│   ├── useLessons.ts
│   └── useAssignments.ts
└── types/
    └── database.ts        # Generated Supabase types
```

### 5.3 Monthly Cost Estimate

| Service | Cost | Notes |
|---------|------|-------|
| Supabase | $0 | Free tier (500MB DB, 1GB storage) |
| Firebase | $0 | Free tier covers notifications |
| OpenAI API | $5-15 | ~50-100 worksheets/month |
| App Store Fees | ~$10/mo | $99 Apple + $25 Google annually |
| **Total** | **$15-25/mo** | Very lean MVP |

---

## 6. Development Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| Week 1 | Foundation | Expo setup, Supabase schema, Auth, Student/Parent CRUD screens |
| Week 2 | Core Features | Calendar UI, Lesson scheduling, Push notifications, Payment tracking |
| Week 3 | AI Worksheets | Math worksheet generator, Piano worksheet generator, PDF export |
| Week 4 | Polish | Practice assignments, Parent app view, Testing, TestFlight release |

### 6.1 Milestone Checkpoints

- **End of Week 1:** Can add students and parents, basic auth works
- **End of Week 2:** Can schedule lessons, reminders fire, payment tracking functional
- **End of Week 3:** Can generate and download both worksheet types
- **End of Week 4:** Full flow testable, ready for beta with real families

### 6.2 Week 1 Tasks (Foundation)

```
- [ ] Initialize Expo project with TypeScript
- [ ] Set up Supabase project
- [ ] Create database schema (parents, students, lessons, payments, assignments)
- [ ] Configure Supabase Auth (email/password)
- [ ] Build Parent list screen (CRUD)
- [ ] Build Student list screen (CRUD)
- [ ] Link students to parents
- [ ] Basic navigation structure
```

### 6.3 Week 2 Tasks (Core Features)

```
- [ ] Build calendar week view component
- [ ] Implement lesson creation flow
- [ ] Lesson edit/cancel functionality
- [ ] Set up Firebase Cloud Messaging
- [ ] Implement 24-hour reminder (Supabase Edge Function + cron)
- [ ] Implement 1-hour reminder
- [ ] Daily schedule summary for tutor
- [ ] Payment tracking screen
- [ ] Mark payment as paid/partial/unpaid
```

### 6.4 Week 3 Tasks (AI Worksheets)

```
- [ ] Create piano note image assets (pre-rendered PNGs)
- [ ] Build piano worksheet generator UI
- [ ] Implement note naming worksheet logic
- [ ] Implement note drawing worksheet logic
- [ ] Build math worksheet generator UI
- [ ] OpenAI integration for math problems
- [ ] PDF generation pipeline
- [ ] Save worksheets to Supabase Storage
- [ ] Worksheet preview and download
```

### 6.5 Week 4 Tasks (Polish)

```
- [ ] Assignment creation flow
- [ ] Assignment list for students
- [ ] Parent view: see child's assignments
- [ ] Mark assignment complete
- [ ] Home screen: today's lessons summary
- [ ] Error handling and loading states
- [ ] Test with real data
- [ ] TestFlight build for iOS
- [ ] Internal testing with Trang
```

---

## 7. Post-MVP Enhancements

Features to add based on real usage and feedback:

| Feature | Trigger to Build | Effort |
|---------|------------------|--------|
| Stripe Payments | Payment chasing becomes painful (>15 families) | Medium |
| SMS Reminders | Parents miss push notifications | Low |
| Calendar Sync | Trang or parents request it | Medium |
| Worksheet Scoring | Trang wants to track progress over time | Medium |
| Parent Self-Booking | Scheduling back-and-forth is too much | High |
| AI Progress Reports | Parents want more visibility into learning | Medium |

---

## 8. Success Metrics

- **Week 1 of Use:** App installed, all current students entered
- **Week 2 of Use:** Trang uses calendar daily, parents receiving reminders
- **Month 1:** 10+ worksheets generated, positive parent feedback
- **Month 3:** Zero missed lessons, parents request more features

---

## 9. Database Schema (Complete)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Parents table
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  push_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  grade INT CHECK (grade >= 0 AND grade <= 6),
  subjects TEXT[] DEFAULT '{}',
  piano_level TEXT CHECK (piano_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lessons table
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  subject TEXT CHECK (subject IN ('piano', 'math')) NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_min INT CHECK (duration_min IN (30, 45, 60)) NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
  month DATE NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status TEXT CHECK (status IN ('unpaid', 'partial', 'paid')) DEFAULT 'unpaid',
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parent_id, month)
);

-- Assignments table
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  worksheet_type TEXT CHECK (worksheet_type IN ('piano_naming', 'piano_drawing', 'math')) NOT NULL,
  config JSONB NOT NULL,
  pdf_url TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date DATE,
  status TEXT CHECK (status IN ('assigned', 'completed')) DEFAULT 'assigned',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_students_parent ON students(parent_id);
CREATE INDEX idx_lessons_student ON lessons(student_id);
CREATE INDEX idx_lessons_scheduled ON lessons(scheduled_at);
CREATE INDEX idx_lessons_status ON lessons(status);
CREATE INDEX idx_payments_parent_month ON payments(parent_id, month);
CREATE INDEX idx_assignments_student ON assignments(student_id);
CREATE INDEX idx_assignments_status ON assignments(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER parents_updated_at BEFORE UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 10. API Endpoints (Supabase Edge Functions)

### Push Notification Triggers

```typescript
// supabase/functions/send-reminder/index.ts
// Triggered by cron job every hour

// Check for lessons starting in 24 hours
// Check for lessons starting in 1 hour
// Send push notifications via Firebase
```

### Worksheet Generation

```typescript
// supabase/functions/generate-worksheet/index.ts
// POST { type, config }

// For math: Call OpenAI API, generate problems
// For piano: Select note positions based on config
// Generate PDF
// Upload to Supabase Storage
// Return PDF URL
```

---

*Built with ❤️ for Love To Learn Academy*

[lovetolearn.site](https://lovetolearn.site)
