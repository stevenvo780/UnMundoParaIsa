import { describe, it, expect, beforeEach } from 'vitest';
import { Field } from '../src/core/Field.js';
import { FieldConfig } from '../src/types.js';

const defaultConfig: FieldConfig = {
  diffusion: 0.1,
  decay: 0.01,
  maxValue: 1.0,
};

describe('Field', () => {
  let field: Field;

  beforeEach(() => {
    field = new Field(64, 64, defaultConfig);
  });

  describe('initialization', () => {
    it('should create field with correct dimensions', () => {
      expect(field.width).toBe(64);
      expect(field.height).toBe(64);
    });

    it('should initialize all values to 0', () => {
      const buffer = field.getBuffer();
      const sum = buffer.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    });

    it('should create buffer of correct size', () => {
      const buffer = field.getBuffer();
      expect(buffer.length).toBe(64 * 64);
    });
  });

  describe('get/set operations', () => {
    it('should set and get values correctly', () => {
      field.set(10, 10, 0.5);
      expect(field.get(10, 10)).toBe(0.5);
    });

    it('should return 0 for out-of-bounds access', () => {
      expect(field.get(-1, -1)).toBe(0);
      expect(field.get(100, 100)).toBe(0);
    });

    it('should ignore set operations on out-of-bounds', () => {
      field.set(-1, -1, 1.0);
      field.set(100, 100, 1.0);
      // No crash and total should still be 0
      expect(field.getSum()).toBe(0);
    });
  });

  describe('add operation', () => {
    it('should add values correctly', () => {
      field.set(5, 5, 0.3);
      field.add(5, 5, 0.2);
      expect(field.get(5, 5)).toBeCloseTo(0.5);
    });

    it('should clamp to maxValue', () => {
      field.set(5, 5, 0.8);
      field.add(5, 5, 0.5);
      expect(field.get(5, 5)).toBeLessThanOrEqual(1.0);
    });
  });

  describe('statistics', () => {
    it('should calculate sum correctly', () => {
      field.set(0, 0, 0.5);
      field.set(1, 1, 0.3);
      field.set(2, 2, 0.2);
      expect(field.getSum()).toBeCloseTo(1.0);
    });

    it('should calculate average correctly', () => {
      // Set all cells to 0.5
      field.fill(0.5);
      expect(field.getAverage()).toBeCloseTo(0.5);
    });

    it('should find max value correctly', () => {
      field.set(10, 10, 0.5);
      field.set(20, 20, 1.0);
      field.set(30, 30, 0.3);
      expect(field.getMax()).toBe(1.0);
    });
  });

  describe('diffuseStep', () => {
    it('should spread values to neighbors', () => {
      // Set a single point
      field.set(32, 32, 1.0);
      const initialCenter = field.get(32, 32);
      
      // Diffuse and swap
      field.diffuseStep();
      field.swap();
      
      // Center should decrease, neighbors should increase
      expect(field.get(32, 32)).toBeLessThan(initialCenter);
    });
  });

  describe('decayStep', () => {
    it('should apply decay', () => {
      field.set(32, 32, 1.0);
      const initial = field.get(32, 32);
      
      field.decayStep();
      field.swap();
      
      expect(field.get(32, 32)).toBeLessThan(initial);
    });
  });

  describe('fill', () => {
    it('should fill all values', () => {
      field.fill(0.5);
      expect(field.get(0, 0)).toBe(0.5);
      expect(field.get(32, 32)).toBe(0.5);
      expect(field.get(63, 63)).toBe(0.5);
    });
  });
});
