# Free Primary-Source Registry Expansion Catalog (Beyond MVP10)

Scope: additional no-cost primary sources to evaluate after current MVP coverage (`ofac_*`, `hhs_oig_leie`, `sam_exclusions`, `uk_sanctions_list`, `bis_*`, `us_csl_consolidated`, `nppes_npi_registry`, `sec_edgar_company_tickers`, `fdic_bankfind_institutions`, `openfema_nfip_community`, `gleif_lei_records`, `un_sc_consolidated`, `irs_eo_bmf`).

Legend:
- `Integration mode`: `API-first`, `Bulk-download`, `Manual/portal`
- `Adapter complexity`: `S` (simple parser/query), `M` (moderate transform/rate-limit/state handling), `L` (multi-file joins, large payloads, or brittle portal flow)

## Current wave status (2026-04-28)

- [x] `openfema_nfip_community` adapter implemented in `apps/api/src/services/registryAdapters.ts` (`openfema-json-v1`).
- [x] `gleif_lei_records` adapter implemented in `apps/api/src/services/registryAdapters.ts` (`gleif-json-v1`).
- [x] `un_sc_consolidated` adapter implemented in `apps/api/src/services/registryAdapters.ts` (`un-sc-xml-v1`). Regex-based XML parser for UN SC individual and entity entries including aliases.
- [x] `irs_eo_bmf` adapter implemented in `apps/api/src/services/registryAdapters.ts` (`irs-eo-bmf-csv-v1`). Pipe-delimited EO BMF bulk file; extracts organization names.
- [x] Route and adapter test coverage updated in `apps/api/src/registry-adapters.test.ts`.
- [x] Notebook evidence log added: `notebooks/registry-wave1-primary-source-expansion-2026-03-07.ipynb`.
- [ ] Next implementation queue:
  1. NYC ACRIS endpoints (`master`, `legals`, `parties`) as a combined property-record adapter path.
  2. Global Affairs Canada consolidated autonomous sanctions XML.
  3. Australian DFAT consolidated sanctions list (XLSX).

