import { describe, it, expect } from 'vitest';
import { sanitiseSlug } from './slugUtils';

describe('sanitiseSlug', () => {
  it('passes a normal slug through lowercased', () => {
    expect(sanitiseSlug('shahi-kaju-paneer-gravy')).toBe('shahi-kaju-paneer-gravy');
  });

  it('lowercases uppercase slugs', () => {
    expect(sanitiseSlug('SomeRecipe')).toBe('somerecipe');
  });

  it('strips path-traversal characters', () => {
    expect(sanitiseSlug('../etc/passwd')).toBe('etcpasswd');
  });

  it('strips slashes', () => {
    expect(sanitiseSlug('some/nested/path')).toBe('somenestedpath');
  });

  it('returns empty string for empty input', () => {
    expect(sanitiseSlug('')).toBe('');
  });

  it('keeps underscores and hyphens', () => {
    expect(sanitiseSlug('my_recipe-name')).toBe('my_recipe-name');
  });
});
