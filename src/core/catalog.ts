// Default catalog values. These serve as documentation and are used
// by the API/UI for validation when a registry instance isn't available.
// At runtime, prefer `registry.getCatalog()` which is built dynamically
// from registered plugins and can never drift.

export const SIGNAL_TYPES = [
  'hosting_detected',
  'careers_page',
  'product_profile',
  'tech_stack',
  'hiring_status',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const ACTION_TYPES = [
  'prospect_brief',
  'outreach_draft',
  'cost_analysis',
  'change_alert',
  'weekly_digest',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const DELIVERY_TYPES = ['dashboard', 'slack', 'email', 'webhook'] as const;
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const HOSTING_PROVIDERS = [
  'heroku',
  'render',
  'vercel',
  'netlify',
  'railway',
  'fly',
  'aws_apprunner',
] as const;
export type HostingProvider = (typeof HOSTING_PROVIDERS)[number];

export const PAGE_TYPES = ['homepage', 'careers', 'login'] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const TRIGGER_OPERATORS = ['eq', 'neq', 'exists', 'contains', 'lt', 'gt'] as const;
export type TriggerOperator = (typeof TRIGGER_OPERATORS)[number];

export const CONDITION_SOURCES = ['signal', 'company'] as const;
export type ConditionSource = (typeof CONDITION_SOURCES)[number];

export const COMPANY_METADATA_FIELDS = [
  'team_size',
  'batch',
  'industry',
  'one_liner',
  'location',
] as const;
export type CompanyMetadataField = (typeof COMPANY_METADATA_FIELDS)[number];

export const TRIGGER_MATCH_MODES = ['all', 'any'] as const;
export type TriggerMatchMode = (typeof TRIGGER_MATCH_MODES)[number];

export const TRIGGER_EVALUATION_MODES = [
  'on_new_signal',
  'daily',
  'weekly',
] as const;
export type TriggerEvaluationMode = (typeof TRIGGER_EVALUATION_MODES)[number];
