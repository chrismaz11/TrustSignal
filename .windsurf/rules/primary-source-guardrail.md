---
trigger: manual
---

# Primary Source Guardrail (Registry Adapters)

Apply this rule to any change in registry adapters, registry verification routes, and Vanta evidence payload mapping.

## Requirements

- Use primary authority domains first (official regulator/government endpoints). Do not prefer aggregator endpoints when an official source exists.
- If an aggregator is used (fallback or only source), set result status to `COMPLIANCE_GAP`, capture why the primary source was unavailable, and include remediation notes.
- Enforce secure request handling on each adapter call: required auth headers, explicit timeout, retry/backoff bounds, TLS verification, and endpoint-aware rate limiting.
- Vanta payloads must set `source_name` to the official regulator name (for example, `U.S. Treasury OFAC`, not aggregator/vendor branding).

## Review Checklist

- `source_url` domain is authoritative for the selected registry.
- Any non-authoritative source is explicitly marked `COMPLIANCE_GAP`.
- Adapter code includes secure headers and rate-limit controls.
- Vanta evidence `source_name` equals the regulator’s official name.
