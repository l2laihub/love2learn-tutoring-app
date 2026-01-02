# Component Reference

This guide documents all UI components available in the Love2Learn app.

## Base UI Components

Located in `src/components/ui/`

---

### Card

A flexible container component with multiple variants.

```typescript
import { Card } from '@/components/ui';

// Basic usage
<Card>
  <Text>Card content</Text>
</Card>

// Elevated card
<Card variant="elevated">
  <Text>Elevated card with shadow</Text>
</Card>

// Outlined card
<Card variant="outlined">
  <Text>Card with border</Text>
</Card>

// Pressable card
<Card onPress={() => console.log('Pressed')}>
  <Text>Tap me</Text>
</Card>

// Accent colored card
<Card accent="piano">
  <Text>Card with coral left border</Text>
</Card>

<Card accent="math">
  <Text>Card with green left border</Text>
</Card>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'elevated' \| 'outlined' \| 'filled'` | `'elevated'` | Visual style |
| `accent` | `'piano' \| 'math'` | - | Left border accent color |
| `onPress` | `() => void` | - | Makes card pressable |
| `style` | `ViewStyle` | - | Additional styles |
| `children` | `ReactNode` | - | Card content |

---

### Button

Versatile button component with multiple variants and states.

```typescript
import { Button } from '@/components/ui';

// Primary button
<Button onPress={handlePress}>
  Submit
</Button>

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="piano">Piano Theme</Button>
<Button variant="math">Math Theme</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// With icon
<Button icon="add">Add Item</Button>
<Button icon="save" iconPosition="right">Save</Button>

// Loading state
<Button loading>Saving...</Button>

// Disabled
<Button disabled>Can't Press</Button>

// Full width
<Button fullWidth>Full Width Button</Button>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'piano' \| 'math'` | `'primary'` | Button style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `icon` | `IoniconsName` | - | Icon name |
| `iconPosition` | `'left' \| 'right'` | `'left'` | Icon placement |
| `loading` | `boolean` | `false` | Show loading spinner |
| `disabled` | `boolean` | `false` | Disable button |
| `fullWidth` | `boolean` | `false` | Expand to container |
| `onPress` | `() => void` | - | Press handler |

---

### Badge

Status indicators and labels.

```typescript
import { Badge, SubjectBadge, PaymentBadge } from '@/components/ui';

// Basic badge
<Badge>Default</Badge>

// Variants
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="info">Info</Badge>

// Subject badges (pre-configured)
<SubjectBadge subject="piano" />  // Shows "Piano" in coral
<SubjectBadge subject="math" />   // Shows "Math" in green

// Payment status badges
<PaymentBadge status="paid" />     // Green "Paid"
<PaymentBadge status="partial" />  // Yellow "Partial"
<PaymentBadge status="unpaid" />   // Red "Unpaid"
```

**Props (Badge):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'success' \| 'warning' \| 'error' \| 'info'` | `'default'` | Badge color |
| `size` | `'sm' \| 'md'` | `'md'` | Badge size |

---

### Avatar

User avatar with image or initials fallback.

```typescript
import { Avatar, AvatarGroup } from '@/components/ui';

// With initials (auto-generated)
<Avatar name="John Doe" />  // Shows "JD"

// With image
<Avatar name="John" imageUrl="https://..." />

// Sizes
<Avatar name="John" size="sm" />  // 32px
<Avatar name="John" size="md" />  // 44px
<Avatar name="John" size="lg" />  // 56px
<Avatar name="John" size="xl" />  // 80px

// Custom background
<Avatar name="John" backgroundColor="#FF6B6B" />

// Avatar group (overlapping)
<AvatarGroup
  names={["Alice", "Bob", "Charlie", "Diana"]}
  max={3}  // Shows 3 + "+1"
/>
```

**Props (Avatar):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string` | Required | Used for initials |
| `imageUrl` | `string` | - | Profile image URL |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Avatar size |
| `backgroundColor` | `string` | Auto | Background color |

---

### Input

Text input with label, validation, and icons.

