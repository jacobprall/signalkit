import type {
  PluginDefinition,
  CollectorDefinition,
  DetectorDefinition,
  ActionDefinition,
  DeliveryDefinition,
  EnricherDefinition,
} from './define-plugin';

/**
 * The plugin registry holds all registered plugins. Bootstrap reads
 * from the registry to wire each plugin to the appropriate job
 * dispatcher handler. Adding a new plugin = one `register()` call.
 */
export class PluginRegistry {
  private readonly collectors = new Map<string, CollectorDefinition>();
  private readonly detectors = new Map<string, DetectorDefinition>();
  private readonly actions = new Map<string, ActionDefinition>();
  private readonly deliveries = new Map<string, DeliveryDefinition>();
  private readonly enrichers = new Map<string, EnricherDefinition>();

  register(plugin: PluginDefinition): void {
    switch (plugin.kind) {
      case 'collector':
        if (this.collectors.has(plugin.name))
          throw new Error(`Collector already registered: ${plugin.name}`);
        this.collectors.set(plugin.name, plugin);
        break;
      case 'detector':
        if (this.detectors.has(plugin.name))
          throw new Error(`Detector already registered: ${plugin.name}`);
        this.detectors.set(plugin.name, plugin);
        break;
      case 'action':
        if (this.actions.has(plugin.name))
          throw new Error(`Action already registered: ${plugin.name}`);
        this.actions.set(plugin.name, plugin);
        break;
      case 'delivery':
        if (this.deliveries.has(plugin.name))
          throw new Error(`Delivery already registered: ${plugin.name}`);
        this.deliveries.set(plugin.name, plugin);
        break;
      case 'enricher':
        if (this.enrichers.has(plugin.name))
          throw new Error(`Enricher already registered: ${plugin.name}`);
        this.enrichers.set(plugin.name, plugin);
        break;
    }
  }

  getCollector(name: string): CollectorDefinition | undefined {
    return this.collectors.get(name);
  }

  getDetector(name: string): DetectorDefinition | undefined {
    return this.detectors.get(name);
  }

  getAction(name: string): ActionDefinition | undefined {
    return this.actions.get(name);
  }

  getDelivery(name: string): DeliveryDefinition | undefined {
    return this.deliveries.get(name);
  }

  requireCollector(name: string): CollectorDefinition {
    const c = this.collectors.get(name);
    if (!c) throw new Error(`Collector not registered: ${name}`);
    return c;
  }

  requireDetector(name: string): DetectorDefinition {
    const d = this.detectors.get(name);
    if (!d) throw new Error(`Detector not registered: ${name}`);
    return d;
  }

  requireAction(name: string): ActionDefinition {
    const a = this.actions.get(name);
    if (!a) throw new Error(`Action not registered: ${name}`);
    return a;
  }

  requireDelivery(name: string): DeliveryDefinition {
    const d = this.deliveries.get(name);
    if (!d) throw new Error(`Delivery not registered: ${name}`);
    return d;
  }

  getAllCollectors(): CollectorDefinition[] {
    return [...this.collectors.values()];
  }

  getAllDetectors(): DetectorDefinition[] {
    return [...this.detectors.values()];
  }

  getAllActions(): ActionDefinition[] {
    return [...this.actions.values()];
  }

  getAllDeliveries(): DeliveryDefinition[] {
    return [...this.deliveries.values()];
  }

  getEnricher(name: string): EnricherDefinition | undefined {
    return this.enrichers.get(name);
  }

  requireEnricher(name: string): EnricherDefinition {
    const e = this.enrichers.get(name);
    if (!e) throw new Error(`Enricher not registered: ${name}`);
    return e;
  }

  getAllEnrichers(): EnricherDefinition[] {
    return [...this.enrichers.values()];
  }

  /**
   * Returns the dynamically-built catalog from registered plugins.
   */
  getCatalog() {
    return {
      signalTypes: [...new Set(this.detectors.keys())],
      actionTypes: [...this.actions.keys()],
      deliveryTypes: [...this.deliveries.keys()],
      collectorTypes: [...this.collectors.keys()],
      enricherTypes: [...this.enrichers.keys()],
    };
  }
}
