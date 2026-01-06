/**
 * Piano Worksheet Generator Service
 * Generates HTML for piano note worksheets that can be printed to PDF
 */

import { PianoWorksheetConfig } from '../types/database';

// Note data structure
interface NoteData {
  name: string;
  position: number; // Staff position (0 = middle line)
  accidental: 'sharp' | 'flat' | null;
  clef?: 'treble' | 'bass';
}

// Treble clef notes by difficulty
const TREBLE_NOTES: Record<string, NoteData[]> = {
  beginner: [
    { name: 'C', position: -6, accidental: null }, // Middle C
    { name: 'D', position: -5, accidental: null },
    { name: 'E', position: -4, accidental: null },
    { name: 'F', position: -3, accidental: null },
    { name: 'G', position: -2, accidental: null },
    { name: 'A', position: -1, accidental: null },
    { name: 'B', position: 0, accidental: null },
  ],
  elementary: [
    { name: 'C', position: -6, accidental: null },
    { name: 'D', position: -5, accidental: null },
    { name: 'E', position: -4, accidental: null },
    { name: 'F', position: -3, accidental: null },
    { name: 'G', position: -2, accidental: null },
    { name: 'A', position: -1, accidental: null },
    { name: 'B', position: 0, accidental: null },
    { name: 'C', position: 1, accidental: null },
    { name: 'D', position: 2, accidental: null },
    { name: 'E', position: 3, accidental: null },
    { name: 'F', position: 4, accidental: null },
  ],
  intermediate: [
    { name: 'B', position: -7, accidental: null },
    { name: 'C', position: -6, accidental: null },
    { name: 'D', position: -5, accidental: null },
    { name: 'E', position: -4, accidental: null },
    { name: 'F', position: -3, accidental: null },
    { name: 'G', position: -2, accidental: null },
    { name: 'A', position: -1, accidental: null },
    { name: 'B', position: 0, accidental: null },
    { name: 'C', position: 1, accidental: null },
    { name: 'D', position: 2, accidental: null },
    { name: 'E', position: 3, accidental: null },
    { name: 'F', position: 4, accidental: null },
    { name: 'G', position: 5, accidental: null },
    { name: 'A', position: 6, accidental: null },
  ],
  advanced: [
    { name: 'A', position: -8, accidental: null },
    { name: 'B', position: -7, accidental: null },
    { name: 'C', position: -6, accidental: null },
    { name: 'D', position: -5, accidental: null },
    { name: 'E', position: -4, accidental: null },
    { name: 'F', position: -3, accidental: null },
    { name: 'G', position: -2, accidental: null },
    { name: 'A', position: -1, accidental: null },
    { name: 'B', position: 0, accidental: null },
    { name: 'C', position: 1, accidental: null },
    { name: 'D', position: 2, accidental: null },
    { name: 'E', position: 3, accidental: null },
    { name: 'F', position: 4, accidental: null },
    { name: 'G', position: 5, accidental: null },
    { name: 'A', position: 6, accidental: null },
    { name: 'B', position: 7, accidental: null },
    { name: 'C', position: 8, accidental: null },
  ],
};

