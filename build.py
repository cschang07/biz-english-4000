#!/usr/bin/env python3
"""合併 data/*.json → dist/data.json。

- 驗證每筆資料是否符合 SPEC.md 的格式
- 英文（不分大小寫、忽略多餘空白）重複者只保留第一筆
- 輸出各分類的字數統計

用法：
  python3 build.py                 # 有任何格式錯誤就不寫檔，結束碼 1
  python3 build.py --skip-invalid  # 略過錯誤資料，其餘照常輸出
  python3 build.py --dry-run       # 只檢查與統計，不寫檔
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# key: (中文名稱, 目標字數, id 前綴)
CATEGORIES = {
    "telecom": ("通訊電信", 900, "tel"),
    "network": ("網路與技術", 500, "net"),
    "customer": ("客戶溝通", 450, "cus"),
    "contract": ("合約法務", 400, "con"),
    "meeting": ("會議簡報", 400, "mtg"),
    "email": ("Email 與書信用語", 450, "eml"),
    "project": ("專案與營運", 400, "prj"),
    "finance": ("財務採購", 300, "fin"),
    "core": ("通用商務核心", 200, "cor"),
}
CAT_ORDER = {k: i for i, k in enumerate(CATEGORIES)}

REQUIRED_STR = ("id", "en", "pos", "zh", "example_en", "example_zh", "category")
OPTIONAL_STR = ("ipa", "note")
KNOWN_KEYS = set(REQUIRED_STR) | set(OPTIONAL_STR) | {"level"}
MAX_EXAMPLE_WORDS = 15

# 只列「台灣正體字不會用到」的簡體字，避免誤判（如 台、里、只、准、范 都不列入）
SIMPLIFIED = set(
    "网软络资讯质们这说时发会务产业电话号让关开来对过应实现进动价单报设备费码储账帐户签约议题项际统计"
    "门问间级员证认联线运营购销货财预结条规则层断节输传频载宽带无权处视览复杂术构损险赔偿责额汇总买卖"
    "两东车书长见观为与么没样头将专从众优华协卫历压县参双变启录数据体当经济导图环选择确须检测试错误记"
    "库续执订云并"
)
CJK = re.compile(r"[一-鿿]")


def norm_en(s: str) -> str:
    return " ".join(s.split()).casefold()


def natural_key(p: Path):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", p.name)]


def validate(e, where: str) -> tuple[list[str], list[str]]:
    errs: list[str] = []
    warns: list[str] = []
    if not isinstance(e, dict):
        return [f"{where}: 不是物件"], []

    for k in REQUIRED_STR:
        v = e.get(k)
        if not isinstance(v, str) or not v.strip():
            errs.append(f"{where}: 缺少或空白的欄位 {k!r}")
    for k in OPTIONAL_STR:
        if k in e and not isinstance(e[k], str):
            errs.append(f"{where}: 欄位 {k!r} 必須是字串")

    lv = e.get("level")
    if isinstance(lv, bool) or lv not in (1, 2, 3):
        errs.append(f"{where}: level 必須是 1、2 或 3（收到 {lv!r}）")

    cat = e.get("category")
    if isinstance(cat, str) and cat not in CATEGORIES:
        errs.append(f"{where}: 未知分類 {cat!r}")
    elif isinstance(cat, str) and isinstance(e.get("id"), str):
        prefix = CATEGORIES[cat][2]
        if not re.fullmatch(rf"{prefix}-\d{{4}}", e["id"]):
            errs.append(f"{where}: id {e['id']!r} 應為 {prefix}-0000 格式")

    for k in ("zh", "example_zh"):
        v = e.get(k)
        if isinstance(v, str) and v.strip():
            if not CJK.search(v):
                errs.append(f"{where}: {k} 沒有中文字")
            bad = sorted({ch for ch in v if ch in SIMPLIFIED})
            if bad:
                errs.append(f"{where}: {k} 含簡體字 {''.join(bad)}：{v}")

    ex = e.get("example_en")
    if isinstance(ex, str) and len(ex.split()) > MAX_EXAMPLE_WORDS:
        warns.append(f"{where}: example_en 超過 {MAX_EXAMPLE_WORDS} 字（{len(ex.split())}）")

    extra = set(e) - KNOWN_KEYS
    if extra:
        warns.append(f"{where}: 未定義的欄位 {sorted(extra)}（輸出時會移除）")
    return errs, warns


def clean(e: dict) -> dict:
    out = {}
    for k in ("id", "en", "pos", "zh", "ipa", "example_en", "example_zh", "category", "level", "note"):
        if k not in e:
            continue
        v = e[k]
        if isinstance(v, str):
            v = " ".join(v.split()) if k == "en" else v.strip()
            if k == "note" and not v:
                continue
        out[k] = v
    out.setdefault("ipa", "")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="合併 data/*.json 成 dist/data.json")
    ap.add_argument("--data-dir", default=ROOT / "data", type=Path)
    ap.add_argument("--out", default=ROOT / "dist" / "data.json", type=Path)
    ap.add_argument("--skip-invalid", action="store_true", help="略過格式錯誤的資料並照常輸出")
    ap.add_argument("--dry-run", action="store_true", help="只檢查，不寫檔")
    args = ap.parse_args()

    files = sorted(args.data_dir.glob("*.json"), key=natural_key)
    if not files:
        print(f"找不到任何 {args.data_dir}/*.json，未更動 {args.out}", file=sys.stderr)
        return 2

    errors: list[str] = []
    warnings: list[str] = []
    dupes: list[str] = []
    kept: list[dict] = []
    seen_en: dict[str, str] = {}
    seen_id: dict[str, str] = {}
    raw_total = 0

    for f in files:
        rel = f.relative_to(ROOT) if f.is_relative_to(ROOT) else f
        try:
            arr = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as ex:
            errors.append(f"{rel}: JSON 解析失敗：{ex}")
            continue
        if not isinstance(arr, list):
            errors.append(f"{rel}: 最外層必須是陣列")
            continue
        for i, e in enumerate(arr):
            raw_total += 1
            where = f"{rel}[{i}]" + (f" {e.get('id')}" if isinstance(e, dict) and e.get("id") else "")
            errs, warns = validate(e, where)
            warnings += warns
            if errs:
                errors += errs
                continue
            key = norm_en(e["en"])
            if key in seen_en:
                dupes.append(f"{where} {e['en']!r} 與 {seen_en[key]} 重複，已略過")
                continue
            if e["id"] in seen_id:
                errors.append(f"{where}: id 與 {seen_id[e['id']]} 重複")
                continue
            seen_en[key] = f"{e['id']}（{rel}）"
            seen_id[e["id"]] = f"{rel}"
            kept.append(clean(e))

    kept.sort(key=lambda e: (CAT_ORDER[e["category"]], e["id"]))

    # ---- 報告 ----
    print(f"讀取 {len(files)} 個檔案，共 {raw_total} 筆")
    if dupes:
        print(f"\n英文重複 {len(dupes)} 筆（保留先出現的那筆）：")
        for d in dupes:
            print(f"  - {d}")
    if warnings:
        print(f"\n警告 {len(warnings)} 則：")
        for w in warnings[:50]:
            print(f"  - {w}")
        if len(warnings) > 50:
            print(f"  …另有 {len(warnings) - 50} 則")
    if errors:
        print(f"\n錯誤 {len(errors)} 則：")
        for err in errors:
            print(f"  - {err}")

    def ljust_wide(s: str, width: int) -> str:  # 中文字佔兩格
        return s + " " * max(1, width - sum(2 if ord(c) > 0x2E80 else 1 for c in s))

    counts = {k: [0, 0, 0] for k in CATEGORIES}
    for e in kept:
        counts[e["category"]][e["level"] - 1] += 1
    w = 28
    print(f"\n{ljust_wide('分類', w)}字數 /  目標   達成    L1   L2   L3")
    total_target = 0
    for k, (zh, target, _) in CATEGORIES.items():
        n = sum(counts[k])
        total_target += target
        print(f"{ljust_wide(f'{k} {zh}', w)}{n:4d} / {target:5d}  {n / target:5.0%}  "
              f"{counts[k][0]:4d} {counts[k][1]:4d} {counts[k][2]:4d}")
    print(f"{ljust_wide('合計', w)}{len(kept):4d} / {total_target:5d}  {len(kept) / total_target:5.0%}")
    sys.stdout.flush()

    if errors and not args.skip_invalid:
        print(f"\n有格式錯誤，未寫入 {args.out}（可加 --skip-invalid 略過錯誤資料）", file=sys.stderr)
        return 1
    if args.dry_run:
        print("\n--dry-run：未寫檔")
        return 0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    body = ",\n".join("  " + json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in kept)
    args.out.write_text(f"[\n{body}\n]\n", encoding="utf-8")
    print(f"\n已寫入 {args.out}（{len(kept)} 筆）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
