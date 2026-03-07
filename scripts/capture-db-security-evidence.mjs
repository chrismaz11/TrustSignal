#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

function runCommand(command, args, options = {}) {
  const runEnv = options.env ? { ...process.env, ...options.env } : process.env;
  try {
    const stdout = execFileSync(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: runEnv,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, stdout: stdout.trim(), stderr: '' };
  } catch (error) {
    const stdout = (error.stdout || '').toString().trim();
    const stderr = (error.stderr || error.message || '').toString().trim();
    return { ok: false, stdout, stderr };
  }
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function redactDatabaseUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return 'UNPARSABLE_DATABASE_URL';
  }
}

function summarizeDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    return {
      present: false,
      protocol: null,
      host: null,
      database: null,
      sslmode: null,
      protocolOk: false,
      sslmodeOk: false
    };
  }

  try {
    const parsed = new URL(rawUrl);
    const sslmode = parsed.searchParams.get('sslmode');
    const protocolOk = parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:';
    const sslmodeOk = sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full';

    return {
      present: true,
      protocol: parsed.protocol,
      host: parsed.host,
      database: parsed.pathname.replace(/^\//, ''),
      sslmode,
      protocolOk,
      sslmodeOk
    };
  } catch {
    return {
      present: true,
      protocol: 'unparseable',
      host: null,
      database: null,
      sslmode: null,
      protocolOk: false,
      sslmodeOk: false
    };
  }
}

