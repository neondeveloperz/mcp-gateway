use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

use crate::security::{is_redis_mutation, is_sql_mutation};
use crate::types::home_dir;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DatabaseConfig {
    pub id: String,
    pub alias: String,
    pub name: String,
    pub engine: String, // "postgres" | "mysql" | "sqlite" | "redis"
    #[serde(rename = "connectionUri")]
    pub connection_uri: String,
    #[serde(rename = "securityTier")]
    pub security_tier: String, // "read_only" | "hitl_mutation" | "unrestricted"
    pub description: Option<String>,
    pub enabled: bool,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
}

pub fn get_gateway_databases_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".mcp_gateway").join("databases.json"))
}

pub fn load_configured_databases() -> Vec<DatabaseConfig> {
    if let Some(path) = get_gateway_databases_path() {
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(dbs) = serde_json::from_str::<Vec<DatabaseConfig>>(&content) {
                    return dbs;
                }
            }
        }
    }
    Vec::new()
}

pub fn save_configured_databases(dbs: &[DatabaseConfig]) -> Result<(), String> {
    if let Some(path) = get_gateway_databases_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let json_str = serde_json::to_string_pretty(dbs).map_err(|e| e.to_string())?;
        fs::write(&path, json_str).map_err(|e| format!("Failed to write databases.json: {}", e))?;
    }
    Ok(())
}

pub fn clean_sqlite_path(uri: &str) -> String {
    let s = uri.trim();
    if let Some(stripped) = s.strip_prefix("sqlite://") {
        stripped.to_string()
    } else {
        s.to_string()
    }
}

pub fn detect_engine_from_uri(uri: &str) -> String {
    let lower = uri.trim().to_lowercase();
    if lower.starts_with("postgres://") || lower.starts_with("postgresql://") {
        "postgres".to_string()
    } else if lower.starts_with("mysql://") || lower.starts_with("mariadb://") {
        "mysql".to_string()
    } else if lower.starts_with("redis://") || lower.starts_with("rediss://") {
        "redis".to_string()
    } else if lower.starts_with("sqlite://")
        || lower.ends_with(".db")
        || lower.ends_with(".sqlite")
        || lower.ends_with(".sqlite3")
    {
        "sqlite".to_string()
    } else {
        "postgres".to_string()
    }
}

