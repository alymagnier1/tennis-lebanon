"""Local-only concurrency test. Uses Docker's existing Supabase Postgres, never hosted data."""
import concurrent.futures
import hashlib
import subprocess
import uuid

container = "supabase_db_tennis-lebanon-claude-code"
ip_hash = hashlib.sha256(uuid.uuid4().bytes).hexdigest()
def sql(query):
    result = subprocess.run(["docker", "exec", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", query], capture_output=True, text=True, check=True)
    return result.stdout.strip()
def attempt(_):
    # Keep transactions overlapping to expose a count/insert race.
    result = sql(f"begin; select public.consume_prelaunch_signup_attempt('{ip_hash}'); select pg_sleep(0.05); commit;")
    return int(result.strip())
try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(attempt, range(16)))
    assert results.count(0) == 8, results
    assert sum(value > 0 for value in results) == 8, results
    assert int(sql(f"select count(*) from public.prelaunch_signup_attempts where ip_hash='{ip_hash}'")) == 8
    print("PASS: 16 concurrent requests; exactly 8 accepted, 8 rate-limited.")
finally:
    # Remove only records created by this run's randomly generated test hash.
    sql(f"delete from public.prelaunch_signup_attempts where ip_hash='{ip_hash}'")
