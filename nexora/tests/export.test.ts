import { describe, expect, it } from 'vitest';
import { csvCell } from '../src/lib/export';

describe('CSV export safety', () => {
  it('quotes delimiters and embedded quotation marks without losing data', () => {
    expect(csvCell('Brief, "final"\nnotes')).toBe('"Brief, ""final""\nnotes"');
  });
  it.each(['=HYPERLINK("evil")', '+SUM(A1:A2)', '@SUM(A1:A2)', '-1+2', '  =1+1', '\t@SUM(1)'])(
    'neutralizes executable spreadsheet input: %s',
    (value) => {
      expect(csvCell(value)).toBe('"\'' + value.replaceAll('"', '""') + '"');
    },
  );
  it('preserves ordinary text and null fields', () => {
    expect(csvCell('Create a project')).toBe('"Create a project"');
    expect(csvCell(null)).toBe('""');
  });
});
