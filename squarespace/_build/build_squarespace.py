#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fletschhorn — Squarespace build.

Turns the standalone prototype HTML documents (in the repo root) into
paste-ready Squarespace assets under ../  (the squarespace/ folder):

  global/1-custom-css.css            -> Design ▸ Custom CSS
  global/2-code-injection-header.html-> Settings ▸ Advanced ▸ Code Injection ▸ HEADER
  global/3-code-injection-footer.html-> Settings ▸ Advanced ▸ Code Injection ▸ FOOTER
  pages/<slug>.html                  -> per page: PASTE 1 (page header injection)
                                                  PASTE 2 (a Code block on the page)

Originals in the repo root are never modified. Re-runnable.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))          # repo root
OUT = os.path.abspath(os.path.join(HERE, ".."))                 # squarespace/
GLOBAL_DIR = os.path.join(OUT, "global")
PAGES_DIR = os.path.join(OUT, "pages")

# repo .html filename -> Squarespace URL slug (EDIT slugs to match your site)
SLUGS = {
    "index.html": "/",
    "Property.html": "/property",
    "Experiences.html": "/experiences",
    "Location.html": "/location",
    "Wedding-event.html": "/wedding-event",
    "About-us.html": "/about-us",
    "booking.html": "/booking",
    "checkout.html": "/checkout",
    "confirmation.html": "/confirmation",
}

# source file -> (output filename, human title)
PAGES = [
    ("index.html",         "home.html",          "Home"),
    ("Property.html",      "property.html",       "The Property"),
    ("Experiences.html",   "experiences.html",    "Experiences"),
    ("Location.html",      "location.html",       "Location"),
    ("Wedding-event.html", "wedding-event.html",  "Wedding & Events"),
    ("About-us.html",      "about-us.html",       "About Us"),
    ("booking.html",       "booking.html",        "Booking"),
    ("checkout.html",      "checkout.html",       "Checkout"),
    ("confirmation.html",  "confirmation.html",   "Confirmation"),
]

PRECONNECTS = """<!-- Performance: warm up the external hosts this site talks to.
     Safe to keep; remove a line if you stop using that host. -->
<link rel="preconnect" href="https://assets.guesty.com" crossorigin>
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
<link rel="preconnect" href="https://ik.imagekit.io" crossorigin>
<link rel="preconnect" href="https://cdn.saas-fee.ch" crossorigin>
<link rel="dns-prefetch" href="https://fletschhorn-guesty-api.bookings-e2d.workers.dev">
"""


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    return len(text)


def normalize_links(text):
    """Rewrite internal *.html links to Squarespace slugs.
    Three passes per file: absolute production URL, root-relative, bare."""
    for fname, slug in SLUGS.items():
        text = text.replace("https://www.fletschhorn.ch/" + fname,
                            "https://www.fletschhorn.ch" + slug)
        text = text.replace("/" + fname, slug)
        text = text.replace(fname, slug)
    return text


def must_replace(text, old, new, label):
    if old not in text:
        raise SystemExit("BUILD ERROR: expected snippet not found: " + label)
    return text.replace(old, new)


# ---------------------------------------------------------------------------
# 1) Custom CSS  (verbatim copy — no page links live in here)
# ---------------------------------------------------------------------------
def build_custom_css():
    css = read(os.path.join(ROOT, "assets", "fh-global.css"))
    banner = ("/* PASTE INTO: Squarespace ▸ Design ▸ Custom CSS\n"
              "   Source: assets/fh-global.css — site-wide shell styles. */\n\n")
    n = write(os.path.join(GLOBAL_DIR, "1-custom-css.css"), banner + css)
    print("  global/1-custom-css.css            %7d bytes" % n)