pub fn parse_redis_command(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut quote_char = ' ';

    for ch in input.chars() {
        if (ch == '"' || ch == '\'') && !in_quotes {
            in_quotes = true;
            quote_char = ch;
        } else if in_quotes && ch == quote_char {
            in_quotes = false;
        } else if ch.is_whitespace() && !in_quotes {
            if !current.is_empty() {
                tokens.push(current);
                current = String::new();
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

pub fn redis_value_to_json(val: &redis::Value) -> serde_json::Value {
    match val {
        redis::Value::Nil => serde_json::Value::Null,
        redis::Value::Int(i) => serde_json::json!(i),
        redis::Value::Double(d) => serde_json::json!(d),
        redis::Value::Boolean(b) => serde_json::json!(b),
        redis::Value::Okay => serde_json::Value::String("OK".to_string()),
        redis::Value::SimpleString(s) => serde_json::Value::String(s.clone()),
        redis::Value::BulkString(bytes) => {
            if let Ok(s) = std::str::from_utf8(bytes) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(s) {
                    parsed
                } else {
                    serde_json::Value::String(s.to_string())
                }
            } else {
                serde_json::Value::String(format!("<binary {} bytes>", bytes.len()))
            }
        }
        redis::Value::Array(items) | redis::Value::Set(items) => {
            serde_json::Value::Array(items.iter().map(redis_value_to_json).collect())
        }
        redis::Value::Map(kvs) => {
            let mut map = serde_json::Map::new();
            for (k, v) in kvs {
                let key_str = match k {
                    redis::Value::BulkString(b) => String::from_utf8_lossy(b).to_string(),
                    redis::Value::SimpleString(s) => s.clone(),
                    _ => format!("{:?}", k),
                };
                map.insert(key_str, redis_value_to_json(v));
            }
            serde_json::Value::Object(map)
        }
        redis::Value::VerbatimString { text, .. } => serde_json::Value::String(text.clone()),
        redis::Value::BigNumber(n) => serde_json::Value::String(n.to_string()),
        redis::Value::Attribute { data, .. } => redis_value_to_json(data),
        redis::Value::Push { data, .. } => {
            serde_json::Value::Array(data.iter().map(redis_value_to_json).collect())
        }
        redis::Value::ServerError(err) => serde_json::json!({
            "error": format!("{:?}", err)
        }),
    }
}

pub fn mysql_value_to_json(val: &mysql::Value) -> serde_json::Value {
    match val {
        mysql::Value::NULL => serde_json::Value::Null,
        mysql::Value::Bytes(b) => {
            if let Ok(s) = std::str::from_utf8(b) {
                serde_json::Value::String(s.to_string())
            } else {
                serde_json::Value::String(format!("<binary {} bytes>", b.len()))
            }
        }
        mysql::Value::Int(i) => serde_json::json!(i),
        mysql::Value::UInt(u) => serde_json::json!(u),
        mysql::Value::Float(f) => serde_json::json!(f),
        mysql::Value::Double(d) => serde_json::json!(d),
        mysql::Value::Date(year, month, day, hour, min, sec, micro) => {
            if *hour == 0 && *min == 0 && *sec == 0 && *micro == 0 {
                serde_json::Value::String(format!("{:04}-{:02}-{:02}", year, month, day))
            } else {
                serde_json::Value::String(format!(
                    "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                    year, month, day, hour, min, sec
                ))
            }
        }
        mysql::Value::Time(is_neg, days, hours, minutes, seconds, _micros) => {
            let sign = if *is_neg { "-" } else { "" };
            serde_json::Value::String(format!(
                "{}{}:{:02}:{:02}",
                sign,
                days * 24 + (*hours as u32),
                minutes,
                seconds
            ))
        }
    }
}

pub fn connect_pg(uri: &str) -> Result<postgres::Client, String> {
    if uri.contains("sslmode=disable") {
        postgres::Client::connect(uri, postgres::NoTls).map_err(|e| e.to_string())
    } else {
        let mut builder = native_tls::TlsConnector::builder();
        builder.danger_accept_invalid_certs(true);
        match builder.build() {
            Ok(connector) => {
                let tls = postgres_native_tls::MakeTlsConnector::new(connector);
                match postgres::Client::connect(uri, tls) {
                    Ok(client) => Ok(client),
                    Err(e) => {
                        postgres::Client::connect(uri, postgres::NoTls).map_err(|e2| {
                            format!("SSL failed: {}; Plaintext fallback failed: {}", e, e2)
                        })
                    }
                }
            }
            Err(_) => postgres::Client::connect(uri, postgres::NoTls).map_err(|e| e.to_string()),
        }
    }
}

pub fn pg_row_to_json(row: &postgres::Row) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    for (i, col) in row.columns().iter().enumerate() {
        let col_name = col.name();
        let val: serde_json::Value = if let Ok(v) = row.try_get::<_, Option<String>>(i) {
            v.map(serde_json::Value::String).unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<_, Option<i64>>(i) {
            v.map(|n| serde_json::json!(n)).unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<_, Option<i32>>(i) {
            v.map(|n| serde_json::json!(n)).unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<_, Option<f64>>(i) {
            v.map(|n| serde_json::json!(n)).unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<_, Option<bool>>(i) {
            v.map(|b| serde_json::json!(b)).unwrap_or(serde_json::Value::Null)
        } else if let Ok(v) = row.try_get::<_, Option<serde_json::Value>>(i) {
            v.unwrap_or(serde_json::Value::Null)
        } else {
            serde_json::Value::String("<binary/unsupported>".into())
        };
        map.insert(col_name.to_string(), val);
    }
    serde_json::Value::Object(map)
}

pub fn test_database_connection(uri: &str, engine_hint: Option<&str>) -> Result<String, String> {
    let engine = engine_hint
        .filter(|e| !e.is_empty())
        .map(|e| e.to_lowercase())
        .unwrap_or_else(|| detect_engine_from_uri(uri));

    match engine.as_str() {
        "postgres" | "postgresql" => {
            let mut client = connect_pg(uri)?;
            let row = client.query_one("SELECT version()", &[]).map_err(|e| e.to_string())?;
            let ver: String = row.get(0);
            Ok(format!("Connected to PostgreSQL: {}", ver))
        }
        "mysql" | "mariadb" => {
            use mysql::prelude::Queryable;
            let opts = mysql::Opts::from_url(uri).map_err(|e| format!("Invalid MySQL URL: {}", e))?;
            let mut conn = mysql::Conn::new(opts).map_err(|e| format!("MySQL connection failed: {}", e))?;
            let ver: Option<String> = conn.query_first("SELECT VERSION()").map_err(|e| e.to_string())?;
            Ok(format!("Connected to MySQL/MariaDB: {}", ver.unwrap_or_else(|| "Unknown version".to_string())))
        }
        "sqlite" => {
            let clean_path = clean_sqlite_path(uri);
            let conn = rusqlite::Connection::open(&clean_path).map_err(|e| format!("SQLite open failed: {}", e))?;
            let ver: String = conn.query_row("SELECT sqlite_version()", [], |r| r.get(0)).map_err(|e| e.to_string())?;
            Ok(format!("Connected to SQLite v{} ({})", ver, clean_path))
        }
        "redis" => {
            let client = redis::Client::open(uri).map_err(|e| format!("Invalid Redis URI: {}", e))?;
            let mut con = client.get_connection().map_err(|e| format!("Redis connection failed: {}", e))?;
            let pong: String = redis::cmd("PING").query(&mut con).map_err(|e| format!("Redis PING failed: {}", e))?;
            Ok(format!("Connected to Redis: PING -> {}", pong))
        }
        other => Err(format!(
            "Unsupported database engine '{}'. Supported engines: postgres, mysql, sqlite, redis.",
            other
        )),
    }
}

pub fn execute_db_list_databases() -> serde_json::Value {
    let databases = load_configured_databases();
    let enabled_dbs: Vec<serde_json::Value> = databases
        .into_iter()
        .filter(|d| d.enabled)
        .map(|d| {
            serde_json::json!({
                "alias": d.alias,
                "name": d.name,
                "engine": d.engine,
                "securityTier": d.security_tier,
                "description": d.description.unwrap_or_else(|| "No description provided".to_string()),
                "status": "ready"
            })
        })
        .collect();
    serde_json::json!({
        "databases": enabled_dbs,
        "count": enabled_dbs.len()
    })
}

pub fn execute_db_list_tables(db_alias: &str, schema: Option<&str>) -> Result<serde_json::Value, String> {
    let databases = load_configured_databases();
    let db = databases
        .iter()
        .find(|d| d.alias == db_alias && d.enabled)
        .ok_or_else(|| {
            format!(
                "Database '{}' not found or disabled. Run 'db_list_databases' to see available databases.",
                db_alias
            )
        })?;

    match db.engine.to_lowercase().as_str() {
        "postgres" | "postgresql" => {
            let target_schema = schema.unwrap_or("public");
            let mut client = connect_pg(&db.connection_uri)?;
            let rows = client
                .query(
                    "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name",
                    &[&target_schema],
                )
                .map_err(|e| format!("Query failed: {}", e))?;

            let tables: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| {
                    let name: String = r.get(0);
                    let t_type: String = r.get(1);
                    serde_json::json!({
                        "table_name": name,
                        "type": t_type,
                        "schema": target_schema
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "postgres",
                "schema": target_schema,
                "tables": tables,
                "total": tables.len()
            }))
        }
        "mysql" | "mariadb" => {
            use mysql::prelude::Queryable;
            let opts = mysql::Opts::from_url(&db.connection_uri).map_err(|e| format!("Invalid MySQL URL: {}", e))?;
            let mut conn = mysql::Conn::new(opts).map_err(|e| format!("MySQL connection failed: {}", e))?;
            let target_schema = schema.unwrap_or("");
            let sql = if !target_schema.is_empty() {
                format!(
                    "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = '{}' ORDER BY table_name",
                    target_schema.replace('\'', "''")
                )
            } else {
                "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name".to_string()
            };
            let rows: Vec<(String, String)> = conn.query(&sql).map_err(|e| format!("MySQL query failed: {}", e))?;
            let tables: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|(name, t_type)| {
                    serde_json::json!({
                        "table_name": name,
                        "type": t_type,
                        "schema": if target_schema.is_empty() { "current" } else { target_schema }
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "mysql",
                "schema": target_schema,
                "tables": tables,
                "total": tables.len()
            }))
        }
        "sqlite" => {
            let clean_path = clean_sqlite_path(&db.connection_uri);
            let conn = rusqlite::Connection::open(&clean_path).map_err(|e| format!("SQLite open failed: {}", e))?;
            let mut stmt = conn
                .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name")
                .map_err(|e| format!("SQLite prepare failed: {}", e))?;
            let rows = stmt
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
                .map_err(|e| format!("SQLite query failed: {}", e))?;

            let mut tables = Vec::new();
            for item in rows {
                if let Ok((name, t_type)) = item {
                    tables.push(serde_json::json!({
                        "table_name": name,
                        "type": t_type,
                        "schema": "main"
                    }));
                }
            }

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "sqlite",
                "tables": tables,
                "total": tables.len()
            }))
        }
        "redis" => {
            let client = redis::Client::open(db.connection_uri.as_str()).map_err(|e| format!("Invalid Redis URI: {}", e))?;
            let mut con = client.get_connection().map_err(|e| format!("Redis connection failed: {}", e))?;
            let scan_res: (u64, Vec<String>) = redis::cmd("SCAN")
                .arg(0)
                .arg("COUNT")
                .arg(100)
                .query(&mut con)
                .map_err(|e| format!("Redis SCAN failed: {}", e))?;

            let mut keys_with_type = Vec::new();
            for key in scan_res.1.iter().take(50) {
                let ktype: String = redis::cmd("TYPE").arg(key).query(&mut con).unwrap_or_else(|_| "unknown".to_string());
                keys_with_type.push(serde_json::json!({
                    "table_name": key,
                    "type": ktype,
                    "schema": "key"
                }));
            }

            let info: String = redis::cmd("INFO").arg("keyspace").query(&mut con).unwrap_or_default();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "redis",
                "tables": keys_with_type,
                "keyspaceSummary": info.trim(),
                "totalSampled": keys_with_type.len()
            }))
        }
        other => Err(format!("Unsupported engine '{}' for database '{}'", other, db_alias)),
    }
}

