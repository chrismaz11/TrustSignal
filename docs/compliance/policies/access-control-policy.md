# TrustSignal Access Control Policy

> This public policy is intentionally high level. Operational access evidence and system-specific details must remain in private compliance systems.

## Purpose

Define how TrustSignal grants, reviews, and removes access to code, infrastructure, environments, and sensitive operational tooling.

## Scope

This policy applies to employees, contractors, service accounts, and third parties with access to TrustSignal-controlled systems, repositories, or security-relevant data.

## Responsibilities

- Engineering leadership approves role definitions and privileged access expectations.
- System owners approve access based on least privilege and business need.
- Administrators implement approved access changes and preserve evidence.
- Personnel with access protect credentials and report suspected misuse promptly.

## Control Procedures

1. Access is granted only after documented approval from an authorized owner.
2. Privileged access is limited to personnel with a demonstrated operational need.
3. Shared credentials are prohibited except where a managed service requires a documented break-glass account.
4. Access changes for joiners, movers, and leavers are completed within a defined operating window.
5. Access reviews are performed on a recurring basis and exceptions are tracked to remediation.
6. Repository, CI, and administrative settings should require strong authentication and human review for sensitive changes.

## Evidence

Evidence for this policy must be stored in Vanta, internal compliance storage, or a private audit repository rather than in this public repository.
