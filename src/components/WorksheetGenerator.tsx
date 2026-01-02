import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { TabBar } from './ui/SegmentedControl';
import { colors, spacing, typography, borderRadius } from '../theme';

// Types
type PianoWorksheetType = 'note_naming' | 'note_drawing';
type ClefType = 'treble' | 'bass' | 'grand';
type DifficultyLevel = 'beginner' | 'elementary' | 'intermediate' | 'advanced';
type AccidentalType = 'none' | 'sharps' | 'flats' | 'mixed';
type ThemeType = 'space' | 'animals' | 'ocean' | 'none';

interface PianoConfig {
  type: PianoWorksheetType;
  clef: ClefType;
  difficulty: DifficultyLevel;
  problemCount: 10 | 15 | 20;
  accidentals: AccidentalType;
  theme: ThemeType;
}

interface MathConfig {
  grade: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  topic: string;
  problemCount: 10 | 15 | 20 | 25;
  includeWordProblems: boolean;
  includeVisualAids: boolean;
}

// Option selector component
interface OptionSelectorProps<T> {
  label: string;
  options: Array<{ value: T; label: string; emoji?: string }>;
  selected: T;
  onSelect: (value: T) => void;
  columns?: number;
}

function OptionSelector<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  columns = 2,
}: OptionSelectorProps<T>) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={[styles.optionGrid, { flexWrap: 'wrap' }]}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onSelect(option.value)}
              style={[
                styles.optionButton,
                { width: `${100 / columns - 2}%` },
                isSelected && styles.optionButtonSelected,
              ]}
            >
              {option.emoji && <Text style={styles.optionEmoji}>{option.emoji}</Text>}
              <Text
                style={[styles.optionText, isSelected && styles.optionTextSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Toggle switch component
interface ToggleSwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

function ToggleSwitch({ label, description, value, onChange }: ToggleSwitchProps) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </View>
    </Pressable>
  );
}

// Piano worksheet form
interface PianoWorksheetFormProps {
  config: PianoConfig;
  onChange: (config: PianoConfig) => void;
}

function PianoWorksheetForm({ config, onChange }: PianoWorksheetFormProps) {
  const updateConfig = <K extends keyof PianoConfig>(key: K, value: PianoConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
      <OptionSelector
        label="Worksheet Type"
        options={[
          { value: 'note_naming' as const, label: 'Note Naming', emoji: '🎵' },
          { value: 'note_drawing' as const, label: 'Note Drawing', emoji: '✏️' },
        ]}
        selected={config.type}
        onSelect={(v) => updateConfig('type', v)}
      />

      <OptionSelector
        label="Clef"
        options={[
          { value: 'treble' as const, label: 'Treble', emoji: '𝄞' },
          { value: 'bass' as const, label: 'Bass', emoji: '𝄢' },
          { value: 'grand' as const, label: 'Grand Staff', emoji: '🎹' },
        ]}
        selected={config.clef}
        onSelect={(v) => updateConfig('clef', v)}
        columns={3}
      />

      <OptionSelector
        label="Difficulty"
        options={[
          { value: 'beginner' as const, label: 'Beginner' },
          { value: 'elementary' as const, label: 'Elementary' },
          { value: 'intermediate' as const, label: 'Intermediate' },
          { value: 'advanced' as const, label: 'Advanced' },
        ]}
        selected={config.difficulty}
        onSelect={(v) => updateConfig('difficulty', v)}
      />

      <OptionSelector
        label="Number of Problems"
        options={[
          { value: 10 as const, label: '10' },
          { value: 15 as const, label: '15' },
          { value: 20 as const, label: '20' },
        ]}
        selected={config.problemCount}
        onSelect={(v) => updateConfig('problemCount', v)}
        columns={3}
      />

      <OptionSelector
        label="Accidentals"
        options={[
          { value: 'none' as const, label: 'None' },
          { value: 'sharps' as const, label: 'Sharps ♯' },
          { value: 'flats' as const, label: 'Flats ♭' },
          { value: 'mixed' as const, label: 'Mixed' },
        ]}
        selected={config.accidentals}
        onSelect={(v) => updateConfig('accidentals', v)}
      />

      <OptionSelector
        label="Fun Theme (Optional)"
        options={[
          { value: 'none' as const, label: 'None' },
          { value: 'space' as const, label: 'Space', emoji: '🚀' },
          { value: 'animals' as const, label: 'Animals', emoji: '🐱' },
          { value: 'ocean' as const, label: 'Ocean', emoji: '🐠' },
        ]}
        selected={config.theme}
        onSelect={(v) => updateConfig('theme', v)}
      />
    </ScrollView>
  );
}

// Math worksheet form
interface MathWorksheetFormProps {
  config: MathConfig;
  onChange: (config: MathConfig) => void;
}

