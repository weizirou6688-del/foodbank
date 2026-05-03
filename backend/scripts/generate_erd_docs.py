from __future__ import annotations

import argparse
import shutil
import subprocess
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import sqlalchemy as sa

from _bootstrap import ensure_backend_on_path

ensure_backend_on_path()

from app.models import Base  # noqa: E402


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
GENERATED_DIR = REPO_ROOT / "docs" / "generated"

FULL_OUTPUT = GENERATED_DIR / "current_database_erd_full.mmd"
FULL_SVG_OUTPUT = GENERATED_DIR / "current_database_erd_full.svg"
FULL_PNG_OUTPUT = GENERATED_DIR / "current_database_erd_full.png"

REPORT_MD_OUTPUT = GENERATED_DIR / "current_database_erd_report.md"
REPORT_MMD_OUTPUT = GENERATED_DIR / "current_database_erd_report.mmd"
REPORT_SVG_OUTPUT = GENERATED_DIR / "current_database_erd_report.svg"
REPORT_PNG_OUTPUT = GENERATED_DIR / "current_database_erd_report.png"

KEYS_ONLY_OUTPUT = GENERATED_DIR / "current_database_erd_keys_only.md"


THEME_BLOCK = """%%{{init: {{
  "theme": "neutral",
  "themeVariables": {{
    "fontFamily": "Times New Roman, Georgia, serif",
    "background": "#ffffff",
    "primaryColor": "{primary_color}",
    "primaryBorderColor": "{border_color}",
    "primaryTextColor": "#1f2a24",
    "lineColor": "{line_color}",
    "tertiaryColor": "{tertiary_color}"
  }}
}}}}%%"""


FULL_THEME = THEME_BLOCK.format(
    primary_color="#f7f4ee",
    border_color="#53665a",
    line_color="#53665a",
    tertiary_color="#edf2ec",
)

REPORT_THEME = THEME_BLOCK.format(
    primary_color="#f6f2e9",
    border_color="#556b5d",
    line_color="#556b5d",
    tertiary_color="#eef3ea",
)


FULL_TABLE_ORDER = [
    "alembic_version",
    "users",
    "food_banks",
    "inventory_items",
    "donations_cash",
    "food_packages",
    "applications",
    "donations_goods",
    "package_items",
    "application_items",
    "donation_goods_items",
    "restock_requests",
    "inventory_lots",
    "application_distribution_snapshots",
    "inventory_waste_events",
    "password_reset_tokens",
]


FULL_REQUIRED_RELATIONS = {
    ("applications", "application_items", "application_id"),
    ("donations_goods", "donation_goods_items", "donation_id"),
}


REPORT_OMITTED_TABLES = [
    "alembic_version",
    "password_reset_tokens",
    "restock_requests",
    "inventory_waste_events",
    "application_distribution_snapshots",
]


@dataclass(frozen=True)
class ReportEntity:
    name: str
    table_name: str
    columns: tuple[str, ...]


REPORT_ENTITIES = [
    ReportEntity("FOOD_BANK", "food_banks", ("id", "name", "address", "notification_email")),
    ReportEntity("USER", "users", ("id", "name", "email", "role", "food_bank_id")),
    ReportEntity(
        "INVENTORY_ITEM",
        "inventory_items",
        ("id", "name", "category", "unit", "threshold", "food_bank_id"),
    ),
    ReportEntity(
        "INVENTORY_LOT",
        "inventory_lots",
        ("id", "inventory_item_id", "quantity", "received_date", "expiry_date"),
    ),
    ReportEntity(
        "FOOD_PACKAGE",
        "food_packages",
        ("id", "name", "category", "stock", "threshold", "food_bank_id", "is_active"),
    ),
    ReportEntity(
        "PACKAGE_ITEM",
        "package_items",
        ("id", "package_id", "inventory_item_id", "quantity"),
    ),
    ReportEntity(
        "APPLICATION",
        "applications",
        ("id", "user_id", "food_bank_id", "redemption_code", "status", "week_start"),
    ),
    ReportEntity(
        "APPLICATION_ITEM",
        "application_items",
        ("id", "application_id", "package_id", "inventory_item_id", "quantity"),
    ),
    ReportEntity(
        "DONATION_CASH",
        "donations_cash",
        ("id", "donor_email", "amount_pence", "donation_frequency", "food_bank_id"),
    ),
    ReportEntity(
        "DONATION_GOODS",
        "donations_goods",
        ("id", "donor_user_id", "food_bank_id", "donor_name", "pickup_date", "status"),
    ),
    ReportEntity(
        "DONATION_GOODS_ITEM",
        "donation_goods_items",
        ("id", "donation_id", "item_name", "quantity", "expiry_date"),
    ),
]