pub fn execute_db_describe_table(
    db_alias: &str,
    table: &str,
    schema: Option<&str>,
) -> Result<serde_json::Value, String> {
    let databases = load_configured_databases();
    let db = databases
        .iter()
        .find(|d| d.alias == db_alias && d.enabled)
        .ok_or_else(|| format!("Database '{}' not found or disabled.", db_alias))?;

    match db.engine.to_lowercase().as_str() {
        "postgres" | "postgresql" => {
            let target_schema = schema.unwrap_or("public");
            let mut client = connect_pg(&db.connection_uri)?;

            let rows = client
                .query(
                    "SELECT column_name, data_type, is_nullable, column_default 
                     FROM information_schema.columns 
                     WHERE table_schema = $1 AND table_name = $2 
                     ORDER BY ordinal_position",
                    &[&target_schema, &table],
                )
                .map_err(|e| format!("Query failed: {}", e))?;

            let columns: Vec<serde_json::Value> = rows
                .iter()
                .map(|r| {
                    let col: String = r.get(0);
                    let dtype: String = r.get(1);
                    let nullable: String = r.get(2);
                    let default_val: Option<String> = r.get(3);
                    serde_json::json!({
                        "column": col,
                        "type": dtype,
                        "is_nullable": nullable == "YES",
                        "default": default_val
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "postgres",
                "table": table,
                "schema": target_schema,
                "columns": columns,
                "totalColumns": columns.len()
            }))
        }
        "mysql" | "mariadb" => {
            use mysql::prelude::Queryable;
            let opts = mysql::Opts::from_url(&db.connection_uri).map_err(|e| format!("Invalid MySQL URL: {}", e))?;
            let mut conn = mysql::Conn::new(opts).map_err(|e| format!("MySQL connection failed: {}", e))?;
            let target_schema = schema.unwrap_or("");
            let safe_table = table.replace('\'', "''");
            let sql = if !target_schema.is_empty() {
                format!(
                    "SELECT column_name, data_type, is_nullable, column_default 
                     FROM information_schema.columns 
                     WHERE table_schema = '{}' AND table_name = '{}' 
                     ORDER BY ordinal_position",
                    target_schema.replace('\'', "''"),
                    safe_table
                )
            } else {
                format!(
                    "SELECT column_name, data_type, is_nullable, column_default 
                     FROM information_schema.columns 
                     WHERE table_schema = DATABASE() AND table_name = '{}' 
                     ORDER BY ordinal_position",
                    safe_table
                )
            };
            let rows: Vec<(String, String, String, Option<String>)> =
                conn.query(&sql).map_err(|e| format!("MySQL describe failed: {}", e))?;

            let columns: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|(col, dtype, nullable, default_val)| {
                    serde_json::json!({
                        "column": col,
                        "type": dtype,
                        "is_nullable": nullable == "YES",
                        "default": default_val
                    })
                })
                .collect();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "mysql",
                "table": table,
                "columns": columns,
                "totalColumns": columns.len()
            }))
        }
        "sqlite" => {
            let clean_path = clean_sqlite_path(&db.connection_uri);
            let conn = rusqlite::Connection::open(&clean_path).map_err(|e| format!("SQLite open failed: {}", e))?;
            if !table.chars().all(|c| c.is_alphanumeric() || c == '_') {
                return Err(format!("Invalid table identifier '{}'", table));
            }
            let mut stmt = conn
                .prepare(&format!("PRAGMA table_info(\"{}\")", table))
                .map_err(|e| format!("SQLite PRAGMA failed: {}", e))?;

            let rows = stmt
                .query_map([], |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, String>(2)?,
                        r.get::<_, i64>(3)?,
                        r.get::<_, Option<String>>(4)?,
                        r.get::<_, i64>(5)?,
                    ))
                })
                .map_err(|e| e.to_string())?;

            let mut columns = Vec::new();
            for col in rows {
                if let Ok((_cid, name, dtype, notnull, dflt, pk)) = col {
                    columns.push(serde_json::json!({
                        "column": name,
                        "type": dtype,
                        "is_nullable": notnull == 0,
                        "default": dflt,
                        "is_primary_key": pk == 1
                    }));
                }
            }

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "sqlite",
                "table": table,
                "columns": columns,
                "totalColumns": columns.len()
            }))
        }
        "redis" => {
            let client = redis::Client::open(db.connection_uri.as_str()).map_err(|e| format!("Invalid Redis URI: {}", e))?;
            let mut con = client.get_connection().map_err(|e| format!("Redis connection failed: {}", e))?;
            let ktype: String = redis::cmd("TYPE").arg(table).query(&mut con).unwrap_or_else(|_| "none".to_string());
            let ttl: i64 = redis::cmd("TTL").arg(table).query(&mut con).unwrap_or(-1);
            let mem: Option<u64> = redis::cmd("MEMORY").arg("USAGE").arg(table).query(&mut con).ok();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "redis",
                "key": table,
                "type": ktype,
                "ttlSeconds": ttl,
                "memoryUsageBytes": mem
            }))
        }
        other => Err(format!("Unsupported engine '{}'", other)),
    }
}

