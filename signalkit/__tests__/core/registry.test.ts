import { describe, it, expect, beforeEach } from 'vitest';
import { PluginRegistry } from '@/core/plugin-registry';
import {
  defineCollector,
  defineDetector,
  defineAction,
  defineDelivery,
} from '@/core/define-plugin';

function mockCollector(name: string) {
  return defineCollector({
    name,
    async *collect() {
      yield { source: name, sourceId: '1', data: {} };
    },
  });
}

function mockDetector(name: string) {
  return defineDetector({
    name,
    async detect() {
      return [{ signalType: name, source: 'test', value: {}, confidence: 1 }];
    },
  });
}

function mockAction(name: string) {
  return defineAction({
    name,
    async execute() {
      return { content: {} };
    },
  });
}

function mockDelivery(name: string) {
  return defineDelivery({
    name,
    async deliver() {},
  });
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('Collector registration', () => {
    it('registers and retrieves a collector', () => {
      const collector = mockCollector('yc_directory');
      registry.register(collector);
      expect(registry.getCollector('yc_directory')).toBe(collector);
    });

    it('returns undefined for unregistered collector', () => {
      expect(registry.getCollector('nonexistent')).toBeUndefined();
    });

    it('throws on duplicate collector registration', () => {
      registry.register(mockCollector('yc_directory'));
      expect(() => registry.register(mockCollector('yc_directory'))).toThrow();
    });

    it('getAllCollectors returns all registered collectors', () => {
      const c1 = mockCollector('yc_directory');
      const c2 = mockCollector('other_source');
      registry.register(c1);
      registry.register(c2);
      const all = registry.getAllCollectors();
      expect(all).toHaveLength(2);
      expect(all).toContain(c1);
      expect(all).toContain(c2);
    });
  });

  describe('Detector registration', () => {
    it('registers and retrieves a detector', () => {
      const detector = mockDetector('hosting');
      registry.register(detector);
      expect(registry.getDetector('hosting')).toBe(detector);
    });

    it('returns undefined for unregistered detector', () => {
      expect(registry.getDetector('nonexistent')).toBeUndefined();
    });

    it('throws on duplicate detector registration', () => {
      registry.register(mockDetector('hosting'));
      expect(() => registry.register(mockDetector('hosting'))).toThrow();
    });

    it('requireDetector throws for unregistered detector', () => {
      expect(() => registry.requireDetector('nonexistent')).toThrow();
    });

    it('getAllDetectors returns all registered detectors', () => {
      const d1 = mockDetector('hosting');
      const d2 = mockDetector('hiring');
      registry.register(d1);
      registry.register(d2);
      const all = registry.getAllDetectors();
      expect(all).toHaveLength(2);
      expect(all).toContain(d1);
      expect(all).toContain(d2);
    });
  });

  describe('Action registration', () => {
    it('registers and retrieves an action', () => {
      const action = mockAction('company_analysis');
      registry.register(action);
      expect(registry.getAction('company_analysis')).toBe(action);
    });

    it('returns undefined for unregistered action', () => {
      expect(registry.getAction('nonexistent')).toBeUndefined();
    });

    it('throws on duplicate action registration', () => {
      registry.register(mockAction('company_analysis'));
      expect(() => registry.register(mockAction('company_analysis'))).toThrow();
    });

    it('requireAction throws for unregistered action', () => {
      expect(() => registry.requireAction('nonexistent')).toThrow();
    });

    it('getAllActions returns all registered actions', () => {
      const a1 = mockAction('company_analysis');
      const a2 = mockAction('outreach_email');
      registry.register(a1);
      registry.register(a2);
      const all = registry.getAllActions();
      expect(all).toHaveLength(2);
      expect(all).toContain(a1);
      expect(all).toContain(a2);
    });
  });

  describe('Delivery registration', () => {
    it('registers and retrieves a delivery', () => {
      const delivery = mockDelivery('slack');
      registry.register(delivery);
      expect(registry.getDelivery('slack')).toBe(delivery);
    });

    it('returns undefined for unregistered delivery', () => {
      expect(registry.getDelivery('nonexistent')).toBeUndefined();
    });

    it('throws on duplicate delivery registration', () => {
      registry.register(mockDelivery('slack'));
      expect(() => registry.register(mockDelivery('slack'))).toThrow();
    });

    it('requireDelivery throws for unregistered delivery', () => {
      expect(() => registry.requireDelivery('nonexistent')).toThrow();
    });

    it('getAllDeliveries returns all registered deliveries', () => {
      const d1 = mockDelivery('slack');
      const d2 = mockDelivery('email');
      registry.register(d1);
      registry.register(d2);
      const all = registry.getAllDeliveries();
      expect(all).toHaveLength(2);
      expect(all).toContain(d1);
      expect(all).toContain(d2);
    });
  });

  describe('getCatalog', () => {
    it('returns dynamic catalog from registered plugins', () => {
      registry.register(mockCollector('yc'));
      registry.register(mockDetector('hosting'));
      registry.register(mockDetector('website'));
      registry.register(mockAction('brief'));
      registry.register(mockDelivery('slack'));

      const catalog = registry.getCatalog();
      expect(catalog.collectorTypes).toEqual(['yc']);
      expect(catalog.signalTypes).toEqual(expect.arrayContaining(['hosting', 'website']));
      expect(catalog.actionTypes).toEqual(['brief']);
      expect(catalog.deliveryTypes).toEqual(['slack']);
    });
  });
});
