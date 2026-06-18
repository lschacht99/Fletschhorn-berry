#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add a "Floor plans" section to Property.html, sourced from the WHF sales PDF.

- Renders the 3 floor plans (ground/first/second) + the Miralux detail.
- Saves web-optimised JPEGs to assets/floorplans/ (for uploading to Squarespace).
- Embeds them inline (base64) so the layouts show the moment the page is pasted,
  but every plan can be overridden with a Squarespace URL via window.FH_FLOORPLANS.
- Adds a window.FH_PROPERTY_IMAGES override hook for the bedroom photos.
- Does NOT touch bed counts, capacities, room specs, or any other page.

Idempotent: re-running replaces the previously injected block.
"""
import io, base64, os, re
import fitz
from PIL import Image, ImageChops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PDF = "/root/.claude/uploads/f9296013-b51b-5e5a-94dc-2c8ded46891a/db7c1775-WHF_Sales_Document_V10.0_2compressed.pdf"
PROP = os.path.join(ROOT, "Property.html")
FP_DIR = os.path.join(ROOT, "assets", "floorplans")

# name -> (0-indexed PDF page, output filename)
PLANS = [
    ("ground",  6, "ground-floor.jpg"),
    ("first",   9, "first-floor.jpg"),
    ("second", 11, "second-floor.jpg"),
    ("miralux", 7, "miralux-suite.jpg"),
]
TARGET_W = 1200
JPEG_Q = 78


def trim(im):
    bg = Image.new(im.mode, im.size, (255, 255, 255))
    bbox = ImageChops.difference(im, bg).getbbox()
    return im.crop(bbox) if bbox else im


def render(idx):
    doc = fitz.open(PDF)
    pix = doc[idx].get_pixmap(matrix=fitz.Matrix(3, 3))
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    im = trim(im)
    ratio = TARGET_W / im.width
    im = im.resize((TARGET_W, round(im.height * ratio)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=JPEG_Q, optimize=True)
    return buf.getvalue()


def main():
    os.makedirs(FP_DIR, exist_ok=True)
    datauris = {}
    for name, idx, fname in PLANS:
        data = render(idx)
        with open(os.path.join(FP_DIR, fname), "wb") as fh:
            fh.write(data)
        datauris[name] = "data:image/jpeg;base64," + base64.b64encode(data).decode()
        print(f"  {fname:20s} {len(data)//1024:4d}KB  (base64 {int(len(data)*1.34)//1024}KB)")

    subs = {
        "ground":  "Miralux Suite · rooms 27–29 · kitchen, bar &amp; restaurant",
        "first":   "Family suite · junior suites · double rooms · sauna &amp; gym",
        "second":  "Two-bedroom penthouse · 3-bedroom apartment with kitchen",
        "miralux": "Standalone suite · about 20&nbsp;m from the house · barrier-free",
    }
    figures = "\n".join(
        f'        <figure class="fh-fp-fig">'
        f'<img alt="{name.capitalize()} floor plan" data-fh-floorplan="{name}" loading="lazy" src="{datauris[name]}">'
        f'<figcaption><span class="fh-fp-name" data-fh-fp="{name}"></span>'
        f'<small>{subs[name]}</small></figcaption></figure>'
        for name, _, _ in PLANS
    )

    section = (
        '<!-- FH-FLOORPLANS:START  (added from WHF sales document) -->\n'
        '<style>\n'
        '#fh-property .fh-floorplans .fh-fp-grid{display:grid;gap:clamp(16px,2.5vw,26px);'
        'grid-template-columns:repeat(auto-fit,minmax(280px,1fr));}\n'
        '#fh-property .fh-fp-fig{margin:0;background:var(--paper,#fffaf2);'
        'border:1px solid var(--line,rgba(28,24,20,.14));border-radius:18px;overflow:hidden;'
        'box-shadow:var(--soft-shadow,0 12px 34px rgba(27,23,18,.08));}\n'
        '#fh-property .fh-fp-fig img{display:block;width:100%;height:auto;background:#f4ece2;cursor:zoom-in;}\n'
        '#fh-property .fh-fp-fig figcaption{padding:13px 16px 16px;}\n'
        '#fh-property .fh-fp-name{display:block;font:650 14px/1.25 var(--sans,system-ui);color:var(--ink,#1c1814);}\n'
        '#fh-property .fh-fp-fig figcaption small{display:block;margin-top:3px;'
        'font:500 12px/1.4 var(--sans,system-ui);color:var(--muted,rgba(28,24,20,.68));}\n'
        '#fh-property .fh-fp-lightbox{position:fixed;inset:0;z-index:9998;display:none;'
        'align-items:center;justify-content:center;background:rgba(15,12,9,.86);padding:20px;cursor:zoom-out;}\n'
        '#fh-property .fh-fp-lightbox.open{display:flex;}\n'
        '#fh-property .fh-fp-lightbox img{max-width:96vw;max-height:92vh;border-radius:10px;'
        'box-shadow:0 30px 80px rgba(0,0,0,.5);}\n'
        '</style>\n'
        '\n'
        '      <section class="fh-section alt fh-floorplans" id="property-floorplans">\n'
        '        <div class="fh-container fh-section-head fh-clean-head">\n'
        '          <div><p class="fh-kicker" data-fh-fp="kicker"></p><h2 data-fh-fp="title"></h2></div>\n'
        '          <p data-fh-fp="lead"></p>\n'
        '        </div>\n'
        '        <div class="fh-container fh-fp-grid">\n'
        + figures + '\n'
        '        </div>\n'
        '      </section>\n'
        '\n'
        '<script>\n'
        '(function(){\n'
        '  var root=document.getElementById("fh-property")||document;\n'
        '  /* ===== Optional: use your own Squarespace-hosted floor-plan images =====\n'
        '     Upload each plan in Squarespace, copy its URL, and paste it below.\n'
        '     Leave "" to keep the built-in image. */\n'
        '  window.FH_FLOORPLANS = window.FH_FLOORPLANS || { ground:"", first:"", second:"", miralux:"" };\n'
        '  Object.keys(window.FH_FLOORPLANS).forEach(function(k){\n'
        '    var u=window.FH_FLOORPLANS[k]; if(!u) return;\n'
        '    var img=root.querySelector(\'[data-fh-floorplan="\'+k+\'"]\'); if(img) img.src=u;\n'
        '  });\n'
        '  /* ===== Localised labels (self-contained; does not touch the page i18n) ===== */\n'
        '  var L={\n'
        '    en:{kicker:"The building",title:"Floor plans & room layout",lead:"See exactly where every bedroom sits within the chalet, floor by floor.",ground:"Ground floor",first:"First floor",second:"Second floor",miralux:"Miralux Suite \\u2014 direct access"},\n'
        '    fr:{kicker:"Le b\\u00e2timent",title:"Plans des \\u00e9tages & agencement",lead:"Voyez pr\\u00e9cis\\u00e9ment o\\u00f9 se situe chaque chambre dans le chalet, \\u00e9tage par \\u00e9tage.",ground:"Rez-de-chauss\\u00e9e",first:"Premier \\u00e9tage",second:"Deuxi\\u00e8me \\u00e9tage",miralux:"Suite Miralux \\u2014 acc\\u00e8s direct"},\n'
        '    de:{kicker:"Das Geb\\u00e4ude",title:"Etagenpl\\u00e4ne & Raumaufteilung",lead:"Sehen Sie genau, wo sich jedes Zimmer im Chalet befindet \\u2013 Etage f\\u00fcr Etage.",ground:"Erdgeschoss",first:"Erster Stock",second:"Zweiter Stock",miralux:"Miralux Suite \\u2014 Direktzugang"},\n'
        '    ru:{kicker:"\\u0417\\u0434\\u0430\\u043d\\u0438\\u0435",title:"\\u041f\\u043b\\u0430\\u043d\\u044b \\u044d\\u0442\\u0430\\u0436\\u0435\\u0439 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u043b\\u043e\\u0436\\u0435\\u043d\\u0438\\u0435",lead:"\\u041f\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440\\u0438\\u0442\\u0435, \\u0433\\u0434\\u0435 \\u0438\\u043c\\u0435\\u043d\\u043d\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u043b\\u043e\\u0436\\u0435\\u043d\\u0430 \\u043a\\u0430\\u0436\\u0434\\u0430\\u044f \\u0441\\u043f\\u0430\\u043b\\u044c\\u043d\\u044f, \\u044d\\u0442\\u0430\\u0436 \\u0437\\u0430 \\u044d\\u0442\\u0430\\u0436\\u043e\\u043c.",ground:"\\u041f\\u0435\\u0440\\u0432\\u044b\\u0439 \\u044d\\u0442\\u0430\\u0436",first:"\\u0412\\u0442\\u043e\\u0440\\u043e\\u0439 \\u044d\\u0442\\u0430\\u0436",second:"\\u0422\\u0440\\u0435\\u0442\\u0438\\u0439 \\u044d\\u0442\\u0430\\u0436",miralux:"\\u0421\\u044c\\u044e\\u0442 Miralux \\u2014 \\u043e\\u0442\\u0434\\u0435\\u043b\\u044c\\u043d\\u044b\\u0439 \\u0432\\u0445\\u043e\\u0434"},\n'
        '    he:{kicker:"\\u05d4\\u05d1\\u05e0\\u05d9\\u05d9\\u05df",title:"\\u05ea\\u05d5\\u05db\\u05e0\\u05d9\\u05d5\\u05ea \\u05e7\\u05d5\\u05de\\u05d5\\u05ea \\u05d5\\u05e4\\u05e8\\u05d9\\u05e1\\u05ea \\u05d7\\u05d3\\u05e8\\u05d9\\u05dd",lead:"\\u05e8\\u05d0\\u05d5 \\u05d1\\u05d3\\u05d9\\u05d5\\u05e7 \\u05d4\\u05d9\\u05db\\u05df \\u05de\\u05de\\u05d5\\u05e7\\u05dd \\u05db\\u05dc \\u05d7\\u05d3\\u05e8 \\u05e9\\u05d9\\u05e0\\u05d4 \\u05d1\\u05e9\\u05d0\\u05dc\\u05d4, \\u05e7\\u05d5\\u05de\\u05d4 \\u05d0\\u05d7\\u05e8 \\u05e7\\u05d5\\u05de\\u05d4.",ground:"\\u05e7\\u05d5\\u05de\\u05ea \\u05e7\\u05e8\\u05e7\\u05e2",first:"\\u05e7\\u05d5\\u05de\\u05d4 \\u05e8\\u05d0\\u05e9\\u05d5\\u05e0\\u05d4",second:"\\u05e7\\u05d5\\u05de\\u05d4 \\u05e9\\u05e0\\u05d9\\u05d9\\u05d4",miralux:"\\u05e1\\u05d5\\u05d5\\u05d9\\u05d8\\u05ea \\u05de\\u05d9\\u05e8\\u05dc\\u05d5\\u05e7\\u05e1 \\u2014 \\u05d2\\u05d9\\u05e9\\u05d4 \\u05d9\\u05e9\\u05d9\\u05e8\\u05d4"}\n'
        '  };\n'
        '  function curLang(){ return root.getAttribute("data-current-lang") || document.documentElement.lang || "en"; }\n'
        '  function apply(){ var d=L[curLang()]||L.en; root.querySelectorAll("[data-fh-fp]").forEach(function(el){ var k=el.getAttribute("data-fh-fp"); if(d[k]!=null) el.textContent=d[k]; }); }\n'
        '  apply();\n'
        '  try{ new MutationObserver(apply).observe(root,{attributes:true,attributeFilter:["data-current-lang"]}); }catch(e){}\n'
        '  /* ===== Click to enlarge (lightbox) ===== */\n'
        '  var lb=document.createElement("div"); lb.className="fh-fp-lightbox"; lb.innerHTML=\'<img alt="">\';\n'
        '  (root.querySelector("#property-floorplans")||document.body).appendChild(lb);\n'
        '  var lbImg=lb.querySelector("img");\n'
        '  root.querySelectorAll("[data-fh-floorplan]").forEach(function(img){ img.addEventListener("click",function(){ lbImg.src=img.src; lb.classList.add("open"); }); });\n'
        '  lb.addEventListener("click",function(){ lb.classList.remove("open"); });\n'
        '})();\n'
        '</script>\n'
        '<!-- FH-FLOORPLANS:END -->\n\n'
    )

    html = open(PROP, encoding="utf-8").read()

    # 1) remove any previous injection (idempotent)
    html = re.sub(r"<!-- FH-FLOORPLANS:START.*?FH-FLOORPLANS:END -->\n\n?", "", html, flags=re.S)

    # 2) insert the section right before the Spa section
    anchor = '      <section class="fh-section alt" id="property-spa">'
    assert anchor in html, "spa section anchor not found"
    html = html.replace(anchor, section + anchor, 1)

    # 3) add the bedroom-photo override hook at the top of the loader (idempotent)
    if "FH_PROPERTY_IMAGES" not in html:
        loader = "  async function loadWorkerImageAssets(){\n"
        assert loader in html, "loader anchor not found"
        override = (
            "  async function loadWorkerImageAssets(){\n"
            "    /* Squarespace override: set window.FH_PROPERTY_IMAGES = [\"https://images.squarespace-cdn.com/...\", ...]\n"
            "       (e.g. real bedroom photos uploaded to Squarespace) to use them instead of Guesty. */\n"
            "    if(Array.isArray(window.FH_PROPERTY_IMAGES) && window.FH_PROPERTY_IMAGES.length){\n"
            "      var urls=window.FH_PROPERTY_IMAGES.slice();\n"
            "      workerRandomUrls=urls; propertyUrls=rotateList(urls,0); insideUrls=rotateList(urls,3);\n"
            "      kitchenUrls=rotateList(urls,6); privateSaunaUrls=rotateList(urls,9); groupUrls=rotateList(urls,12);\n"
            "      exteriorUrls=rotateList(urls,15); mountainUrls=rotateList(urls,18); shuttleUrls=rotateList(urls,21).slice(0,Math.min(6,urls.length));\n"
            "      return true;\n"
            "    }\n"
        )
        html = html.replace(loader, override, 1)

    open(PROP, "w", encoding="utf-8").write(html)
    print("Property.html updated. New size:", len(html) // 1024, "KB")


if __name__ == "__main__":
    main()