pub fn execute_db_query(db_alias: &str, sql: &str, max_rows: Option<usize>) -> Result<serde_json::Value, String> {
    let databases = load_configured_databases();
    let db = databases
        .iter()
        .find(|d| d.alias == db_alias && d.enabled)
        .ok_or_else(|| format!("Database '{}' not found or disabled.", db_alias))?;

    let engine = db.engine.to_lowercase();
    let is_mutation = if engine == "redis" {
        is_redis_mutation(sql)
    } else {
        is_sql_mutation(sql)
    };

    if db.security_tier == "read_only" && is_mutation {
        return Err(format!(
            "Access Denied: Database '{}' is configured in STRICT READ-ONLY mode. Mutation queries or commands are strictly prohibited.",
            db_alias
        ));
    }

    let limit = max_rows.unwrap_or(100).min(500);

    match engine.as_str() {
        "postgres" | "postgresql" => {
            let mut client = connect_pg(&db.connection_uri)?;
            if !is_mutation {
                let rows = client.query(sql, &[]).map_err(|e| format!("SQL Execution Error: {}", e))?;
                let total_returned = rows.len();
                let limited_rows: Vec<serde_json::Value> = rows.iter().take(limit).map(pg_row_to_json).collect();

                Ok(serde_json::json!({
                    "database": db_alias,
                    "engine": "postgres",
                    "query": sql,
                    "rowCount": total_returned,
                    "rows": limited_rows,
                    "truncated": total_returned > limit,
                    "limit": limit
                }))
            } else {
                let affected = client.execute(sql, &[]).map_err(|e| format!("SQL Execution Error: {}", e))?;
                Ok(serde_json::json!({
                    "database": db_alias,
                    "engine": "postgres",
                    "query": sql,
                    "rowsAffected": affected,
                    "status": "success"
                }))
            }
        }
        "mysql" | "mariadb" => {
            use mysql::prelude::Queryable;
            let opts = mysql::Opts::from_url(&db.connection_uri).map_err(|e| format!("Invalid MySQL URL: {}", e))?;
            let mut conn = mysql::Conn::new(opts).map_err(|e| format!("MySQL connection failed: {}", e))?;

            if !is_mutation {
                let query_res = conn.query_iter(sql).map_err(|e| format!("MySQL Query Error: {}", e))?;
                let col_names: Vec<String> = query_res
                    .columns()
                    .as_ref()
                    .iter()
                    .map(|c| c.name_str().to_string())
                    .collect();

                let mut rows = Vec::new();
                let mut count = 0;
                for row_result in query_res {
                    let row = row_result.map_err(|e| format!("Row read error: {}", e))?;
                    count += 1;
                    if rows.len() < limit {
                        let mut map = serde_json::Map::new();
                        for (i, val) in row.unwrap().iter().enumerate() {
                            let col = col_names.get(i).cloned().unwrap_or_else(|| format!("col_{}", i));
                            map.insert(col, mysql_value_to_json(val));
                        }
                        rows.push(serde_json::Value::Object(map));
                    }
                }

                Ok(serde_json::json!({
                    "database": db_alias,
                    "engine": "mysql",
                    "query": sql,
                    "rowCount": count,
                    "rows": rows,
                    "truncated": count > limit,
                    "limit": limit
                }))
            } else {
                conn.query_drop(sql).map_err(|e| format!("MySQL Execution Error: {}", e))?;
                Ok(serde_json::json!({
                    "database": db_alias,
                    "engine": "mysql",
                    "query": sql,
                    "rowsAffected": conn.affected_rows(),
                    "status": "success"
                }))
            }
        }
        "sqlite" => {
            let clean_path = clean_sqlite_path(&db.connection_uri);
            let conn = rusqlite::Connection::open(&clean_path).map_err(|e| format!("SQLite open error: {}", e))?;

            if !is_mutation {
                let mut stmt = conn.prepare(sql).map_err(|e| format!("SQLite syntax error: {}", e))?;
                let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
                let mut rows_iter = stmt.query([]).map_err(|e| format!("SQLite query error: {}", e))?;
                let mut rows = Vec::new();
                let mut count = 0;

                while let Some(row) = rows_iter.next().map_err(|e| format!("SQLite row error: {}", e))? {
                    count += 1;
                    if rows.len() < limit {
                        let mut map = serde_json::Map::new();
                        for (i, col_name) in col_names.iter().enumerate() {
                            let val = match row.get_ref(i).map_err(|e| e.to_string())? {
                                rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                                rusqlite::types::ValueRef::Integer(n) => serde_json::json!(n),
                                rusqlite::types::ValueRef::Real(f) => serde_json::json!(f),
                                rusqlite::types::ValueRef::Text(s) => {
                                    serde_json::Value::String(String::from_utf8_lossy(s).to_string())
                                }
                                rusqlite::types::ValueRef::Blob(b) => {
                                    serde_json::Value::String(format!("<blob {} bytes>", b.len()))
                                }
                            };
                            map.insert(col_name.clone(), val);
                        }
                        rows.push(serde_json::Value::Object(map));
                    }
                }

                Ok(serde_json::json!({
                    "database": db_alias,
                    "engine": "sqlite",
                    "query": sql,
                    "rowCount": count,
                    "rows": rows,
                    "truncated": count > limit,
                    "limit": limit
                }))
            } else {
                let affected = conn.execute(sql, []).map_err(|e| format!("SQLite Execution Error: {}", e))?;
                Ok(serde_json::json!({
                    "database": db_alias,
                    "engine": "sqlite",
                    "query": sql,
                    "rowsAffected": affected,
                    "status": "success"
                }))
            }
        }
        "redis" => {
            let client = redis::Client::open(db.connection_uri.as_str()).map_err(|e| format!("Invalid Redis URI: {}", e))?;
            let mut con = client.get_connection().map_err(|e| format!("Redis connection failed: {}", e))?;
            let tokens = parse_redis_command(sql.trim());
            if tokens.is_empty() {
                return Err("Empty Redis command string".to_string());
            }

            let mut cmd = redis::cmd(&tokens[0]);
            for arg in &tokens[1..] {
                cmd.arg(arg);
            }

            let val: redis::Value = cmd.query(&mut con).map_err(|e| format!("Redis Command Error: {}", e))?;
            let json_val = redis_value_to_json(&val);

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "redis",
                "command": sql,
                "result": json_val,
                "isMutation": is_mutation,
                "status": "success"
            }))
        }
        other => Err(format!("Unsupported database engine '{}'", other)),
    }
}