REPORT_RELATIONSHIPS = [
    "FOOD_BANK ||--o{ USER : has",
    "FOOD_BANK ||--o{ INVENTORY_ITEM : manages",
    "INVENTORY_ITEM ||--o{ INVENTORY_LOT : stored_as",
    "",
    "FOOD_BANK ||--o{ FOOD_PACKAGE : offers",
    "FOOD_PACKAGE ||--o{ PACKAGE_ITEM : contains",
    "INVENTORY_ITEM ||--o{ PACKAGE_ITEM : used_in",
    "",
    "USER ||--o{ APPLICATION : submits",
    "FOOD_BANK ||--o{ APPLICATION : receives",
    "APPLICATION ||--|{ APPLICATION_ITEM : contains",
    "FOOD_PACKAGE o|--o{ APPLICATION_ITEM : package_option",
    "INVENTORY_ITEM o|--o{ APPLICATION_ITEM : item_option",
    "",
    "FOOD_BANK ||--o{ DONATION_CASH : receives",
    "FOOD_BANK ||--o{ DONATION_GOODS : receives",
    "USER o|--o{ DONATION_GOODS : submits",
    "DONATION_GOODS ||--|{ DONATION_GOODS_ITEM : contains",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate full and report-focused Mermaid ERD assets from SQLAlchemy metadata.",
    )
    parser.add_argument(
        "--render",
        action="store_true",
        help="Also render SVG and PNG artefacts with Mermaid CLI via npx.",
    )
    return parser.parse_args()


def camel_to_mermaid_name(table_name: str) -> str:
    return table_name.upper()


def type_name(column: sa.Column[object], *, logical: bool) -> str:
    column_type = column.type

    if isinstance(column_type, sa.DateTime):
        return "datetime" if logical else ("timestamptz" if column_type.timezone else "timestamp")
    if isinstance(column_type, sa.Date):
        return "date"
    if isinstance(column_type, sa.Boolean):
        return "bool"
    if isinstance(column_type, sa.Integer):
        return "int" if logical else "int"
    if isinstance(column_type, sa.Numeric):
        return "decimal" if logical else "numeric"
    if isinstance(column_type, sa.Text):
        return "string" if logical else "text"
    if isinstance(column_type, sa.String):
        return "string" if logical else "varchar"

    class_name = column_type.__class__.__name__.lower()
    if "uuid" in class_name:
        return "uuid"

    return class_name


def column_flags(column: sa.Column[object]) -> str:
    flags: list[str] = []
    if column.primary_key:
        flags.append("PK")
    if column.foreign_keys:
        flags.append("FK")
    return f" {' '.join(flags)}" if flags else ""


def relation_left_marker(column: sa.Column[object]) -> str:
    return "o|" if column.nullable else "||"


def relation_right_marker(parent_table: str, child_table: str, child_column: str) -> str:
    relation_key = (parent_table, child_table, child_column)
    return "|{" if relation_key in FULL_REQUIRED_RELATIONS else "o{"


def iter_tables_in_order() -> list[sa.Table]:
    metadata = Base.metadata
    ordered: list[sa.Table] = []
    seen: set[str] = set()

    for table_name in FULL_TABLE_ORDER:
        if table_name in metadata.tables:
            ordered.append(metadata.tables[table_name])
            seen.add(table_name)

    for table_name in sorted(metadata.tables):
        if table_name not in seen:
            ordered.append(metadata.tables[table_name])

    return ordered


def render_entity_block(
    *,
    entity_name: str,
    table: sa.Table,
    column_names: tuple[str, ...] | None,
    logical: bool,
) -> list[str]:
    lines = [f"    {entity_name} {{"]
    if column_names is None:
        columns = list(table.columns)
    else:
        columns = [table.columns[name] for name in column_names]

    for column in columns:
        lines.append(
            f"        {type_name(column, logical=logical)} {column.name}{column_flags(column)}"
        )
    lines.append("    }")
    return lines


def render_full_mmd() -> str:
    lines: list[str] = [FULL_THEME, "erDiagram"]
    lines.append("")

    for table in iter_tables_in_order():
        lines.extend(
            render_entity_block(
                entity_name=camel_to_mermaid_name(table.name),
                table=table,
                column_names=None,
                logical=False,
            )
        )
        lines.append("")

    rendered_relations: set[tuple[str, str, str, str]] = set()
    for table in iter_tables_in_order():
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                parent_table = foreign_key.column.table.name
                key = (
                    parent_table,
                    table.name,
                    foreign_key.column.name,
                    column.name,
                )
                if key in rendered_relations:
                    continue
                rendered_relations.add(key)
                lines.append(
                    "    "
                    f"{camel_to_mermaid_name(parent_table)} "
                    f"{relation_left_marker(column)}--{relation_right_marker(parent_table, table.name, column.name)} "
                    f"{camel_to_mermaid_name(table.name)} : {column.name}"
                )

    return "\n".join(lines).rstrip() + "\n"


