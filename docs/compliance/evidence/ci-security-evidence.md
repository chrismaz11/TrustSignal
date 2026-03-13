# TrustSignal CI Security Evidence Guide

This file is a placeholder only. Do not store exported CI logs, workflow run artifacts, or internal review records in the public repository.

Expected evidence:
- GitHub Actions run history for build, typecheck, and security workflows
- workflow definitions showing least-privilege permissions
- screenshots or exported records of required status checks
- evidence that failing checks block merges where intended
- change history for workflow updates

TrustSignal notes:
- current repository automation includes dependency review, Trivy, OpenSSF Scorecard, and zizmor
- store real workflow evidence in Vanta or approved internal compliance storage and keep this file limited to a pointer to that system of record
- do not paste raw workflow logs, internal approvals, or screenshots into this repository
