from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
import textwrap

OUT = 'output/pdf/trustsignal_app_summary_onepager.pdf'

PAGE_W, PAGE_H = LETTER
MARGIN = 42
CONTENT_W = PAGE_W - 2 * MARGIN

c = canvas.Canvas(OUT, pagesize=LETTER)

# Typography
TITLE_SIZE = 17
H_SIZE = 12
BODY_SIZE = 9
SMALL_SIZE = 8
LINE = 11

# Helpers
x = MARGIN
y = PAGE_H - MARGIN

def ensure_space(lines_needed=1):
    global y
    if y - lines_needed * LINE < MARGIN:
        raise RuntimeError('Content overflowed one page')

def draw_title(text):
    global y
    c.setFont('Helvetica-Bold', TITLE_SIZE)
    c.setFillColor(colors.HexColor('#0F172A'))
    c.drawString(x, y, text)
    y -= 16


def draw_sub(text):
    global y
    c.setFont('Helvetica', SMALL_SIZE)
    c.setFillColor(colors.HexColor('#334155'))
    c.drawString(x, y, text)
    y -= 12


def draw_heading(text):
    global y
    ensure_space(2)
    c.setStrokeColor(colors.HexColor('#CBD5E1'))
    c.setLineWidth(0.8)
    c.line(x, y + 3, x + CONTENT_W, y + 3)
    c.setFont('Helvetica-Bold', H_SIZE)
    c.setFillColor(colors.HexColor('#0F172A'))
    c.drawString(x, y - 9, text)
    y -= 22


def draw_paragraph(text, font='Helvetica', size=BODY_SIZE, indent=0):
    global y
    c.setFont(font, size)
    c.setFillColor(colors.black)
    wrap_w = max(30, int((CONTENT_W - indent) / (size * 0.53)))
    lines = textwrap.wrap(text, width=wrap_w)
    ensure_space(max(1, len(lines)))
    for ln in lines:
        c.drawString(x + indent, y, ln)
        y -= LINE


def draw_bullet(text):
    global y
    c.setFont('Helvetica', BODY_SIZE)
    c.setFillColor(colors.black)
    wrap_w = max(30, int((CONTENT_W - 18) / (BODY_SIZE * 0.53)))
    lines = textwrap.wrap(text, width=wrap_w)
    ensure_space(max(1, len(lines)))
    c.drawString(x + 2, y, '-')
    c.drawString(x + 12, y, lines[0])
    y -= LINE
    for ln in lines[1:]:
        c.drawString(x + 12, y, ln)
        y -= LINE


draw_title('TrustSignal App Summary (Repo Evidence)')
draw_sub('Generated from repository files on 2026-02-27. Scope: TrustSignal/Deed Shield monorepo.')

# What it is

draw_heading('What It Is')
draw_paragraph(
    'TrustSignal is a verification platform, with Deed Shield as the property-records module for pre-recording deed workflows. '
    'It validates notarized bundle signals, issues ALLOW/FLAG/BLOCK receipts with cryptographic hashes, and can anchor receipt hashes on EVM.'
)

# Who it's for

draw_heading("Who It's For")
draw_paragraph(
    'Primary persona: title-company and lender pilot operators running deed verification workflows. '
    'Repo role models also include notary, title_company, and county_recorder users.'
)

# What it does

draw_heading('What It Does')
features = [
    'Accepts synthetic verification bundles and deed-derived metadata via web and API workflows.',
    'Validates payloads at API boundaries using strict schemas (zod) before processing.',
    'Checks RON provider status, notary authority windows, and cryptographic seal signatures against a trust registry.',
    'Runs county/property checks, including ATTOM Cook County cross-check reporting with confidence scoring.',
    'Builds canonical verification receipts (decision, checks, reasons, riskScore), stores them with Prisma/PostgreSQL, and supports listing/retrieval.',
    'Provides receipt lifecycle actions: integrity re-verify, revocation (signed headers), and PDF receipt download.',
    'Anchors receipt hashes on an EVM AnchorRegistry contract and exposes health/status/metrics endpoints for operations.'
]
for item in features:
    draw_bullet(item)

# How it works

draw_heading('How It Works (Architecture Overview)')
arch = [
    'UI: Next.js app (`apps/web`) with file dropzone/OCR extraction and operator verification screens.',
    'API: Fastify service (`apps/api`) implementing `/api/v1/*` verification, receipt, anchor, revoke, status, and metrics endpoints plus auth/rate-limit/CORS controls.',
    'Verification engine: `packages/core` for canonicalization, hashing, receipt composition, policy/risk logic, ATTOM cross-check helpers, and registry verification.',
    'Data: Prisma models persist receipts, notary/property/county records in PostgreSQL (`apps/api/prisma/schema.prisma`).',
    'External dependencies: ATTOM property API for cross-checks and EVM RPC + AnchorRegistry contract for anchoring.',
    'Flow: Upload/enter data in web -> API validates and verifies via core + data providers -> receipt persisted -> optional anchor -> receipt/PDF/verification fetched by UI.'
]
for item in arch:
    draw_bullet(item)

# How to run

draw_heading('How To Run (Minimal)')
steps = [
    'Install dependencies: `npm install`',
    'Prepare API schema/client: `npm -w apps/api run db:generate` then `npm -w apps/api run db:push`',
    'Start API (Terminal 1): `npm -w apps/api run dev` (default `http://localhost:3001`)',
    'Start Web (Terminal 2): `npm -w apps/web run dev` (default `http://localhost:3000`)',
    'Set local env placeholders from `.env.example` before non-default auth/anchor integrations.',
    'One-command bootstrap/setup script: Not found in repo.'
]
for s in steps:
    draw_bullet(s)

# Evidence footer
ensure_space(2)
y -= 2
c.setFont('Helvetica-Oblique', SMALL_SIZE)
c.setFillColor(colors.HexColor('#475569'))
footer = (
    'Evidence files: README.md, PROJECT_PLAN.md, USER_MANUAL.md, docs/final/01_EXECUTIVE_SUMMARY.md, '
    'docs/final/02_ARCHITECTURE_AND_BOUNDARIES.md, docs/verification.md, apps/api/src/server.ts, '
    'apps/api/src/security.ts, apps/api/prisma/schema.prisma, apps/web/src/app/*.tsx.'
)
for line in textwrap.wrap(footer, width=130):
    c.drawString(x, y, line)
    y -= 9

c.save()
print(OUT)