function extractDatasourceProvider(schemaContents) {
  const match = schemaContents.match(/datasource\s+db\s*{[\s\S]*?provider\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function currentTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function stampForFilename() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function mdSection(title, bodyLines) {
  return [`## ${title}`, ...bodyLines, ''];
}

function evaluatePsqlCheck(label, result) {
  if (!result.ok) return 'FAIL';
  const normalized = (result.stdout || '').trim().toLowerCase();

  if (label === 'Server SSL Capability') {
    return normalized === 'on' ? 'PASS' : 'FAIL';
  }

  if (label === 'Server Minimum SSL Protocol') {
    return normalized === 'tlsv1.2' || normalized === 'tlsv1.3' ? 'PASS' : 'FAIL';
  }

  if (label === 'Current Session TLS') {
    const firstColumn = normalized.split('|')[0];
    return firstColumn === 't' || firstColumn === 'true' ? 'PASS' : 'FAIL';
  }

  return 'PASS';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    console.log(
      [
        'Usage:',
        '  node scripts/capture-db-security-evidence.mjs \\',
        '    --environment staging \\',
        '    [--database-url "<postgres-url>"] \\',
        '    [--db-instance-id "<rds-instance-id>"] \\',
        '    [--db-cluster-id "<rds-cluster-id>"] \\',
        '    [--output "docs/evidence/db-security/staging-YYYYMMDDTHHMMSSZ.md"]'
      ].join('\n')
    );
    process.exit(0);
  }

  const environment = args.environment || 'staging';
  const databaseUrl = args['database-url'] || process.env.DATABASE_URL || '';
  const dbInstanceId = args['db-instance-id'] || '';
  const dbClusterId = args['db-cluster-id'] || '';

  const defaultOutput = path.join(
    repoRoot,
    'docs',
    'evidence',
    'db-security',
    `${environment}-${stampForFilename()}.md`
  );
  const outputPath = path.resolve(args.output || defaultOutput);

  const schemaPath = path.join(repoRoot, 'apps', 'api', 'prisma', 'schema.prisma');
  const migrationLockPath = path.join(repoRoot, 'apps', 'api', 'prisma', 'migrations', 'migration_lock.toml');
  const baselineMigrationPath = path.join(
    repoRoot,
    'apps',
    'api',
    'prisma',
    'migrations',
    '20260222141500_postgresql_baseline',
    'migration.sql'
  );

  const schemaContents = await fs.readFile(schemaPath, 'utf8');
  const migrationLockContents = await fs.readFile(migrationLockPath, 'utf8');
  const datasourceProvider = extractDatasourceProvider(schemaContents);
  const migrationProviderMatch = migrationLockContents.match(/provider\s*=\s*"([^"]+)"/);
  const migrationProvider = migrationProviderMatch ? migrationProviderMatch[1] : null;

  let baselineMigrationPresent = false;
  try {
    await fs.stat(baselineMigrationPath);
    baselineMigrationPresent = true;
  } catch {
    baselineMigrationPresent = false;
  }

  const urlSummary = summarizeDatabaseUrl(databaseUrl);
  const redactedUrl = redactDatabaseUrl(databaseUrl);

  const prismaStatus = runCommand('npx', ['prisma', 'migrate', 'status', '--schema', 'apps/api/prisma/schema.prisma'], {
    cwd: repoRoot,
    env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined
  });

  const psqlChecks = [];
  if (databaseUrl) {
    const queries = [
      { label: 'Database + User', sql: "SELECT current_database(), current_user;" },
      { label: 'Server SSL Capability', sql: 'SHOW ssl;' },
      { label: 'Server Minimum SSL Protocol', sql: "SELECT current_setting('ssl_min_protocol_version', true);" },
      { label: 'Current Session TLS', sql: 'SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();' }
    ];

    for (const query of queries) {
      const result = runCommand('psql', ['-d', databaseUrl, '-At', '-c', query.sql], { cwd: repoRoot });
      psqlChecks.push({ label: query.label, sql: query.sql, ...result });
    }
  }

  const awsVersion = runCommand('aws', ['--version']);
  const awsIdentity = runCommand('aws', ['sts', 'get-caller-identity', '--output', 'json']);

  const awsInstance = dbInstanceId
    ? runCommand('aws', [
        'rds',
        'describe-db-instances',
        '--db-instance-identifier',
        dbInstanceId,
        '--query',
        'DBInstances[0].{DBInstanceIdentifier:DBInstanceIdentifier,Engine:Engine,EngineVersion:EngineVersion,StorageEncrypted:StorageEncrypted,KmsKeyId:KmsKeyId,PubliclyAccessible:PubliclyAccessible,CACertificateIdentifier:CACertificateIdentifier,DBParameterGroups:DBParameterGroups[*].DBParameterGroupName}',
        '--output',
        'json'
      ])
    : { ok: false, stdout: '', stderr: 'Not requested (no --db-instance-id provided).' };

  const awsCluster = dbClusterId
    ? runCommand('aws', [
        'rds',
        'describe-db-clusters',
        '--db-cluster-identifier',
        dbClusterId,
        '--query',
        'DBClusters[0].{DBClusterIdentifier:DBClusterIdentifier,Engine:Engine,EngineVersion:EngineVersion,StorageEncrypted:StorageEncrypted,KmsKeyId:KmsKeyId,DBClusterParameterGroup:DBClusterParameterGroup,DeletionProtection:DeletionProtection}',
        '--output',
        'json'
      ])
    : { ok: false, stdout: '', stderr: 'Not requested (no --db-cluster-id provided).' };

  const awsParamSections = [];
  const instanceJson = safeJsonParse(awsInstance.stdout);
  if (instanceJson?.DBParameterGroups?.length) {
    for (const groupName of instanceJson.DBParameterGroups) {
      const paramResult = runCommand('aws', [
        'rds',
        'describe-db-parameters',
        '--db-parameter-group-name',
        groupName,
        '--query',
        "Parameters[?ParameterName=='rds.force_ssl' || ParameterName=='ssl_min_protocol_version' || ParameterName=='ssl'].{ParameterName:ParameterName,ParameterValue:ParameterValue,Source:Source,ApplyType:ApplyType}",
        '--output',
        'json'
      ]);
      awsParamSections.push({ scope: `instance:${groupName}`, ...paramResult });
    }
  }

  const clusterJson = safeJsonParse(awsCluster.stdout);
  if (clusterJson?.DBClusterParameterGroup) {
    const clusterParamResult = runCommand('aws', [
      'rds',
      'describe-db-cluster-parameters',
      '--db-cluster-parameter-group-name',
      clusterJson.DBClusterParameterGroup,
      '--query',
      "Parameters[?ParameterName=='rds.force_ssl' || ParameterName=='ssl_min_protocol_version' || ParameterName=='ssl'].{ParameterName:ParameterName,ParameterValue:ParameterValue,Source:Source,ApplyType:ApplyType}",
      '--output',
      'json'
    ]);
    awsParamSections.push({ scope: `cluster:${clusterJson.DBClusterParameterGroup}`, ...clusterParamResult });
  }

  const lines = [];
  lines.push('# DB Security Evidence Bundle');
  lines.push('');
  lines.push(`- Generated: ${currentTimestamp()}`);
  lines.push(`- Environment Target: ${environment}`);
  lines.push(`- Output Path: \`${path.relative(repoRoot, outputPath)}\``);
  lines.push('');

  lines.push(...mdSection('Repository Baseline', [
    `- Prisma datasource provider: \`${datasourceProvider ?? 'UNKNOWN'}\``,
    `- Migration lock provider: \`${migrationProvider ?? 'UNKNOWN'}\``,
    `- Baseline migration present: \`${baselineMigrationPresent ? 'YES' : 'NO'}\` (\`apps/api/prisma/migrations/20260222141500_postgresql_baseline/migration.sql\`)`,
    `- Provider check: \`${datasourceProvider === 'postgresql' && migrationProvider === 'postgresql' ? 'PASS' : 'FAIL'}\``
  ]));

  lines.push(...mdSection('DATABASE_URL Policy Check', [
    `- DATABASE_URL present: \`${urlSummary.present ? 'YES' : 'NO'}\``,
    `- Redacted URL: \`${redactedUrl || '(unset)'}\``,
    `- Protocol: \`${urlSummary.protocol ?? 'N/A'}\``,
    `- Host: \`${urlSummary.host ?? 'N/A'}\``,
    `- Database: \`${urlSummary.database ?? 'N/A'}\``,
    `- sslmode: \`${urlSummary.sslmode ?? 'N/A'}\``,
    `- Protocol policy (\`postgresql://\` or \`postgres://\`): \`${urlSummary.protocolOk ? 'PASS' : 'FAIL'}\``,
    `- TLS policy (\`sslmode=require|verify-ca|verify-full\`): \`${urlSummary.sslmodeOk ? 'PASS' : 'FAIL'}\``
  ]));

  lines.push(...mdSection('Prisma Migration Status', [
    `- Command: \`npx prisma migrate status --schema apps/api/prisma/schema.prisma\``,
    '```text',
    prismaStatus.stdout || '(no stdout)',
    prismaStatus.stderr ? prismaStatus.stderr : '',
    '```',
    `- Result: \`${prismaStatus.ok ? 'PASS' : 'FAIL'}\``
  ]));

  const psqlSectionLines = [];
  if (!databaseUrl) {
    psqlSectionLines.push('- Skipped: DATABASE_URL not provided.');
  } else {
    for (const check of psqlChecks) {
      psqlSectionLines.push(`- ${check.label}: \`${evaluatePsqlCheck(check.label, check)}\``);
      psqlSectionLines.push('```text');
      psqlSectionLines.push(check.stdout || '(no stdout)');
      if (check.stderr) psqlSectionLines.push(check.stderr);
      psqlSectionLines.push('```');
    }
  }
  lines.push(...mdSection('PostgreSQL TLS Session Evidence', psqlSectionLines));

  lines.push(...mdSection('AWS/RDS Evidence', [
    `- aws cli: \`${awsVersion.ok ? 'available' : 'unavailable'}\``,
    '```text',
    awsVersion.stdout || awsVersion.stderr || '(no output)',
    '```',
    `- sts identity check: \`${awsIdentity.ok ? 'PASS' : 'FAIL'}\``,
    '```text',
    awsIdentity.stdout || awsIdentity.stderr || '(no output)',
    '```',
    `- db instance request (${dbInstanceId || 'not requested'}): \`${awsInstance.ok ? 'PASS' : 'SKIPPED/FAIL'}\``,
    '```text',
    awsInstance.stdout || awsInstance.stderr || '(no output)',
    '```',
    `- db cluster request (${dbClusterId || 'not requested'}): \`${awsCluster.ok ? 'PASS' : 'SKIPPED/FAIL'}\``,
    '```text',
    awsCluster.stdout || awsCluster.stderr || '(no output)',
    '```'
  ]));

  if (awsParamSections.length > 0) {
    const paramLines = [];
    for (const section of awsParamSections) {
      paramLines.push(`- Parameter group \`${section.scope}\`: \`${section.ok ? 'PASS' : 'FAIL'}\``);
      paramLines.push('```text');
      paramLines.push(section.stdout || section.stderr || '(no output)');
      paramLines.push('```');
    }
    lines.push(...mdSection('RDS Parameter Group TLS Settings', paramLines));
  }

  const gateReady =
    datasourceProvider === 'postgresql' &&
    migrationProvider === 'postgresql' &&
    baselineMigrationPresent &&
    urlSummary.protocolOk &&
    urlSummary.sslmodeOk &&
    prismaStatus.ok;

  lines.push(...mdSection('Summary', [
    `- Automated checks ready status: \`${gateReady ? 'PASS' : 'NEEDS FOLLOW-UP'}\``,
    '- To close Workstream #3 in staging/prod, include this file plus provider screenshots/console evidence of storage encryption and CA/TLS policy.'
  ]));

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${lines.join('\n').trimEnd()}\n`, 'utf8');

  console.log(`Evidence bundle generated: ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
