"""Synthetic disposable database only: shared follow-up state and retries."""
from concurrent.futures import ThreadPoolExecutor
import subprocess
import uuid

ACTOR = "10000000-0000-0000-0000-000000000001"
EQUIPMENT = "e0000000-0000-0000-0000-000000000001"
MATERIAL = "e1000000-0000-0000-0000-000000000001"

def query(sql: str, allow_failure: bool = False) -> str:
    result = subprocess.run(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", sql],
                            capture_output=True, text=True, timeout=30)
    if result.returncode:
        if allow_failure and "Vật tư/trả phiếu đã thay đổi" in result.stderr:
            return "stale"
        raise RuntimeError(result.stderr)
    return result.stdout.strip().splitlines()[-1]

def as_user(sql: str, allow_failure: bool = False) -> str:
    return query("begin; set local role authenticated; "
                 f"select set_config('request.jwt.claim.sub','{ACTOR}',true); " + sql + "; commit;", allow_failure)

cid = as_user(f"select public.create_tracking_case('{EQUIPMENT}','repair','2026-08-08','Concurrent followup','{uuid.uuid4()}')")
uuid.UUID(cid)
iid = query(f"select i.id from public.repair_work_items i join public.repair_orders r on r.id=i.repair_order_id where r.case_id='{cid}'")
uuid.UUID(iid)
retry_key = str(uuid.uuid4())
def add(key: str) -> str:
    uuid.UUID(key)
    return as_user(f"select public.add_tracking_material('{iid}','{MATERIAL}',1,'borrowed',false,'Concurrent','{key}')")
with ThreadPoolExecutor(max_workers=8) as pool:
    ids = list(pool.map(add, [retry_key] * 16))
assert len(set(ids)) == 1
assert query(f"select count(*) from public.repair_material_usages where repair_work_item_id='{iid}'") == "1"
print("PASS: 16 concurrent material retries create one line")

version = int(query(f"select version_no from public.case_material_followups where case_id='{cid}'"))
as_user(f"select public.set_material_return('{cid}','completed','2026-08-08 10:00+07',{version},'Concurrent')")
version = int(query(f"select version_no from public.case_material_followups where case_id='{cid}'"))
def settle(_: int) -> str:
    return as_user(f"select public.set_material_return('{cid}','completed','2026-08-09 10:00+07',{version},'Concurrent')", True)
with ThreadPoolExecutor(max_workers=8) as pool:
    adding = pool.submit(add, str(uuid.uuid4()))
    settled = list(pool.map(settle, range(6)))
    adding.result()
assert query(f"select return_status from public.case_material_followups where case_id='{cid}'") == "pending"
assert query(f"select count(*) from public.repair_material_usages where repair_work_item_id='{iid}'") == "2"
print("PASS: adding material concurrently with stale return completion leaves the case pending")
