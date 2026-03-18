# TrustSignal Recommended Deployment Stack

This document describes the default TrustSignal deployment model for pilots and early production work.

## Default Platform Split

- GitHub: source control, pull requests, and GitHub Actions for CI only
- Vercel: primary hosting for the web app, public API routes, preview deployments, and lightweight scheduled triggers
- Supabase: PostgreSQL database and object storage

## Recommended Operating Model

TrustSignal should start with the smallest reliable platform surface:

- keep the application stateless in Vercel where possible
- persist receipt, audit, and workflow state in Supabase PostgreSQL
- use Supabase Storage only when object storage is actually needed
- use GitHub Actions for build, test, lint, and deploy workflows, not for runtime application logic

## What Not To Add By Default

Do not add a separate spooler, queue worker, or background service unless there is a concrete requirement that Vercel request/cron execution cannot satisfy.

That means:

- no dedicated worker fleet for normal verify/read/receipt flows
- no extra orchestration layer just to move data between Vercel and Supabase
- no direct GitHub Action access to Supabase production tables unless there is a specific admin workflow and documented credential boundary

## Background Work Rule

Use this decision rule:

1. If the work finishes within a normal API request budget, keep it in a Vercel API route.
2. If the work needs persistence, store state in Supabase and return promptly.
3. If the work must run on a schedule or retry in small batches, use a Vercel cron-triggered route first.
4. Only introduce a real queue or worker service after there is evidence that request-time or cron-time execution is insufficient.

## Why This Is The Default

This model reduces:

- infrastructure sprawl
- secret sprawl
- deployment drift
- operational overhead for pilot teams

It also keeps ownership clear:

- GitHub owns source and CI evidence
- Vercel owns runtime hosting and deployment
- Supabase owns durable data storage

## Current TrustSignal Guidance

For TrustSignal pilots, the preferred stack is:

- GitHub repository and GitHub Actions
- Vercel-hosted web and API surfaces
- Supabase-backed PostgreSQL with TLS enabled

Only add a separate worker platform if TrustSignal develops:

- long-running verification jobs
- heavy batch ingestion
- strict retry semantics that exceed Vercel cron patterns
- compute-heavy background processing that does not fit the request model

## Related Documentation

- [README.md](../README.md)
- [Documentation Index](README.md)
- [Architecture and Risk Boundaries](final/02_ARCHITECTURE_AND_BOUNDARIES.md)
- [Operations and Support](final/04_OPERATIONS_AND_SUPPORT.md)