def render_report_mmd() -> str:
    metadata = Base.metadata
    lines: list[str] = [REPORT_THEME, "erDiagram"]
    lines.append("")

    for entity in REPORT_ENTITIES:
        table = metadata.tables[entity.table_name]
        lines.extend(
            render_entity_block(
                entity_name=entity.name,
                table=table,
                column_names=entity.columns,
                logical=True,
            )
        )
        lines.append("")

    lines.extend(f"    {relation}" if relation else "" for relation in REPORT_RELATIONSHIPS)
    return "\n".join(lines).rstrip() + "\n"


def render_report_md(rendered_mmd: str) -> str:
    generated_on = date.today().isoformat()
    omitted = ", ".join(f"`{name}`" for name in REPORT_OMITTED_TABLES)
    return (
        "# Current Database ERD Report Version\n\n"
        f"This report-focused ERD was generated from the current SQLAlchemy model metadata on {generated_on}.\n\n"
        "- It keeps the main entities needed to explain the support request, inventory/package, and donation flows in the report body.\n"
        f"- It omits migration, security-token, audit, and operational support tables to keep the main diagram readable: {omitted}.\n"
        "- For the full physical schema, use `current_database_erd_full.mmd` and `current_database_erd.dbml` in the same folder.\n\n"
        "```mermaid\n"
        f"{rendered_mmd.rstrip()}\n"
        "```\n"
    )


def render_keys_only_md() -> str:
    sections = [
        "# Current Database ERD Keys Only",
        "",
        "Copyable keys-only content derived from the current SQLAlchemy metadata.",
        "",
    ]

    for table in iter_tables_in_order():
        sections.append(f"## {table.name}")
        primary_keys = [column for column in table.columns if column.primary_key]
        foreign_keys = [column for column in table.columns if column.foreign_keys]

        for column in primary_keys:
            sections.append(f"- PK: {column.name} ({type_name(column, logical=False)})")

        for column in foreign_keys:
            for foreign_key in column.foreign_keys:
                sections.append(
                    "- FK: "
                    f"{column.name} ({type_name(column, logical=False)}) -> "
                    f"{foreign_key.column.table.name}.{foreign_key.column.name}"
                )

        sections.append("")

    sections.append("## Relationships")
    seen_relations: set[tuple[str, str, str, str]] = set()
    for table in iter_tables_in_order():
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                key = (
                    table.name,
                    column.name,
                    foreign_key.column.table.name,
                    foreign_key.column.name,
                )
                if key in seen_relations:
                    continue
                seen_relations.add(key)
                sections.append(
                    f"- {table.name}.{column.name} -> "
                    f"{foreign_key.column.table.name}.{foreign_key.column.name}"
                )

    return "\n".join(sections).rstrip() + "\n"


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def render_mermaid(input_path: Path, output_path: Path) -> None:
    npx_path = shutil.which("npx")
    if npx_path is None:
        raise RuntimeError("Unable to render ERD assets because `npx` is not available on PATH.")

    subprocess.run(
        [
            npx_path,
            "-y",
            "@mermaid-js/mermaid-cli",
            "-i",
            str(input_path),
            "-o",
            str(output_path),
            "-b",
            "white",
            "-s",
            "2",
        ],
        check=True,
        cwd=REPO_ROOT,
    )


def main() -> int:
    args = parse_args()

    full_mmd = render_full_mmd()
    report_mmd = render_report_mmd()

    write_text(FULL_OUTPUT, full_mmd)
    write_text(REPORT_MMD_OUTPUT, report_mmd)
    write_text(REPORT_MD_OUTPUT, render_report_md(report_mmd))
    write_text(KEYS_ONLY_OUTPUT, render_keys_only_md())

    if args.render:
        render_mermaid(FULL_OUTPUT, FULL_SVG_OUTPUT)
        render_mermaid(FULL_OUTPUT, FULL_PNG_OUTPUT)
        render_mermaid(REPORT_MMD_OUTPUT, REPORT_SVG_OUTPUT)
        render_mermaid(REPORT_MMD_OUTPUT, REPORT_PNG_OUTPUT)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