| Official source name | Base domain / API endpoint | Category | Auth model | Integration mode | Adapter complexity |
|---|---|---|---|---|---|
| United Nations Security Council Consolidated List | `https://scsanctions.un.org/resources/xml/en/consolidated.xml` | sanctions/KYC | None | Bulk-download | S |
| Global Affairs Canada - Consolidated Canadian Autonomous Sanctions List | `https://www.international.gc.ca/world-monde/assets/office_docs/international_relations-relations_internationales/sanctions/sema-lmes.xml` | sanctions/KYC | None | Bulk-download | S |
| Australian DFAT - Consolidated Sanctions List | `https://www.dfat.gov.au/sites/default/files/Australian_Sanctions_Consolidated_List.xlsx` | sanctions/KYC | None | Bulk-download | M |
| Switzerland SECO - Full Sanctions XML List | `https://www.sesam.search.admin.ch/sesam-search-web/pages/downloadXmlGesamtliste.xhtml?action=downloadXmlGesamtlisteAction&lang=en` | sanctions/KYC | None | Bulk-download | M |
| European Commission - EU Financial Sanctions Consolidated Dataset | `https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions?locale=en` | sanctions/KYC | None (public dataset) | Bulk-download | M |
| New Zealand MFAT - Russia Sanctions Register | `https://www.mfat.govt.nz/en/countries-and-regions/europe/ukraine/russian-invasion-of-ukraine/sanctions/russia-sanctions-register` | sanctions/KYC | None | Manual/portal | M |
| World Bank - Listing of Ineligible Firms and Individuals | `https://www.worldbank.org/en/projects-operations/procurement/debarred-firms` | sanctions/KYC | None | Manual/portal | M |
| CMS - NPPES Data Dissemination Files (full/weekly/deactivation) | `https://download.cms.gov/nppes/NPI_Files.html` | healthcare PSV anchors | None | Bulk-download | L |
| CMS - Provider Data Catalog (Doctors and Clinicians data assets) | `https://data.cms.gov/provider-data/` | healthcare PSV anchors | None | API-first | M |
| CMS - Open Payments public data | `https://openpaymentsdata.cms.gov/` | healthcare PSV anchors | None | Manual/portal | M |
| Texas Medical Board - License / Physician Profile verification | `https://profile.tmb.state.tx.us/` | healthcare PSV anchors | None | Manual/portal | M |
| California Department of Consumer Affairs - License Search | `https://search.dca.ca.gov/` | healthcare PSV anchors | None | Manual/portal | M |
| New York State Education Department, Office of the Professions - Online Verification | `https://www.op.nysed.gov/verification-search` | healthcare PSV anchors | None | Manual/portal | M |
| Bureau of Land Management - General Land Office Records | `https://glorecords.blm.gov/` | real estate/public records | None | Manual/portal | M |
| NYC Department of Finance - ACRIS Real Property Master | `https://data.cityofnewyork.us/resource/bnx9-e6tj.json` | real estate/public records | None (app token optional) | API-first | M |
| NYC Department of Finance - ACRIS Real Property Legals | `https://data.cityofnewyork.us/resource/8h5j-fqxa.json` | real estate/public records | None (app token optional) | API-first | M |
| NYC Department of Finance - ACRIS Real Property Parties | `https://data.cityofnewyork.us/resource/636b-3b5g.json` | real estate/public records | None (app token optional) | API-first | M |
| FEMA OpenFEMA - NFIP Community Layer Comprehensive | `https://www.fema.gov/api/open/v1/NfipCommunityLayerComprehensive` | real estate/public records | None | API-first | S |
| GLEIF - LEI API (Global LEI Index data) | `https://api.gleif.org/api/v1/lei-records` | business identity | None | API-first | M |
| GLEIF - Golden Copy / Delta File distribution | `https://www.gleif.org/en/lei-data/gleif-golden-copy-and-delta-files` | business identity | None | Bulk-download | M |
| UK Companies House - REST API | `https://api.companieshouse.gov.uk/` | business identity | API key (HTTP Basic) | API-first | M |
| UK Companies House - Streaming API | `https://stream.companieshouse.gov.uk/` | business identity | Stream key | API-first | M |
| IRS - Exempt Organizations Business Master File Extract (EO BMF) | `https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf` | business identity | None | Bulk-download | M |
| IRS - Tax Exempt Organization Search (TEOS) bulk datasets | `https://www.irs.gov/charities-non-profits/tax-exempt-organization-search-bulk-data-downloads` | business identity | None | Bulk-download | M |
| California Secretary of State - bizfile Business Search | `https://bizfileonline.sos.ca.gov/search/business` | business identity | None | Manual/portal | M |
| New York Department of State - Corporation & Business Entity Search | `https://dos.ny.gov/corporation-and-business-entity-search-database` | business identity | None | Manual/portal | M |
| Delaware Division of Corporations - Entity Search | `https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx` | business identity | None (captcha possible) | Manual/portal | M |
| European Commission TAXUD - VIES VAT validation service | `https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl` | business identity | None | API-first | M |

## Suggested near-term sequencing

1. `API-first` + `S/M` complexity first: UN XML, OpenFEMA NFIP, NYC ACRIS endpoints, GLEIF API.
2. `Bulk-download` pipelines second: Canada XML, IRS/EO BMF, DFAT XLSX, SECO XML.
3. `Manual/portal` integrations last (or as compliance-gap fallbacks) due automation fragility and ToS variability.

## Notes and guardrails

- All entries are primary-source publishers (government/regulator or designated official operator) and intentionally exclude third-party aggregators.
- Several portal-only sources may require controlled scraping approvals, robots/ToS review, and cached evidence capture instead of high-frequency lookups.
- UK sanctions implementation changed on **2026-01-28** to a single UK Sanctions List source; treat legacy OFSI consolidated endpoints as historical-only.