// Bass clef notes by difficulty
const BASS_NOTES: Record<string, NoteData[]> = {
  beginner: [
    { name: 'E', position: -6, accidental: null },
    { name: 'F', position: -5, accidental: null },
    { name: 'G', position: -4, accidental: null },
    { name: 'A', position: -3, accidental: null },
    { name: 'B', position: -2, accidental: null },
    { name: 'C', position: -1, accidental: null },
    { name: 'D', position: 0, accidental: null },
  ],
  elementary: [
    { name: 'E', position: -6, accidental: null },
    { name: 'F', position: -5, accidental: null },
    { name: 'G', position: -4, accidental: null },
    { name: 'A', position: -3, accidental: null },
    { name: 'B', position: -2, accidental: null },
    { name: 'C', position: -1, accidental: null },
    { name: 'D', position: 0, accidental: null },
    { name: 'E', position: 1, accidental: null },
    { name: 'F', position: 2, accidental: null },
    { name: 'G', position: 3, accidental: null },
    { name: 'A', position: 4, accidental: null },
  ],
  intermediate: [
    { name: 'D', position: -7, accidental: null },
    { name: 'E', position: -6, accidental: null },
    { name: 'F', position: -5, accidental: null },
    { name: 'G', position: -4, accidental: null },
    { name: 'A', position: -3, accidental: null },
    { name: 'B', position: -2, accidental: null },
    { name: 'C', position: -1, accidental: null },
    { name: 'D', position: 0, accidental: null },
    { name: 'E', position: 1, accidental: null },
    { name: 'F', position: 2, accidental: null },
    { name: 'G', position: 3, accidental: null },
    { name: 'A', position: 4, accidental: null },
    { name: 'B', position: 5, accidental: null },
    { name: 'C', position: 6, accidental: null },
  ],
  advanced: [
    { name: 'C', position: -8, accidental: null },
    { name: 'D', position: -7, accidental: null },
    { name: 'E', position: -6, accidental: null },
    { name: 'F', position: -5, accidental: null },
    { name: 'G', position: -4, accidental: null },
    { name: 'A', position: -3, accidental: null },
    { name: 'B', position: -2, accidental: null },
    { name: 'C', position: -1, accidental: null },
    { name: 'D', position: 0, accidental: null },
    { name: 'E', position: 1, accidental: null },
    { name: 'F', position: 2, accidental: null },
    { name: 'G', position: 3, accidental: null },
    { name: 'A', position: 4, accidental: null },
    { name: 'B', position: 5, accidental: null },
    { name: 'C', position: 6, accidental: null },
    { name: 'D', position: 7, accidental: null },
    { name: 'E', position: 8, accidental: null },
  ],
};

// Add accidentals to notes based on config
function addAccidentals(notes: NoteData[], accidentalType: string): NoteData[] {
  if (accidentalType === 'none') return notes;

  return notes.map(note => {
    const canHaveSharp = !['B', 'E'].includes(note.name);
    const canHaveFlat = !['C', 'F'].includes(note.name);

    let accidental: 'sharp' | 'flat' | null = null;

    if (accidentalType === 'sharps' && canHaveSharp && Math.random() > 0.6) {
      accidental = 'sharp';
    } else if (accidentalType === 'flats' && canHaveFlat && Math.random() > 0.6) {
      accidental = 'flat';
    } else if (accidentalType === 'mixed') {
      if (canHaveSharp && Math.random() > 0.7) accidental = 'sharp';
      else if (canHaveFlat && Math.random() > 0.7) accidental = 'flat';
    }

    return { ...note, accidental };
  });
}

// Generate random problems
export function generateProblems(config: PianoWorksheetConfig): NoteData[] {
  let notePool: NoteData[] = [];

  if (config.clef === 'treble' || config.clef === 'grand') {
    notePool = [...(TREBLE_NOTES[config.difficulty] || TREBLE_NOTES.beginner)].map(n => ({
      ...n,
      clef: 'treble' as const,
    }));
  }
  if (config.clef === 'bass' || config.clef === 'grand') {
    const bassNotes = (BASS_NOTES[config.difficulty] || BASS_NOTES.beginner).map(n => ({
      ...n,
      clef: 'bass' as const,
    }));
    notePool = [...notePool, ...bassNotes];
  }

  // Add accidentals
  notePool = addAccidentals(notePool, config.accidentals);

  // Randomly select problems
  const problems: NoteData[] = [];
  for (let i = 0; i < config.problemCount; i++) {
    const randomIndex = Math.floor(Math.random() * notePool.length);
    problems.push({ ...notePool[randomIndex] });
  }

  return problems;
}

// Get note display name with accidental
function getNoteDisplayName(note: NoteData): string {
  let name = note.name;
  if (note.accidental === 'sharp') name += '♯';
  if (note.accidental === 'flat') name += '♭';
  return name;
}

