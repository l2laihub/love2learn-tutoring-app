/**
 * MarkdownView
 * DaLesson Tutoring App
 *
 * Small markdown renderer for the legal pages (privacy policy, terms).
 * Supports what those docs use: # to #### headings, paragraphs, bullet and
 * numbered lists (nested by indent), tables, horizontal rules, **bold**,
 * *italic*, [links](url), and bare email addresses / URLs.
 */

import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '../theme';

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: { text: string; depth: number; marker: string }[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'hr' };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushPara();
      blocks.push({ type: 'hr' });
      continue;
    }

    if (trimmed.startsWith('|')) {
      flushPara();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      blocks.push({ type: 'table', rows });
      continue;
    }

    const listItem = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listItem) {
      flushPara();
      const items: { text: string; depth: number; marker: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) break;
        items.push({
          depth: Math.floor(m[1].replace(/\t/g, '  ').length / 2),
          marker: /\d/.test(m[2]) ? m[2] : '•',
          text: m[3],
        });
        i++;
      }
      i--;
      blocks.push({ type: 'list', items });
      continue;
    }

    para.push(trimmed);
  }
  flushPara();
  return blocks;
}

function openLink(url: string) {
  if (url.startsWith('/')) {
    router.push(url as never);
  } else {
    Linking.openURL(url).catch(() => undefined);
  }
}

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|https?:\/\/[^\s)]+)/g;

/** Render inline markdown (bold, italic, links, emails, URLs) as nested Text. */
function renderInline(text: string, keyPrefix = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const token = m[0];
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${n++}`;
    if (token.startsWith('**')) {
      out.push(<Text key={key} style={styles.bold}>{renderInline(token.slice(2, -2), key)}</Text>);
    } else if (token.startsWith('[')) {
      const [, label, url] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [];
      out.push(
        <Text key={key} style={styles.link} onPress={() => openLink(url)} accessibilityRole="link">
          {label}
        </Text>
      );
    } else if (token.startsWith('*')) {
      out.push(<Text key={key} style={styles.italic}>{renderInline(token.slice(1, -1), key)}</Text>);
    } else if (token.includes('@') && !token.startsWith('http')) {
      out.push(
        <Text key={key} style={styles.link} onPress={() => openLink(`mailto:${token}`)} accessibilityRole="link">
          {token}
        </Text>
      );
    } else {
      out.push(
        <Text key={key} style={styles.link} onPress={() => openLink(token)} accessibilityRole="link">
          {token}
        </Text>
      );
    }
    last = start + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownView({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);
  return (
    <View>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <Text
                key={idx}
                accessibilityRole="header"
                style={[styles.heading, styles[`h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4']]}
              >
                {renderInline(block.text, `h${idx}`)}
              </Text>
            );
          case 'paragraph':
            return (
              <Text key={idx} style={styles.paragraph}>
                {renderInline(block.text, `p${idx}`)}
              </Text>
            );
          case 'list':
            return (
              <View key={idx} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={[styles.listItem, { paddingLeft: item.depth * spacing.lg }]}>
                    <Text style={styles.bullet}>{item.marker}</Text>
                    <Text style={styles.listText}>{renderInline(item.text, `l${idx}-${j}`)}</Text>
                  </View>
                ))}
              </View>
            );
          case 'table':
            return (
              <View key={idx} style={styles.table}>
                {block.rows.map((row, r) => (
                  <View key={r} style={[styles.tableRow, r === 0 && styles.tableHeader]}>
                    {row.map((cell, c) => (
                      <Text key={c} style={[styles.tableCell, r === 0 && styles.bold]}>
                        {renderInline(cell, `t${idx}-${r}-${c}`)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
          case 'hr':
            return <View key={idx} style={styles.hr} />;
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.neutral.text,
    fontWeight: typography.weights.bold,
  },
  h1: { fontSize: typography.sizes['2xl'], marginBottom: spacing.md },
  h2: { fontSize: typography.sizes.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  h3: { fontSize: typography.sizes.md, marginTop: spacing.lg, marginBottom: spacing.sm },
  h4: { fontSize: typography.sizes.base, marginTop: spacing.base, marginBottom: spacing.xs },
  paragraph: {
    fontSize: typography.sizes.base,
    lineHeight: 23,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  bold: { fontWeight: typography.weights.semibold, color: colors.neutral.text },
  italic: { fontStyle: 'italic' },
  link: { color: colors.primary.main, textDecorationLine: 'underline' },
  list: { marginBottom: spacing.md },
  listItem: { flexDirection: 'row', marginBottom: spacing.xs },
  bullet: {
    width: 22,
    fontSize: typography.sizes.base,
    lineHeight: 23,
    color: colors.neutral.textSecondary,
  },
  listText: {
    flex: 1,
    fontSize: typography.sizes.base,
    lineHeight: 23,
    color: colors.neutral.textSecondary,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  tableHeader: {
    borderTopWidth: 0,
    backgroundColor: colors.neutral.background,
  },
  tableCell: {
    flex: 1,
    padding: spacing.sm,
    fontSize: typography.sizes.sm,
    lineHeight: 19,
    color: colors.neutral.textSecondary,
  },
  hr: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.lg,
  },
});

export default MarkdownView;
