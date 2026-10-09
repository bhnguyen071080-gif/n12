"""Disposable PostgreSQL regression: simultaneous submits and retries.
Uses only Python stdlib and the runner's psql client. Not production data.
"""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import uuid

EQUIPMENT = "20000000-0000-0000-0000-000000000001"
OPERATOR = "10000000-0000-0000-0000-000000000004"

def query(sql: str) -> str:
    result = subprocess.run(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True, capture_output=True, text=True, timeout=30,
    )
    return result.stdout.strip().splitlines()[-1]

def create_case(key: str) -> str:
    uuid.UUID(key)  # validate values before putting them in fixture SQL
    return query(
        "begin; set local role authenticated; "
        f"select set_config('request.jwt.claim.sub','{OPERATOR}',true); "
        f"select public.create_work_case('{EQUIPMENT}','cleaning',"
        "'2026-10-09 01:00:00+00',null,'Concurrency fixture',"
        f"'{key}'); commit;"
    )

keys = [str(uuid.uuid4()) for _ in range(24)]
with ThreadPoolExecutor(max_workers=8) as pool:
    independent = list(pool.map(create_case, keys))
assert len(set(independent)) == 24, "independent events must have distinct UUIDs"

retry_key = str(uuid.uuid4())
with ThreadPoolExecutor(max_workers=8) as pool:
    retried = list(pool.map(create_case, [retry_key] * 16))
assert len(set(retried)) == 1, "simultaneous retries must return one UUID"
stats = query(
    f"select count(*)||'|'||count(distinct code) from public.work_cases "
    f"where equipment_id='{EQUIPMENT}' and kind='cleaning';"
)
assert stats == "25|25", f"expected 25 unique event codes, got {stats}"
print("PASS: 24 simultaneous same-second events have distinct codes")
print("PASS: 16 simultaneous retries create exactly one event")
