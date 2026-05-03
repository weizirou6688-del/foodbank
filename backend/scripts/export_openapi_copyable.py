"""把生成的 OpenAPI schema 导出成可拷贝的 JSON 和 Markdown 文件。"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_PATH = Path(__file__).resolve()
BACKEND_ROOT = SCRIPT_PATH.parents[1]
PROJECT_ROOT = SCRIPT_PATH.parents[2]

# 这个脚本不在 uvicorn 里跑,所以手动把 backend 包路径引导一下
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import app  # noqa: E402


HTTP_METHODS = ("get", "post", "put", "patch", "delete", "options", "head")


def _json_block(value: Any) -> str:
    return "```json\n" + json.dumps(value, indent=2, ensure_ascii=False) + "\n```"


def _inline_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _schema_type_name(schema: Any) -> str:
    if not isinstance(schema, dict):
        return ""

    ref = schema.get("$ref")
    if isinstance(ref, str) and ref:
        return ref.rsplit("/", 1)[-1]

    schema_type = schema.get("type")
    if schema_type == "array":
        item_type = _schema_type_name(schema.get("items", {})) or "any"
        return f"array<{item_type}>"

    if isinstance(schema_type, str) and schema_type:
        return schema_type

    for key in ("oneOf", "anyOf", "allOf"):
        if key in schema:
            return key

    if "enum" in schema:
        return "enum"

    return ""


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n").strip()
    return text.replace("\n", "<br>")


def _dedupe_strings(values: list[str] | None) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values or []:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def _merge_parameters(path_parameters: list[Any], operation_parameters: list[Any]) -> list[Any]:
    merged: dict[tuple[str, str], Any] = {}

    # 同名同位置的参数,operation 级别会覆盖 path 级别,
    # 和 OpenAPI 的参数解析规则一致
    for parameter in path_parameters or []:
        if isinstance(parameter, dict):
            merged[(str(parameter.get("name", "")), str(parameter.get("in", "")))] = parameter

    for parameter in operation_parameters or []:
        if isinstance(parameter, dict):
            merged[(str(parameter.get("name", "")), str(parameter.get("in", "")))] = parameter

    return list(merged.values())


def _append_metadata(lines: list[str], operation: dict[str, Any]) -> None:
    tags = _dedupe_strings(operation.get("tags"))
    if tags:
        lines.append(f"- Tags: {', '.join(tags)}")

    if operation.get("summary"):
        lines.append(f"- Summary: {_clean_text(operation['summary'])}")

    if operation.get("description"):
        lines.append(f"- Description: {_clean_text(operation['description'])}")

    if operation.get("operationId"):
        lines.append(f"- Operation ID: `{operation['operationId']}`")

    if operation.get("deprecated"):
        lines.append("- Deprecated: true")

    if operation.get("security"):
        lines.append(f"- Security: `{_inline_json(operation['security'])}`")


def _append_parameter_table(lines: list[str], parameters: list[Any]) -> None:
    if not parameters:
        return

    lines.append("")
    lines.append("Parameters:")
    lines.append("")
    lines.append("| Name | In | Required | Type | Description |")
    lines.append("| --- | --- | --- | --- | --- |")

    for parameter in parameters:
        if not isinstance(parameter, dict):
            lines.append(f"| | | | | `{_inline_json(parameter)}` |")
            continue

        schema = parameter.get("schema", {})
        name = _clean_text(parameter.get("name"))
        location = _clean_text(parameter.get("in"))
        required = "yes" if parameter.get("required") else "no"
        type_name = _clean_text(_schema_type_name(schema))
        description = _clean_text(parameter.get("description"))
        lines.append(f"| {name} | {location} | {required} | {type_name} | {description} |")

    lines.append("")

    for parameter in parameters:
        if not isinstance(parameter, dict):
            continue
        schema = parameter.get("schema")
        if schema:
            lines.append(f"Schema for parameter `{parameter.get('name', '')}`:")
            lines.append("")
            lines.append(_json_block(schema))
            lines.append("")


def _append_request_body(lines: list[str], request_body: dict[str, Any] | None) -> None:
    if not request_body:
        return

    lines.append("Request Body:")
    lines.append("")
    lines.append(f"- Required: {'yes' if request_body.get('required') else 'no'}")
    if request_body.get("description"):
        lines.append(f"- Description: {_clean_text(request_body['description'])}")

    content = request_body.get("content", {})
    if not isinstance(content, dict) or not content:
        lines.append("")
        lines.append(_json_block(request_body))
        lines.append("")
        return

    for media_type, media_value in content.items():
        lines.append("")
        lines.append(f"Content type: `{media_type}`")
        lines.append("")
        if isinstance(media_value, dict):
            if media_value.get("schema") is not None:
                lines.append(_json_block(media_value["schema"]))
            else:
                lines.append(_json_block(media_value))
        else:
            lines.append(_json_block(media_value))
        lines.append("")


def _append_responses(lines: list[str], responses: dict[str, Any] | None) -> None:
    if not isinstance(responses, dict) or not responses:
        return

    lines.append("Responses:")
    lines.append("")
    for status_code, response in responses.items():
        lines.append(f"Status `{status_code}`")
        if not isinstance(response, dict):
            lines.append("")
            lines.append(_json_block(response))
            lines.append("")
            continue

        if response.get("description"):
            lines.append(f"- Description: {_clean_text(response['description'])}")

        headers = response.get("headers")
        if headers:
            lines.append("- Headers:")
            lines.append("")
            lines.append(_json_block(headers))
            lines.append("")

        content = response.get("content", {})
        if isinstance(content, dict) and content:
            for media_type, media_value in content.items():
                lines.append(f"- Content type: `{media_type}`")
                lines.append("")
                if isinstance(media_value, dict) and media_value.get("schema") is not None:
                    lines.append(_json_block(media_value["schema"]))
                else:
                    lines.append(_json_block(media_value))
                lines.append("")
        else:
            lines.append("")


def build_markdown(schema: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    info = schema.get("info", {})
    paths = schema.get("paths", {})
    components = schema.get("components", {})

    lines: list[str] = [
        "# Swagger UI Copyable Export",
        "",
        "This file was generated from `backend/app/main.py` using `app.openapi()`.",
        f"Generated at: `{now}`",
        "",
        "## Overview",
        "",
        f"- Title: {_clean_text(info.get('title', ''))}",
        f"- Version: {_clean_text(info.get('version', ''))}",
        f"- OpenAPI: {_clean_text(schema.get('openapi', ''))}",
        f"- Paths: {len(paths)}",
        f"- Component sections: {len(components)}",
        "",
    ]

    servers = schema.get("servers")
    if servers:
        lines.extend(
            [
                "## Servers",
                "",
                _json_block(servers),
                "",
            ]
        )

    tags = schema.get("tags")
    if tags:
        lines.extend(
            [
                "## Tags",
                "",
                _json_block(tags),
                "",
            ]
        )

    lines.extend(["## Paths", ""])

    # Markdown 导出宁可冗长也要完整,这样不依赖 Swagger UI 也能
    # 把各小节直接拷到报告或聊天里
    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            lines.append(f"### {path}")
            lines.append("")
            lines.append(_json_block(path_item))
            lines.append("")
            continue

        path_parameters = path_item.get("parameters", [])

        for method in HTTP_METHODS:
            operation = path_item.get(method)
            if not isinstance(operation, dict):
                continue

            lines.append(f"### {method.upper()} {path}")
            lines.append("")
            _append_metadata(lines, operation)

            parameters = _merge_parameters(path_parameters, operation.get("parameters", []))
            _append_parameter_table(lines, parameters)

            _append_request_body(lines, operation.get("requestBody"))
            _append_responses(lines, operation.get("responses"))

            if operation.get("callbacks"):
                lines.append("Callbacks:")
                lines.append("")
                lines.append(_json_block(operation["callbacks"]))
                lines.append("")

            lines.append("---")
            lines.append("")

    lines.extend(["## Components", ""])

    if not isinstance(components, dict) or not components:
        lines.append("No components were defined.")
        lines.append("")
        return "\n".join(lines)

    for section_name, section_body in components.items():
        lines.append(f"### {section_name}")
        lines.append("")

        # 组件定义原样输出,下游读者看到的就是 FastAPI 发布的同一个
        # schema 结构
        if not isinstance(section_body, dict) or not section_body:
            lines.append(_json_block(section_body))
            lines.append("")
            continue

        for item_name, item_value in section_body.items():
            lines.append(f"#### {item_name}")
            lines.append("")
            lines.append(_json_block(item_value))
            lines.append("")

    return "\n".join(lines)


def main() -> None:
    output_dir = PROJECT_ROOT / "docs" / "generated"
    output_dir.mkdir(parents=True, exist_ok=True)

    schema = app.openapi()

    json_path = output_dir / "swagger-openapi-export.json"
    markdown_path = output_dir / "swagger-openapi-export.md"

    json_path.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    markdown_path.write_text(build_markdown(schema), encoding="utf-8")

    print(f"Wrote {json_path}")
    print(f"Wrote {markdown_path}")


if __name__ == "__main__":
    main()
