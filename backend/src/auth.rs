use crate::db::get_conn;
use crate::models::User;
use anyhow::{anyhow, Result};
use poem::{http::HeaderMap, Request};
use std::collections::HashMap;
use std::sync::Mutex;

pub static TOKEN_STORE: Mutex<Option<HashMap<String, User>>> = Mutex::new(None);

pub fn ensure_store() {
    let mut g = TOKEN_STORE.lock().unwrap();
    if g.is_none() {
        *g = Some(HashMap::new());
    }
}

pub fn store_token(token: &str, user: User) {
    ensure_store();
    let mut g = TOKEN_STORE.lock().unwrap();
    g.as_mut().unwrap().insert(token.to_string(), user);
}

pub fn decode_token(token: &str) -> Result<User> {
    ensure_store();
    let g = TOKEN_STORE.lock().unwrap();
    g.as_ref()
        .unwrap()
        .get(token)
        .cloned()
        .ok_or_else(|| anyhow!("无效 token"))
}

pub fn get_token_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_start_matches("Bearer ").trim().to_string())
}

pub fn current_user(req: &Request) -> Result<User> {
    let token = get_token_from_headers(req.headers()).ok_or_else(|| anyhow!("未登录"))?;
    decode_token(&token)
}

pub fn login(username: &str, password: &str) -> Result<(String, User)> {
    ensure_store();
    let conn = get_conn();
    let mut stmt = conn.prepare(
        "SELECT id, username, role, display_name, created_at, password FROM users WHERE username = ?1",
    )?;
    let mut rows = stmt.query(rusqlite::params![username])?;
    let row = rows.next()?.ok_or_else(|| anyhow!("用户不存在"))?;

    let stored_pwd: String = row.get(5)?;
    if stored_pwd != password {
        return Err(anyhow!("密码错误"));
    }

    let user = User {
        id: row.get(0)?,
        username: row.get(1)?,
        role: row.get(2)?,
        display_name: row.get(3)?,
        created_at: row.get(4)?,
    };

    let token = format!("tk-{}", uuid::Uuid::new_v4());
    store_token(&token, user.clone());
    Ok((token, user))
}

pub fn require_role(user: &User, roles: &[&str]) -> Result<()> {
    if !roles.contains(&user.role.as_str()) {
        return Err(anyhow!("无权限执行此操作，当前角色：{}", user.role));
    }
    Ok(())
}
