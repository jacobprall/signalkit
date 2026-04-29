import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { parseDomain } from '../src/utils/parse-domain';
import { detectHosting } from '../src/utils/dns-detector';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function main() {
  console.log('Fetching YC companies...');
  const res = await fetch('https://yc-oss.github.io/api/companies/all.json');
  const all = (await res.json()) as Array<Record<string, unknown>>;

  const candidates = all.filter(
    (c) =>
      (c.team_size as number) >= 5 &&
      (c.team_size as number) <= 30 &&
      c.status === 'Active' &&
      c.website &&
      c.isHiring === true,
  );

  const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 20))];
  if (!pick) {
    console.error('No matching company found');
    process.exit(1);
  }

  const domain = parseDomain(pick.website as string);
  console.log(`\nSelected: ${pick.name} (${domain})`);
  console.log(`  One-liner: ${pick.one_liner}`);
  console.log(`  Batch: ${pick.batch}, Team: ${pick.team_size}, Hiring: ${pick.isHiring}`);
  console.log(`  Website: ${pick.website}`);

  // Upsert company
  console.log('\nInserting company...');
  const slug = (pick.slug as string) || (pick.name as string).toLowerCase().replace(/\s+/g, '-');
  const [company] = await db
    .insert(schema.companies)
    .values({
      name: pick.name as string,
      slug,
      domain,
      websiteUrl: pick.website as string,
      logoUrl: (pick.logo_url as string) ?? null,
      source: 'yc_directory',
      sourceId: String(pick.id),
      sourceData: pick,
      metadata: pick,
    })
    .onConflictDoUpdate({
      target: [schema.companies.slug],
      set: {
        domain,
        websiteUrl: pick.website as string,
        sourceData: pick,
        metadata: pick,
        updatedAt: new Date(),
      },
    })
    .returning();

  console.log(`  Company ID: ${company.id}`);

  // Run DNS/HTTP hosting detection
  console.log('\nRunning hosting detection...');
  if (domain) {
    try {
      const hosting = await detectHosting(domain);
      console.log(`  Provider: ${hosting.provider} (method: ${hosting.method}, confidence: ${hosting.confidence})`);
      if (hosting.rawCname) console.log(`  CNAME: ${hosting.rawCname}`);

      await db
        .insert(schema.signals)
        .values({
          companyId: company.id,
          signalType: 'hosting_detected',
          source: 'dns_detector',
          value: hosting as unknown as Record<string, unknown>,
          confidence: hosting.confidence,
          detectedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [schema.signals.companyId, schema.signals.signalType],
          set: {
            value: hosting as unknown as Record<string, unknown>,
            confidence: hosting.confidence,
            detectedAt: new Date(),
          },
        });
      console.log('  Signal saved.');
    } catch (err) {
      console.log(`  Hosting detection failed: ${err}`);
    }
  }

  // Add a hiring_status signal from YC data
  console.log('\nAdding hiring signal...');
  await db
    .insert(schema.signals)
    .values({
      companyId: company.id,
      signalType: 'hiring_status',
      source: 'yc_directory',
      value: { isHiring: pick.isHiring },
      confidence: 1.0,
      detectedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.signals.companyId, schema.signals.signalType],
      set: {
        value: { isHiring: pick.isHiring },
        detectedAt: new Date(),
      },
    });
  console.log('  Done.');

  // Seed a default trigger
  console.log('\nSeeding default trigger...');
  const existing = await db.query.triggers.findFirst({
    where: eq(schema.triggers.name, 'Heroku companies hiring DevOps'),
  });
  if (!existing) {
    await db.insert(schema.triggers).values({
      name: 'Heroku companies hiring DevOps',
      conditions: {
        match: 'all',
        conditions: [
          { signal_type: 'hosting_detected', field: 'provider', operator: 'eq', value: 'heroku' },
          { signal_type: 'hiring_status', field: 'isHiring', operator: 'eq', value: true },
        ],
      },
      actionType: 'prospect_brief',
      actionConfig: {},
      deliveries: [{ type: 'dashboard', config: {} }],
      evaluation: 'on_new_signal',
      isActive: true,
    });
    console.log('  Trigger created.');
  } else {
    console.log('  Trigger already exists.');
  }

  // Seed a collection run for observability
  await db.insert(schema.collectionRuns).values({
    collectorType: 'yc_directory',
    status: 'completed',
    stats: { found: 1, new: 1, updated: 0, errors: 0 },
    startedAt: new Date(),
    completedAt: new Date(),
  });

  // Also add 4 more companies in bulk for a better demo table
  console.log('\nAdding 4 more companies for demo...');
  const extras = all
    .filter(
      (c) =>
        (c.team_size as number) >= 2 &&
        (c.team_size as number) <= 50 &&
        c.status === 'Active' &&
        c.website &&
        String(c.id) !== String(pick.id),
    )
    .slice(0, 4);

  for (const extra of extras) {
    const d = parseDomain(extra.website as string);
    const s = (extra.slug as string) || (extra.name as string).toLowerCase().replace(/\s+/g, '-');
    try {
      await db
        .insert(schema.companies)
        .values({
          name: extra.name as string,
          slug: s,
          domain: d,
          websiteUrl: extra.website as string,
          source: 'yc_directory',
          sourceId: String(extra.id),
          sourceData: extra,
          metadata: extra,
        })
        .onConflictDoNothing();
      console.log(`  Added: ${extra.name}`);
    } catch {
      console.log(`  Skipped: ${extra.name} (duplicate)`);
    }
  }

  console.log('\n--- Done! ---');
  console.log(`\nOpen http://localhost:3000 to see the dashboard`);
  console.log(`Company detail: http://localhost:3000/companies/${company.id}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