pub fn execute_db_explain(db_alias: &str, sql: &str) -> Result<serde_json::Value, String> {
    let databases = load_configured_databases();
    let db = databases
        .iter()
        .find(|d| d.alias == db_alias && d.enabled)
        .ok_or_else(|| format!("Database '{}' not found or disabled.", db_alias))?;

    match db.engine.to_lowercase().as_str() {
        "postgres" | "postgresql" => {
            let explain_sql = format!("EXPLAIN {}", sql);
            let mut client = connect_pg(&db.connection_uri)?;
            let rows = client.query(&explain_sql, &[]).map_err(|e| format!("Explain failed: {}", e))?;
            let plan: Vec<String> = rows.iter().map(|r| r.get::<_, String>(0)).collect();

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "postgres",
                "query": sql,
                "plan": plan.join("\n")
            }))
        }
        "mysql" | "mariadb" => {
            use mysql::prelude::Queryable;
            let opts = mysql::Opts::from_url(&db.connection_uri).map_err(|e| format!("Invalid MySQL URL: {}", e))?;
            let mut conn = mysql::Conn::new(opts).map_err(|e| format!("MySQL connection failed: {}", e))?;
            let explain_sql = format!("EXPLAIN {}", sql);
            let query_res = conn.query_iter(&explain_sql).map_err(|e| format!("Explain failed: {}", e))?;
            let mut plan_rows = Vec::new();
            for r in query_res {
                let row = r.map_err(|e| e.to_string())?;
                let row_vals: Vec<String> = row.unwrap().iter().map(|v| mysql_value_to_json(v).to_string()).collect();
                plan_rows.push(row_vals.join(" | "));
            }

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "mysql",
                "query": sql,
                "plan": plan_rows.join("\n")
            }))
        }
        "sqlite" => {
            let clean_path = clean_sqlite_path(&db.connection_uri);
            let conn = rusqlite::Connection::open(&clean_path).map_err(|e| format!("SQLite open error: {}", e))?;
            let explain_sql = format!("EXPLAIN QUERY PLAN {}", sql);
            let mut stmt = conn.prepare(&explain_sql).map_err(|e| format!("Explain failed: {}", e))?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(format!(
                        "id: {}, parent: {}, detail: {}",
                        r.get::<_, i64>(0)?,
                        r.get::<_, i64>(1)?,
                        r.get::<_, String>(3)?
                    ))
                })
                .map_err(|e| e.to_string())?;

            let mut plan = Vec::new();
            for item in rows {
                if let Ok(line) = item {
                    plan.push(line);
                }
            }

            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "sqlite",
                "query": sql,
                "plan": plan.join("\n")
            }))
        }
        "redis" => {
            let tokens = parse_redis_command(sql.trim());
            let cmd_name = tokens.first().cloned().unwrap_or_default().to_uppercase();
            let is_mut = is_redis_mutation(sql);
            Ok(serde_json::json!({
                "database": db_alias,
                "engine": "redis",
                "command": sql,
                "plan": format!("Redis Command Analysis:\n- Command: {}\n- Argument Count: {}\n- Mutation: {}\n- Security Impact: {}", cmd_name, tokens.len().saturating_sub(1), is_mut, if is_mut { "Requires HITL ticket or blocked in read-only" } else { "Read-only safe operation" })
            }))
        }
        other => Err(format!("Unsupported engine '{}'", other)),
    }
}