// Generate SVG for a single staff with note
function generateStaffSVG(
  note: NoteData,
  clef: 'treble' | 'bass',
  showNote: boolean,
  showAnswer: boolean
): string {
  const width = 120;
  const height = 80;
  const staffTop = 15;
  const lineSpacing = 10;
  const staffHeight = lineSpacing * 4;

  // Clef symbols (using Unicode)
  const trebleClef = '𝄞';
  const bassClef = '𝄢';

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Draw 5 staff lines
  for (let i = 0; i < 5; i++) {
    const y = staffTop + i * lineSpacing;
    svg += `<line x1="5" y1="${y}" x2="${width - 5}" y2="${y}" stroke="#333" stroke-width="1"/>`;
  }

  // Draw clef
  const clefX = 12;
  if (clef === 'treble') {
    svg += `<text x="${clefX}" y="${staffTop + 32}" font-family="serif" font-size="38" fill="#333">${trebleClef}</text>`;
  } else {
    svg += `<text x="${clefX}" y="${staffTop + 28}" font-family="serif" font-size="28" fill="#333">${bassClef}</text>`;
  }

  if (showNote) {
    // Calculate note Y position
    // Position 0 = middle line (3rd line from bottom = staffTop + 2*lineSpacing)
    // For treble: position 0 = B (middle line)
    // Each position change = half lineSpacing
    const middleLineY = staffTop + 2 * lineSpacing;
    const noteY = middleLineY - (note.position * (lineSpacing / 2));
    const noteX = 75;

    // Draw ledger lines if needed
    if (note.position < -4) {
      for (let p = -6; p >= note.position; p -= 2) {
        const ledgerY = middleLineY - (p * (lineSpacing / 2));
        if (ledgerY > staffTop + staffHeight) {
          svg += `<line x1="${noteX - 12}" y1="${ledgerY}" x2="${noteX + 12}" y2="${ledgerY}" stroke="#333" stroke-width="1"/>`;
        }
      }
    }
    if (note.position > 4) {
      for (let p = 6; p <= note.position; p += 2) {
        const ledgerY = middleLineY - (p * (lineSpacing / 2));
        if (ledgerY < staffTop) {
          svg += `<line x1="${noteX - 12}" y1="${ledgerY}" x2="${noteX + 12}" y2="${ledgerY}" stroke="#333" stroke-width="1"/>`;
        }
      }
    }

    // Draw accidental
    if (note.accidental) {
      const accidentalSymbol = note.accidental === 'sharp' ? '♯' : '♭';
      svg += `<text x="${noteX - 18}" y="${noteY + 5}" font-family="serif" font-size="14" fill="#333">${accidentalSymbol}</text>`;
    }

    // Draw note head (filled ellipse)
    svg += `<ellipse cx="${noteX}" cy="${noteY}" rx="7" ry="5" fill="#333"/>`;
  }

  // Show answer below staff
  if (showAnswer) {
    svg += `<text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-family="Arial" font-size="14" fill="#2563eb" font-weight="bold">${getNoteDisplayName(note)}</text>`;
  }

  svg += '</svg>';
  return svg;
}