# ---------------------------------------------------------------------------
# 2) Header injection  (slug map + DOM-ready guard + preconnects)
# ---------------------------------------------------------------------------
def build_header():
    h = read(os.path.join(ROOT, "assets", "Header.html"))

    # (a) Replace GitHub-Pages base + page() helper with an editable slug map.
    old_base = (
        '  const FH_SITE_BASE = "https://lschacht99.github.io/Fletschhorn-berry/";\n'
        '\n'
        '  function page(file){\n'
        '    return FH_SITE_BASE + file.replace(/^\\/+/, "");\n'
        '  }\n'
        '\n'
        '  const bookingHref = page("booking.html");\n'
    )
    new_base = (
        '  /* ── Squarespace page URLs ─────────────────────────────────────────\n'
        '     EDIT each value to match the real URL slug of that Squarespace page.\n'
        '     Keep the leading "/". Home stays "/". ──────────────────────────── */\n'
        '  const FH_PAGES = {\n'
        '    home:        "/",\n'
        '    property:    "/property",\n'
        '    experiences: "/experiences",\n'
        '    location:    "/location",\n'
        '    events:      "/wedding-event",\n'
        '    about:       "/about-us",\n'
        '    booking:     "/booking"\n'
        '  };\n'
        '\n'
        '  function page(file){ return file; }  /* legacy shim, no longer used */\n'
        '\n'
        '  const bookingHref = FH_PAGES.booking;\n'
    )
    h = must_replace(h, old_base, new_base, "header FH_SITE_BASE block")

    for call, key in [
        ('href:page("index.html"),',         'href:FH_PAGES.home,'),
        ('href:page("Property.html"),',      'href:FH_PAGES.property,'),
        ('href:page("Experiences.html"),',   'href:FH_PAGES.experiences,'),
        ('href:page("Location.html"),',      'href:FH_PAGES.location,'),
        ('href:page("Wedding-event.html"),', 'href:FH_PAGES.events,'),
        ('href:page("About-us.html"),',      'href:FH_PAGES.about,'),
    ]:
        h = must_replace(h, call, key, "header nav href " + call)

    # (b) Defer the whole IIFE until the DOM exists (Header injection -> <head>).
    open_old = ('(function(){\n'
                '  if(document.getElementById("fhGlobalHeader")) return;\n')
    open_new = ('(function(){\n'
                '  /* Squarespace note: Code Injection ▸ Header lands in <head>, where\n'
                '     document.body does not exist yet. Defer boot until the DOM is ready. */\n'
                '  function fhBootGlobalHeader(){\n'
                '  if(document.getElementById("fhGlobalHeader")) return;\n')
    h = must_replace(h, open_old, open_new, "header IIFE open")

    close_old = "})();\n</script>"
    close_new = ("  }\n"
                 "  if(document.readyState===\"loading\"){\n"
                 "    document.addEventListener(\"DOMContentLoaded\", fhBootGlobalHeader);\n"
                 "  }else{\n"
                 "    fhBootGlobalHeader();\n"
                 "  }\n"
                 "})();\n</script>")
    h = must_replace(h, close_old, close_new, "header IIFE close")

    # (c) Belt-and-braces: normalise any stray .html link.
    h = normalize_links(h)

    banner = ("<!-- PASTE INTO: Squarespace ▸ Settings ▸ Advanced ▸ Code Injection ▸ HEADER\n"
              "     Source: assets/Header.html — site-wide nav, mobile menu, language\n"
              "     switch, footbar and booking toolbar. Edit FH_PAGES below to match\n"
              "     your page slugs. -->\n\n")
    out = banner + PRECONNECTS + "\n" + h
    n = write(os.path.join(GLOBAL_DIR, "2-code-injection-header.html"), out)
    print("  global/2-code-injection-header.html %7d bytes" % n)


# ---------------------------------------------------------------------------
# 3) Footer injection  (already DOM-ready guarded; just fix .html links)
# ---------------------------------------------------------------------------
def build_footer():
    f = read(os.path.join(ROOT, "assets", "footer.html"))
    f = normalize_links(f)
    banner = ("<!-- PASTE INTO: Squarespace ▸ Settings ▸ Advanced ▸ Code Injection ▸ FOOTER\n"
              "     Source: assets/footer.html — site-wide footer. Self-mounts on DOM\n"
              "     ready and hides the native Squarespace footer. -->\n\n")
    n = write(os.path.join(GLOBAL_DIR, "3-code-injection-footer.html"), banner + f)
    print("  global/3-code-injection-footer.html %7d bytes" % n)


# ---------------------------------------------------------------------------
# 4) Pages
# ---------------------------------------------------------------------------
STYLE_RE = re.compile(r"<style[^>]*>.*?</style>", re.S | re.I)
JSONLD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>.*?</script>', re.S | re.I)
SLOT_RE = re.compile(r'[ \t]*<div id="fh-(?:header|footer)-slot"></div>[ \t]*\n?', re.I)
DEAD_CSS_RE = re.compile(r'[ \t]*<link[^>]*assets/fh-global\.css[^>]*>[ \t]*\n?', re.I)
LOCAL_CSS_RE = re.compile(r'[ \t]*<link[^>]*href=["\'](assets/css/[^"\']+\.css)["\'][^>]*>[ \t]*\n?', re.I)
LOCAL_SCRIPT_RE = re.compile(r'[ \t]*<script([^>]*)\s+src=["\'](assets/js/[^"\']+\.js)["\']([^>]*)>\s*</script>[ \t]*\n?', re.I)
TITLE_RE = re.compile(r'[ \t]*<title>.*?</title>[ \t]*\n?', re.S | re.I)
VIEWPORT_RE = re.compile(r'[ \t]*<meta[^>]*name=["\']viewport["\'][^>]*>[ \t]*\n?', re.I)
SEO_TAG_RE = re.compile(
    r'<(?:link|meta)[^>]*'
    r'(?:rel=["\']canonical["\']|rel=["\']alternate["\']|property=["\']og:'
    r'|name=["\']twitter:|name=["\']description["\']|name=["\']robots["\'])'
    r'[^>]*>', re.I)


