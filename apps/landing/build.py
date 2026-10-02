from pathlib import Path
import re
import shutil

# Public origin of the published page. WhatsApp previews need an absolute og:image.
SITE_URL = "https://racketbound.com/beirut"

root = Path(__file__).resolve().parent
repo = root.parents[1]
public = repo / "apps" / "dashboard" / "public" / "beirut"
original = (root / "original.html").read_text(encoding="utf-8")
ball = re.search(r'<symbol id="ball".*?</symbol>', original, re.S).group()
template = (root / "page-template.html").read_text(encoding="utf-8")
template = template.replace(
    "content:'✓';margin-right:7px",
    "content:'';width:6px;height:10px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin-right:10px;flex:none",
)
template = template.replace(
    ".actions .text-link{margin-top:8px}",
    ".actions .text-link{margin-top:8px;display:flex;width:fit-content}",
)
template = template.replace(
    ".sticky .button{min-height:48px;padding:12px 20px}",
    ".sticky .button{min-height:48px;padding:12px 20px;white-space:nowrap;flex:none}",
)
base = SITE_URL.rstrip("/")
template = template.replace(
    '<meta property="og:image" content="racketbound-og.jpg">',
    f'<meta property="og:url" content="{base}">\n<meta property="og:image" content="{base}/racketbound-og.jpg">',
)
page = template.replace("<!-- BALL -->", ball)
public.mkdir(parents=True, exist_ok=True)
(public / "index.html").write_text(page, encoding="utf-8")
for name in ("racketbound-hero.webp", "racketbound-og.jpg"):
    shutil.copyfile(root / name, public / name)
(root / "syntax-check.js").write_text(
    re.search(r"<script>(.*?)</script>", template, re.S).group(1),
    encoding="utf-8",
)
print(f"wrote {public / 'index.html'}")