// Generate complete worksheet HTML
export function generateWorksheetHTML(
  config: PianoWorksheetConfig,
  problems: NoteData[],
  studentName: string,
  isAnswerKey: boolean = false
): string {
  const worksheetType = config.type === 'note_naming' ? 'Note Naming' : 'Note Drawing';
  const clefName = config.clef.charAt(0).toUpperCase() + config.clef.slice(1);
  const difficultyName = config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1);

  const problemsPerRow = 5;
  const rows: NoteData[][] = [];
  for (let i = 0; i < problems.length; i += problemsPerRow) {
    rows.push(problems.slice(i, i + problemsPerRow));
  }

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #333;
    }
    .title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #666;
    }
    .answer-key-badge {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      font-size: 14px;
    }
    .instructions {
      background: #f3f4f6;
      padding: 10px 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #374151;
    }
    .problems-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
    }
    .problem {
      text-align: center;
      padding: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fff;
    }
    .problem-number {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 5px;
      color: #6b7280;
    }
    .answer-line {
      width: 40px;
      height: 24px;
      border-bottom: 2px solid #333;
      margin: 8px auto 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .note-prompt {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
      color: #1f2937;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">
      ${worksheetType} Worksheet - ${clefName} Clef
      ${isAnswerKey ? '<span class="answer-key-badge">ANSWER KEY</span>' : ''}
    </div>
    <div class="subtitle">Love2Learn Tutoring</div>
  </div>

  <div class="info-row">
    <div><strong>Student:</strong> ${studentName}</div>
    <div><strong>Difficulty:</strong> ${difficultyName}</div>
    <div><strong>Date:</strong> ____________</div>
  </div>

  <div class="instructions">
    ${config.type === 'note_naming'
      ? '<strong>Instructions:</strong> Name each note shown on the staff. Write your answer on the line below.'
      : '<strong>Instructions:</strong> Draw each note on the staff at the correct position.'}
  </div>

  <div class="problems-grid">
`;

  problems.forEach((problem, index) => {
    const clefToUse = problem.clef || config.clef;
    const showNote = config.type === 'note_naming';
    const showAnswer = isAnswerKey;

    // For note_drawing, we show the note name and optionally the answer (note on staff)
    if (config.type === 'note_drawing') {
      html += `
    <div class="problem">
      <div class="problem-number">${index + 1}</div>
      <div class="note-prompt">${getNoteDisplayName(problem)}</div>
      ${generateStaffSVG(problem, clefToUse === 'grand' ? 'treble' : clefToUse, isAnswerKey, false)}
    </div>
`;
    } else {
      // Note naming - show note, optionally show answer
      html += `
    <div class="problem">
      <div class="problem-number">${index + 1}</div>
      ${generateStaffSVG(problem, clefToUse === 'grand' ? 'treble' : clefToUse, true, isAnswerKey)}
      ${!isAnswerKey ? '<div class="answer-line"></div>' : ''}
    </div>
`;
    }
  });

  html += `
  </div>

  <div class="footer">
    Generated by Love2Learn Tutoring App | ${new Date().toLocaleDateString()}
  </div>
</body>
</html>
`;

  return html;
}

// Export interface for worksheet result
export interface WorksheetResult {
  worksheetHtml: string;
  answerKeyHtml: string;
  problems: Array<{ name: string; position: number }>;
}

// Main generation function
export function generatePianoWorksheet(
  config: PianoWorksheetConfig,
  studentName: string
): WorksheetResult {
  const problems = generateProblems(config);

  return {
    worksheetHtml: generateWorksheetHTML(config, problems, studentName, false),
    answerKeyHtml: generateWorksheetHTML(config, problems, studentName, true),
    problems: problems.map(p => ({
      name: getNoteDisplayName(p),
      position: p.position,
    })),
  };
}

// Generate worksheet from stored config (for viewing existing assignments)
export function generatePianoWorksheetFromConfig(
  config: unknown,
  studentName: string
): WorksheetResult | null {
  // Validate config is a PianoWorksheetConfig
  if (!config || typeof config !== 'object') return null;

  const c = config as Record<string, unknown>;
  if (
    !c.type ||
    !c.clef ||
    !c.difficulty ||
    !c.problemCount ||
    (c.type !== 'note_naming' && c.type !== 'note_drawing')
  ) {
    return null;
  }

  const pianoConfig: PianoWorksheetConfig = {
    type: c.type as 'note_naming' | 'note_drawing',
    clef: (c.clef as string) as 'treble' | 'bass' | 'grand',
    difficulty: (c.difficulty as string) as 'beginner' | 'elementary' | 'intermediate' | 'advanced',
    problemCount: c.problemCount as 10 | 15 | 20,
    accidentals: (c.accidentals as string || 'none') as 'none' | 'sharps' | 'flats' | 'mixed',
    theme: c.theme as 'space' | 'animals' | 'ocean' | undefined,
  };

  return generatePianoWorksheet(pianoConfig, studentName);
}
