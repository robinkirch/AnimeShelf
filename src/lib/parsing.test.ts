import { describe, expect, it } from 'vitest';
import { parseCsvLine, parseDurationToMinutes } from './parsing';

describe('parseDurationToMinutes', () => {
  it.each([
    ['24 min per ep', 24],
    ['23 min. per ep.', 23],
    ['1 hr 55 min', 115],
    ['2 hr', 120],
    ['1 hr 2 min per ep', 62],
    ['45 min', 45],
  ])('parses "%s" as %i minutes', (input, expected) => {
    expect(parseDurationToMinutes(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'Unknown', '30 sec', '0 min'])('returns null for %j', input => {
    expect(parseDurationToMinutes(input)).toBeNull();
  });
});

describe('parseCsvLine', () => {
  it('splits simple fields', () => {
    expect(parseCsvLine('1,Frieren,completed')).toEqual(['1', 'Frieren', 'completed']);
  });

  it('keeps delimiters inside quoted fields', () => {
    expect(parseCsvLine('1,"Action, Fantasy",tv')).toEqual(['1', 'Action, Fantasy', 'tv']);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsvLine('"Say ""hi""",x')).toEqual(['Say "hi"', 'x']);
  });

  it('keeps empty fields', () => {
    expect(parseCsvLine('a,,c,')).toEqual(['a', '', 'c', '']);
  });

  it('supports other delimiters', () => {
    expect(parseCsvLine('a;"b;c"', ';')).toEqual(['a', 'b;c']);
  });
});