pub fn get_builtin_database_tools() -> Vec<serde_json::Value> {
    vec![
        serde_json::json!({
            "name": "db_list_databases",
            "description": "List all connected databases (PostgreSQL, MySQL/MariaDB, SQLite, Redis) available in the Gateway with their alias, engine, security tier, and description. Always call this first to discover available databases.",
            "inputSchema": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            },
            "_meta": {
                "server": "Gateway Built-in Databases",
                "isBuiltin": true
            }
        }),
        serde_json::json!({
            "name": "db_list_tables",
            "description": "List tables/views in SQL databases or key patterns in Redis for a specified database alias.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "database": {
                        "type": "string",
                        "description": "The target database alias from db_list_databases (e.g. 'prod_billing', 'sqlite_local', 'redis_cache')."
                    },
                    "schema": {
                        "type": "string",
                        "description": "Optional schema name for PostgreSQL or database name for MySQL."
                    }
                },
                "required": ["database"],
                "additionalProperties": false
            },
            "_meta": {
                "server": "Gateway Built-in Databases",
                "isBuiltin": true
            }
        }),
        serde_json::json!({
            "name": "db_describe_table",
            "description": "Get column names, data types, nullability, and keys for a specific table in SQL databases, or inspect key metadata/type/TTL in Redis.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "database": {
                        "type": "string",
                        "description": "The target database alias from db_list_databases."
                    },
                    "table": {
                        "type": "string",
                        "description": "The table name to inspect (or Redis key name)."
                    },
                    "schema": {
                        "type": "string",
                        "description": "Optional schema name (PostgreSQL) or database name."
                    }
                },
                "required": ["database", "table"],
                "additionalProperties": false
            },
            "_meta": {
                "server": "Gateway Built-in Databases",
                "isBuiltin": true
            }
        }),
        serde_json::json!({
            "name": "db_query",
            "description": "Execute a SQL query (PostgreSQL, MySQL, SQLite) or Redis command (e.g. 'GET key', 'HGETALL hash', 'KEYS app:*') against a target database alias. Strict read-only databases block mutations. Protected databases trigger In-Band HITL approval for mutations.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "database": {
                        "type": "string",
                        "description": "The target database alias from db_list_databases."
                    },
                    "sql": {
                        "type": "string",
                        "description": "The SQL query or Redis command to execute."
                    },
                    "max_rows": {
                        "type": "integer",
                        "description": "Maximum number of rows to return (default 100, max 500)."
                    }
                },
                "required": ["database", "sql"],
                "additionalProperties": false
            },
            "_meta": {
                "server": "Gateway Built-in Databases",
                "isBuiltin": true
            }
        }),
        serde_json::json!({
            "name": "db_explain_query",
            "description": "Inspect the execution plan, cost estimate, or command analysis without mutating data.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "database": {
                        "type": "string",
                        "description": "The target database alias from db_list_databases."
                    },
                    "sql": {
                        "type": "string",
                        "description": "The SQL query or Redis command to explain."
                    }
                },
                "required": ["database", "sql"],
                "additionalProperties": false
            },
            "_meta": {
                "server": "Gateway Built-in Databases",
                "isBuiltin": true
            }
        })
    ]
}