```typescript
import { Input, SearchInput, PasswordInput } from '@/components/ui';

// Basic input
<Input
  label="Email"
  value={email}
  onChangeText={setEmail}
  placeholder="Enter email"
/>

// With icon
<Input
  label="Email"
  icon="mail"
  value={email}
  onChangeText={setEmail}
/>

// With error
<Input
  label="Email"
  value={email}
  error="Invalid email format"
/>

// With hint
<Input
  label="Password"
  hint="At least 8 characters"
/>

// Search input (pre-configured)
<SearchInput
  value={query}
  onChangeText={setQuery}
  onClear={() => setQuery('')}
/>

// Password input (with toggle visibility)
<PasswordInput
  label="Password"
  value={password}
  onChangeText={setPassword}
/>
```

**Props (Input):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Input label |
| `error` | `string` | - | Error message |
| `hint` | `string` | - | Help text |
| `icon` | `IoniconsName` | - | Left icon |
| `rightIcon` | `IoniconsName` | - | Right icon |
| `onRightIconPress` | `() => void` | - | Right icon handler |
| `...TextInputProps` | - | - | All React Native TextInput props |

---

### SegmentedControl

Tab-style selector for switching views.

```typescript
import { SegmentedControl, TabBar } from '@/components/ui';

// Basic segmented control
<SegmentedControl
  segments={[
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ]}
  selectedKey={filter}
  onSelect={setFilter}
/>

// Piano/Math variant
<SegmentedControl
  variant="piano-math"
  segments={[
    { key: 'piano', label: 'Piano' },
    { key: 'math', label: 'Math' },
  ]}
  selectedKey={subject}
  onSelect={setSubject}
/>

// Tab bar (for worksheet generator)
<TabBar
  tabs={[
    { key: 'piano', label: 'Piano', emoji: '🎹' },
    { key: 'math', label: 'Math', emoji: '🔢' },
  ]}
  selectedTab={activeTab}
  onSelectTab={setActiveTab}
/>
```

**Props (SegmentedControl):**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `segments` | `Array<{key, label, icon?}>` | Required | Options |
| `selectedKey` | `string` | Required | Current selection |
| `onSelect` | `(key: string) => void` | Required | Selection handler |
| `variant` | `'default' \| 'piano-math'` | `'default'` | Color scheme |

---

### EmptyState

Placeholder for empty content areas.

```typescript
import { EmptyState } from '@/components/ui';

// Custom empty state
<EmptyState
  icon="calendar-outline"
  title="No Lessons Today"
  description="Enjoy your free time!"
/>

// With action button
<EmptyState
  icon="people-outline"
  title="No Students Yet"
  description="Add your first student to get started"
  actionLabel="Add Student"
  onAction={() => router.push('/add-student')}
/>

// Pre-configured variants
<EmptyState variant="NoLessonsToday" />
<EmptyState variant="NoStudents" />
<EmptyState variant="NoPayments" />
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `string` | - | Pre-configured variant |
| `icon` | `IoniconsName` | - | Center icon |
| `title` | `string` | - | Main text |
| `description` | `string` | - | Secondary text |
| `actionLabel` | `string` | - | Button text |
| `onAction` | `() => void` | - | Button handler |

---

### Header

Screen headers with actions.

```typescript
import { Header, LargeHeader } from '@/components/ui';

// Standard header
<Header
  title="Students"
  rightAction={{
    icon: 'add',
    onPress: () => router.push('/add-student'),
  }}
/>

// With back button
<Header
  title="Student Details"
  leftAction={{
    icon: 'arrow-back',
    onPress: () => router.back(),
  }}
/>

// Large header (for home screen)
<LargeHeader
  title="Welcome back!"
  subtitle="Today's Lessons"
/>
```

---

## Feature Components

Located in `src/components/`

---

### LessonCard

Display lesson information with subject theming.

```typescript
import { LessonCard, TodaysLessons } from '@/components';

// Single lesson card
<LessonCard
  lesson={{
    id: '1',
    student: { name: 'Alice' },
    subject: 'piano',
    scheduled_at: '2024-01-15T14:00:00',
    duration_min: 30,
    status: 'scheduled',
  }}
  onPress={(lesson) => router.push(`/lesson/${lesson.id}`)}
/>

// Compact variant
<LessonCard lesson={lesson} variant="compact" />

