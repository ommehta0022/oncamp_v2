import re
from pathlib import Path

ROOT = Path("d:/2026-06-30/oncampuses-v1")
base_sql_path = ROOT / "all_info_for_api_referance_only/supabase-sql-editor-migration.sql"
ext_sql_path = ROOT / "supabase-production-extension.sql"
out_sql_path = ROOT / "full_db_schema.sql"

base_sql = base_sql_path.read_text(encoding="utf-8")

# ENUM types
types = []
def type_repl(m):
    tname = m.group(1)
    vals = m.group(2)
    q = chr(34)
    types.append(f"  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{tname}') THEN\n    CREATE TYPE {q}{tname}{q} AS ENUM ({vals});\n  END IF;")
    return ""

base_sql = re.sub(r'CREATE TYPE "(.*?)" AS ENUM \((.*?)\);', type_repl, base_sql)
if types:
    type_block = "DO \nBEGIN\n" + "\n".join(types) + "\nEND ;\n\n"
    base_sql = type_block + base_sql

# Tables
base_sql = base_sql.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "')

# Indexes
base_sql = base_sql.replace('CREATE INDEX "', 'CREATE INDEX IF NOT EXISTS "')
base_sql = base_sql.replace('CREATE UNIQUE INDEX "', 'CREATE UNIQUE INDEX IF NOT EXISTS "')

# Constraints
def constraint_repl(m):
    tname = m.group(1)
    cname = m.group(2)
    rest = m.group(3)
    q = chr(34)
    return f'''DO  BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{cname}') THEN
    ALTER TABLE {q}{tname}{q} ADD CONSTRAINT {q}{cname}{q} {rest};
  END IF;
END ;'''

base_sql = re.sub(r'ALTER TABLE "(.*?)" ADD CONSTRAINT "(.*?)" (.*?);', constraint_repl, base_sql)

ext_sql = ext_sql_path.read_text(encoding="utf-8")
full_sql = "-- AUTO-GENERATED FULL SCHEMA WITH IF NOT EXISTS\n\n" + base_sql + "\n\n" + ext_sql

out_sql_path.write_text(full_sql, encoding="utf-8")
print("Done writing full_db_schema.sql")
