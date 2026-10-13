# 0002：凭证存 ctx.credentials 服务，不建 config.json

日期：2026-10-13

## Problem

PLAN.md 写的是「config.json，明文本机，不进 git」。明文文件有忘加 .gitignore 的事故面，也需要自维护一套读写与格式。

## Decision

所有凭证走 DSH Host 的 `ctx.credentials` 服务（落盘 `~/.dsh/.credentials.yaml`），不新建项目自有凭证文件。

## Alternatives considered

- config.json 明文（PLAN 原案）：事故面与自维护成本如上。
- ctx.credentials（选中）：官方机制，dsh-volcark-quota 已验证 `resolve/describe/set/unset` 四件套可用；同名环境变量天然优先；`describe()` 只回配置状态不回值，浏览器永远拿不到已存密钥。代价是依赖该服务存在于目标 profile（注入缺失时插件整体不激活，属可接受的显式失败），用户改凭证只能走页内表单或直接编辑 `~/.dsh/.credentials.yaml`。