// Today's lessons summary
<TodaysLessons
  lessons={todaysLessons}
  onLessonPress={handleLessonPress}
/>
```

---

### StudentCard

Student profile cards and list items.

```typescript
import { StudentCard, StudentListItem, StudentSelector } from '@/components';

// Full card
<StudentCard
  student={student}
  onPress={() => router.push(`/student/${student.id}`)}
/>

// List item (for FlatList)
<StudentListItem
  student={student}
  onPress={handlePress}
/>

// Selector (for forms)
<StudentSelector
  students={students}
  selectedId={selectedStudentId}
  onSelect={setSelectedStudentId}
/>
```

---

### PaymentCard

Payment tracking with visual progress.

```typescript
import { PaymentCard, PaymentMonthHeader } from '@/components';

// Payment card
<PaymentCard
  payment={{
    id: '1',
    parent: { name: 'Smith Family', students: [{name: 'Alice'}] },
    month: '2024-01-01',
    amount_due: 200,
    amount_paid: 100,
    status: 'partial',
  }}
  onPress={handlePaymentPress}
/>

// Month header (for grouped lists)
<PaymentMonthHeader
  month="2024-01"
  totalDue={1000}
  totalPaid={750}
/>
```

---

### Calendar

Week view calendar with lesson indicators.

```typescript
import { Calendar } from '@/components';

<Calendar
  lessons={lessons}
  selectedDate={selectedDate}
  onDateSelect={setSelectedDate}
  onTimeSlotPress={(date, hour) => {
    // Create new lesson at this time
    router.push(`/add-lesson?date=${date}&hour=${hour}`);
  }}
  onLessonPress={(lesson) => {
    router.push(`/lesson/${lesson.id}`);
  }}
/>
```

---

### WorksheetGenerator

Complete worksheet configuration UI.

```typescript
import { WorksheetGenerator } from '@/components';

<WorksheetGenerator
  onGenerate={(config) => {
    // config.type: 'piano' | 'math'
    // config.settings: PianoConfig | MathConfig
    console.log('Generate worksheet:', config);
  }}
  isGenerating={loading}
/>
```

**Piano Configuration:**
- Type: Note Naming / Note Drawing
- Clef: Treble / Bass / Grand Staff
- Difficulty: Beginner to Advanced
- Problem Count: 10, 15, or 20
- Accidentals: None / Sharps / Flats / Mixed
- Theme: Space / Animals / Ocean

**Math Configuration:**
- Grade: Kindergarten to 6th
- Topic: Various per grade level
- Problem Count: 10, 15, 20, or 25
- Word Problems: Toggle
- Visual Aids: Toggle

---

## Usage Examples

### Complete Screen Example

```typescript
import { View, FlatList } from 'react-native';
import { Header, Card, Button, EmptyState } from '@/components/ui';
import { StudentCard } from '@/components';
import { useStudents } from '@/hooks/useStudents';

export default function StudentsScreen() {
  const { students, loading, error, refetch } = useStudents();

  if (loading) {
    return <ActivityIndicator />;
  }

  if (error) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Error loading students"
        description={error.message}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  if (students.length === 0) {
    return <EmptyState variant="NoStudents" />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Students"
        rightAction={{
          icon: 'add',
          onPress: () => router.push('/add-student'),
        }}
      />
      <FlatList
        data={students}
        renderItem={({ item }) => (
          <StudentCard
            student={item}
            onPress={() => router.push(`/student/${item.id}`)}
          />
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}
```

### Form Example

```typescript
import { View } from 'react-native';
import { Input, Button, SegmentedControl } from '@/components/ui';

export default function AddLessonForm() {
  const [subject, setSubject] = useState<'piano' | 'math'>('piano');
  const [notes, setNotes] = useState('');

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <SegmentedControl
        variant="piano-math"
        segments={[
          { key: 'piano', label: 'Piano' },
          { key: 'math', label: 'Math' },
        ]}
        selectedKey={subject}
        onSelect={setSubject}
      />

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />

      <Button
        variant={subject}
        fullWidth
        onPress={handleSubmit}
      >
        Create Lesson
      </Button>
    </View>
  );
}
```