#[tauri::command]
pub fn get_gateway_databases() -> Vec<DatabaseConfig> {
    load_configured_databases()
}

#[tauri::command]
pub fn save_gateway_database(database: DatabaseConfig) -> Result<(), String> {
    let mut dbs = load_configured_databases();
    if let Some(pos) = dbs.iter().position(|d| d.id == database.id || d.alias == database.alias) {
        dbs[pos] = database;
    } else {
        dbs.push(database);
    }
    save_configured_databases(&dbs)
}

#[tauri::command]
pub fn delete_gateway_database(id: String) -> Result<(), String> {
    let mut dbs = load_configured_databases();
    dbs.retain(|d| d.id != id);
    save_configured_databases(&dbs)
}

#[tauri::command]
pub fn test_gateway_database_connection(uri: String, engine: Option<String>) -> Result<String, String> {
    test_database_connection(&uri, engine.as_deref())
}

#[tauri::command]
pub fn execute_gateway_database_query(
    db_alias: String,
    sql: String,
    max_rows: Option<usize>,
) -> Result<serde_json::Value, String> {
    execute_db_query(&db_alias, &sql, max_rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_engine_detection() {
        assert_eq!(detect_engine_from_uri("postgres://user:pass@localhost:5432/db"), "postgres");
        assert_eq!(detect_engine_from_uri("postgresql://user:pass@localhost:5432/db"), "postgres");
        assert_eq!(detect_engine_from_uri("mysql://user:pass@localhost:3306/db"), "mysql");
        assert_eq!(detect_engine_from_uri("mariadb://user:pass@localhost:3306/db"), "mysql");
        assert_eq!(detect_engine_from_uri("sqlite:///var/data/test.sqlite"), "sqlite");
        assert_eq!(detect_engine_from_uri("/var/data/test.db"), "sqlite");
        assert_eq!(detect_engine_from_uri("redis://:pass@localhost:6379/0"), "redis");
        assert_eq!(detect_engine_from_uri("rediss://:pass@remote:6379"), "redis");
    }

    #[test]
    fn test_redis_command_parser() {
        let tokens = parse_redis_command("SET \"user key\" 'hello world'");
        assert_eq!(tokens, vec!["SET", "user key", "hello world"]);

        let tokens2 = parse_redis_command("HGETALL app:settings");
        assert_eq!(tokens2, vec!["HGETALL", "app:settings"]);
    }

    #[test]
    fn test_sqlite_bundled_connection() {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory sqlite should open");
        let ver: String = conn
            .query_row("SELECT sqlite_version()", [], |r| r.get(0))
            .expect("sqlite_version query");
        assert!(!ver.is_empty(), "SQLite version should not be empty");
    }
}