const MATH_TOPICS: Record<number, string[]> = {
  0: ['Counting', 'Number Recognition', 'Simple Addition'],
  1: ['Addition to 20', 'Subtraction to 20', 'Place Value'],
  2: ['Two-Digit Add/Subtract', 'Intro Multiplication', 'Time'],
  3: ['Multiplication Facts', 'Division Facts', 'Intro Fractions'],
  4: ['Multi-Digit Multiplication', 'Long Division', 'Fractions'],
  5: ['Decimals', 'Percentages', 'Order of Operations'],
  6: ['Pre-Algebra', 'Ratios', 'Negative Numbers'],
};

function MathWorksheetForm({ config, onChange }: MathWorksheetFormProps) {
  const updateConfig = <K extends keyof MathConfig>(key: K, value: MathConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const topics = MATH_TOPICS[config.grade] || [];

  return (
    <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
      <OptionSelector
        label="Grade Level"
        options={[
          { value: 0 as const, label: 'K' },
          { value: 1 as const, label: '1st' },
          { value: 2 as const, label: '2nd' },
          { value: 3 as const, label: '3rd' },
          { value: 4 as const, label: '4th' },
          { value: 5 as const, label: '5th' },
          { value: 6 as const, label: '6th' },
        ]}
        selected={config.grade}
        onSelect={(v) => updateConfig('grade', v)}
        columns={4}
      />

      <OptionSelector
        label="Topic"
        options={[
          { value: 'mixed', label: 'Mixed Review' },
          ...topics.map((t) => ({ value: t.toLowerCase().replace(/ /g, '_'), label: t })),
        ]}
        selected={config.topic}
        onSelect={(v) => updateConfig('topic', v)}
      />

      <OptionSelector
        label="Number of Problems"
        options={[
          { value: 10 as const, label: '10' },
          { value: 15 as const, label: '15' },
          { value: 20 as const, label: '20' },
          { value: 25 as const, label: '25' },
        ]}
        selected={config.problemCount}
        onSelect={(v) => updateConfig('problemCount', v)}
        columns={4}
      />

      <View style={styles.toggles}>
        <ToggleSwitch
          label="Include Word Problems"
          description="Story-based problems for real-world practice"
          value={config.includeWordProblems}
          onChange={(v) => updateConfig('includeWordProblems', v)}
        />

        {config.grade <= 2 && (
          <ToggleSwitch
            label="Include Visual Aids"
            description="Pictures to help younger learners"
            value={config.includeVisualAids}
            onChange={(v) => updateConfig('includeVisualAids', v)}
          />
        )}
      </View>
    </ScrollView>
  );
}

// Main worksheet generator component
interface WorksheetGeneratorProps {
  onGenerate: (type: 'piano' | 'math', config: PianoConfig | MathConfig) => void;
  isGenerating?: boolean;
}

export function WorksheetGenerator({ onGenerate, isGenerating = false }: WorksheetGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'piano' | 'math'>('piano');

  const [pianoConfig, setPianoConfig] = useState<PianoConfig>({
    type: 'note_naming',
    clef: 'treble',
    difficulty: 'beginner',
    problemCount: 10,
    accidentals: 'none',
    theme: 'none',
  });

  const [mathConfig, setMathConfig] = useState<MathConfig>({
    grade: 3,
    topic: 'mixed',
    problemCount: 15,
    includeWordProblems: true,
    includeVisualAids: false,
  });

  const handleGenerate = () => {
    if (activeTab === 'piano') {
      onGenerate('piano', pianoConfig);
    } else {
      onGenerate('math', mathConfig);
    }
  };

  return (
    <View style={styles.container}>
      <TabBar
        tabs={[
          { key: 'piano', label: 'Piano', emoji: '🎹' },
          { key: 'math', label: 'Math', emoji: '➗' },
        ]}
        selectedTab={activeTab}
        onSelectTab={(key) => setActiveTab(key as 'piano' | 'math')}
      />

      <View style={styles.formContainer}>
        {activeTab === 'piano' ? (
          <PianoWorksheetForm config={pianoConfig} onChange={setPianoConfig} />
        ) : (
          <MathWorksheetForm config={mathConfig} onChange={setMathConfig} />
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title={isGenerating ? 'Generating...' : 'Generate Worksheet'}
          onPress={handleGenerate}
          variant={activeTab === 'piano' ? 'piano' : 'math'}
          size="lg"
          fullWidth
          loading={isGenerating}
          icon="document-text"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  formContainer: {
    flex: 1,
  },
  form: {
    flex: 1,
    padding: spacing.base,
  },
  footer: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },

  // Option selector
  optionGroup: {
    marginBottom: spacing.lg,
  },
  optionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  optionButtonSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  optionEmoji: {
    fontSize: 16,
  },
  optionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: colors.neutral.text,
    fontWeight: typography.weights.medium,
  },

  // Toggle
  toggles: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  toggleText: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  toggleDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.neutral.border,
    justifyContent: 'center',
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: colors.piano.primary,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.neutral.surface,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});

export default WorksheetGenerator;
