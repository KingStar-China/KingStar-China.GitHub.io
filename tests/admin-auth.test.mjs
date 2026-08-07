import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const adminPage = await readFile(new URL("../public/admin/index.html", import.meta.url), "utf8");
const adminSchema = await readFile(new URL("../supabase/public_sites_admin.sql", import.meta.url), "utf8");

test("公网后台不提供管理员自助注册", () => {
  assert.doesNotMatch(adminPage, /data-action="sign-up"|\/auth\/v1\/signup|ADMIN_EMAIL/);
});

test("后台使用用户 UUID 检查管理员身份", () => {
  assert.match(adminPage, /admin_users\?user_id=eq\./);
  assert.match(adminPage, /select=user_id/);
  assert.doesNotMatch(adminPage, /admin_users\?email=eq\./);
});

test("后台会刷新和撤销 Supabase 会话", () => {
  assert.match(adminPage, /grant_type=refresh_token/);
  assert.match(adminPage, /\/auth\/v1\/logout/);
  assert.match(adminPage, /expiresAt/);
});

test("公共网站写权限只认 auth uid", () => {
  assert.match(adminSchema, /user_id uuid/);
  assert.match(adminSchema, /references auth\.users\(id\) on delete cascade/);
  assert.match(adminSchema, /to authenticated/);
  assert.match(adminSchema, /\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(adminSchema, /auth\.jwt\(\).*email/);
});
