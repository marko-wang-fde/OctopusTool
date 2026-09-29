#!/usr/bin/env python3
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def request(base_url, path, method="GET"):
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    req = urllib.request.Request(url, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, response.headers.get("content-type", ""), body
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        return error.code, error.headers.get("content-type", ""), body


def load_json(body):
    try:
        return json.loads(body)
    except json.JSONDecodeError as error:
        raise AssertionError(f"response is not valid JSON: {error}") from error


def expect_json_ok(base_url, path):
    status, content_type, body = request(base_url, path)
    if status != 200:
        raise AssertionError(f"{path} expected 200, got {status}: {body[:200]}")
    if "application/json" not in content_type:
        raise AssertionError(f"{path} expected JSON content-type, got {content_type}")
    payload = load_json(body)
    if not payload.get("ok"):
        raise AssertionError(f"{path} expected ok=true, got {payload}")
    return payload["data"]


def expect_html_app(base_url, path):
    status, content_type, body = request(base_url, path)
    if status != 200:
        raise AssertionError(f"{path} expected 200, got {status}: {body[:200]}")
    if "text/html" not in content_type:
        raise AssertionError(f"{path} expected HTML content-type, got {content_type}")
    if 'id="root"' not in body:
        raise AssertionError(f"{path} does not look like the report web app")


def main():
    parser = argparse.ArgumentParser(description="Probe a local octoplanner report server without browser login.")
    parser.add_argument("--url", default="http://127.0.0.1:5177", help="report server base URL")
    parser.add_argument("--plan", help="plan name or id; defaults to the first listed plan")
    args = parser.parse_args()

    config = expect_json_ok(args.url, "/api/config")
    expect_json_ok(args.url, "/api/health")
    plans_payload = expect_json_ok(args.url, "/api/plans")
    plans = plans_payload.get("plans", [])
    if not plans:
        raise AssertionError("no plans returned by /api/plans")

    plan = args.plan or plans[0].get("name") or plans[0].get("id")
    if not plan:
        raise AssertionError("cannot resolve plan name/id from /api/plans")

    encoded_plan = urllib.parse.quote(plan, safe="")
    overview = expect_json_ok(args.url, f"/api/plans/{encoded_plan}/overview")
    timeline = expect_json_ok(args.url, f"/api/plans/{encoded_plan}/timeline")
    expect_json_ok(args.url, f"/api/plans/{encoded_plan}/exceptions")
    expect_html_app(args.url, "/")
    expect_html_app(args.url, f"/plans/{encoded_plan}/timeline")

    mutation_status, _, mutation_body = request(args.url, "/api/plans", method="POST")
    if mutation_status != 405:
        raise AssertionError(f"POST /api/plans expected 405, got {mutation_status}: {mutation_body[:200]}")

    summary = {
        "ok": True,
        "url": args.url,
        "locale": config.get("locale"),
        "readOnly": config.get("readOnly"),
        "plan": plan,
        "reportType": overview.get("reportType"),
        "resourceCount": len(timeline.get("resources", [])),
        "operationCount": sum(len(resource.get("operations", [])) for resource in timeline.get("resources", [])),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
