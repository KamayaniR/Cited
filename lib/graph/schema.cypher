// Cited graph schema. Runs at startup; every statement is idempotent.
// Node ids match Postgres row ids so the two stores stay in sync.
CREATE CONSTRAINT company_id IF NOT EXISTS FOR (n:Company) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (n:Person) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT product_id IF NOT EXISTS FOR (n:Product) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT competitor_id IF NOT EXISTS FOR (n:Competitor) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT signal_id IF NOT EXISTS FOR (n:Signal) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT team_id IF NOT EXISTS FOR (n:Team) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT school_id IF NOT EXISTS FOR (n:School) REQUIRE n.id IS UNIQUE;
CREATE INDEX company_domain IF NOT EXISTS FOR (n:Company) ON (n.domain);
// Edge types: works_at, competes_with, matched_to, contacted_via, replied_to,
// previously_employed_at, has_signal, uses, studied_at