def build_page(src, out_name, title):
    raw = read(os.path.join(ROOT, src))
    raw = normalize_links(raw)

    head_m = re.search(r"<head[^>]*>(.*?)</head>", raw, re.S | re.I)
    body_m = re.search(r"<body[^>]*>(.*)</body>", raw, re.S | re.I)
    is_full_doc = bool(head_m and body_m)

    if is_full_doc:
        seo_source = head_m.group(1)            # SEO lives in <head>
        content = body_m.group(1)               # visible markup lives in <body>
        head_styles = "\n".join(s.strip() for s in STYLE_RE.findall(seo_source)).strip()
    else:
        seo_source = raw                        # fragment: SEO sits inline at top
        content = raw
        head_styles = ""                        # styles are already inline in content

    # --- SEO / structured data -> PASTE 1
    jsonld = JSONLD_RE.findall(seo_source)
    seo_tags = SEO_TAG_RE.findall(JSONLD_RE.sub("", seo_source))
    seo_parts = [t.strip() for t in seo_tags] + [s.strip() for s in jsonld]
    seo_section = "\n".join(seo_parts).strip()
    if not seo_section:
        seo_section = "<!-- (Set this page's SEO in the Squarespace SEO panel.) -->"

    # --- clean the Code block content
    content = DEAD_CSS_RE.sub("", content)      # dead link to assets/fh-global.css
    # Squarespace code blocks cannot rely on repo-relative asset paths. Keep the
    # existing page adaptation, but inline page-local CSS/JS assets that the
    # source document references directly (currently the property layout and
    # canonical booking toolbar helpers).
    def inline_local_css(match):
        rel = match.group(1)
        css = read(os.path.join(ROOT, rel))
        return "\n<style data-fh-inline-source=\"%s\">\n%s\n</style>\n" % (rel, css.strip())

    def inline_local_script(match):
        before, rel, after = match.groups()
        attrs = (before + " " + after).strip()
        attrs = re.sub(r'\s*\bdefer\b', '', attrs, flags=re.I).strip()
        attrs = (" " + attrs) if attrs else ""
        js = read(os.path.join(ROOT, rel))
        # Avoid prematurely closing the containing Squarespace code-block script
        # if documentation/comments contain a literal "</script>" string.
        js = js.replace("</script", "<\\/script")
        return "\n<script%s data-fh-inline-source=\"%s\">\n%s\n</script>\n" % (attrs, rel, js.strip())

    content = LOCAL_CSS_RE.sub(inline_local_css, content)
    content = LOCAL_SCRIPT_RE.sub(inline_local_script, content)
    content = SLOT_RE.sub("", content)          # prototype header/footer mount points
    if not is_full_doc:
        # fragment: SEO/title/viewport are inline at top -> strip the duplicates
        content = JSONLD_RE.sub("", content)
        for tag in seo_tags:
            content = content.replace(tag, "")
        content = TITLE_RE.sub("", content)
        content = VIEWPORT_RE.sub("", content)
    body_block = content.strip("\n")

    code_block = (head_styles + "\n\n" + body_block) if head_styles else body_block

    doc = (
        "<!-- ============================================================\n"
        "     FLETSCHHORN · %s  —  Squarespace paste guide\n"
        "     Source: %s   (see ../README.md)\n"
        "     This page has TWO paste targets:\n"
        "     ============================================================ -->\n\n\n"
        "<!-- ▌ PASTE 1  →  Page settings ▸ Advanced ▸ Page Header Code Injection\n"
        "     SEO meta + structured data. Optional: skip it and use the\n"
        "     Squarespace SEO panel instead. -->\n"
        "%s\n\n\n"
        "<!-- ▌ PASTE 2  →  Edit the page ▸ add a Code block ▸ paste EVERYTHING below.\n"
        "     (Header & footer come from the global Code Injection, not from here.) -->\n"
        "%s\n"
    ) % (title, src, seo_section, code_block)

    n = write(os.path.join(PAGES_DIR, out_name), doc)
    print("  pages/%-22s %7d bytes" % (out_name, n))


def main():
    os.makedirs(GLOBAL_DIR, exist_ok=True)
    os.makedirs(PAGES_DIR, exist_ok=True)
    print("Building Squarespace assets...")
    build_custom_css()
    build_header()
    build_footer()
    for src, out_name, title in PAGES:
        build_page(src, out_name, title)
    print("Done.")


if __name__ == "__main__":
    main()
