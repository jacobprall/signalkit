import { defineDetector, type DetectedSignal } from '@/core/define-plugin';
import { detectHosting, type HostingDetectionResult } from '@/utils/dns-detector';

export interface IDNSDetector {
  detectHosting(domain: string): Promise<HostingDetectionResult>;
}

const defaultDns: IDNSDetector = { detectHosting };

export function createHostingDetector(dns: IDNSDetector = defaultDns) {
  return defineDetector({
    name: 'hosting',

    async detect(company, _ctx): Promise<DetectedSignal[]> {
      if (!company.domain) return [];

      const result = await dns.detectHosting(company.domain);

      return [
        {
          signalType: 'hosting_detected',
          source: 'dns_detector',
          value: {
            provider: result.provider,
            method: result.method,
            confidence: result.confidence,
            rawCname: result.rawCname ?? null,
            rawHeaders: result.rawHeaders ?? null,
          },
          confidence: result.confidence,
        },
      ];
    },
  });
}
