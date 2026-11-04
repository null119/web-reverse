#!/usr/bin/env python3
"""
verify-offline.py — 服务端验收（Python 本地实现路线）：本地实现能否被服务器接受

定位（web-reverse 双闸门之二）：
  本脚本是本地实现路线在 Python 侧的服务端验收实现，
  与 run/verify-once.mjs（Node 侧）等价、二选一即可。无论用哪个，验收口径一致：
  本地实现生成参数 → 发真实请求 → 服务器【接受】（业务成功，非 403 / 非业务拒绝）。

成功的定义（唯一判据）：
  在【无浏览器】环境下由本地实现稳定产出被服务器接受。多轮均通过才算稳定
  （--rounds 1 仅单发通过，不构成稳定验收）。

授权分级（SKILL.md 红线 3，先于一切网络请求）：
  - 任务目录须存在 AUTHORIZATION.md 且任务属性勾选为 ①/②/③，目标 host 须落在
    授权范围内；否则一律 exit(4) 且不发出任何请求——此时完成判据降级为
    算法自检（verify-algo.py）+ 浏览器内一致性对比。
  - 属性 ④（公开合规研究）/未勾选/授权域不匹配：禁止服务端验收。
  - 本闸门约束的是【验收编排层】（本脚本与 run/verify-once.mjs）；impl.generate()
    是任意代码，若其自身发起网络请求不在本闸门拦截范围内——实现者须自行遵守红线 3。
  - --authorized-scope 仅在授权文件存在时作授权域补充（取并集），不能替代登记。

实现契约（与 verify-algo.py 共用同一签名）：
  generate(ctx: dict, pinned: dict | None = None) -> dict

用法：
  python scripts/verify/verify-offline.py --impl run/impl-xxx.py
  python scripts/verify/verify-offline.py --impl run/impl-xxx.py \
      --rounds 3 --interval-ms 3000 --authorization artifacts/tasks/<id>/AUTHORIZATION.md

每次真实放行的请求会向授权文件同目录 audit.log 追加一行留痕（红线 3 / 政策文档）。
按目标站点填写三个 TODO：build_context / build_request / is_accepted
"""
import argparse
import importlib.util
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlparse


# ----- 防捷径守卫：禁止引入浏览器自动化（那等于 RPC，不是本地实现） -----
_BANNED = {"playwright", "selenium", "pyppeteer", "DrissionPage",
           "undetected_chromedriver", "nodriver"}


def _assert_offline():
    leaked = _BANNED & set(sys.modules)
    if leaked:
        raise SystemExit(
            f"[verify] 检测到浏览器自动化模块 {leaked}：这是 RPC 捷径，不是本地实现交付。"
            f" 服务端验收要求本地实现。")


# ===================== 红线 3 授权闸门 =====================

CLASS_MARKS = {"①": 1, "②": 2, "③": 3, "④": 4}


def find_authorization(start_dir: str):
    """从 impl 所在目录向上最多 4 级探测 AUTHORIZATION.md。"""
    cur = os.path.abspath(start_dir or ".")
    for _ in range(4):
        cand = os.path.join(cur, "AUTHORIZATION.md")
        if os.path.isfile(cand):
            return cand
        parent = os.path.dirname(cur)
        if parent == cur:
            break
        cur = parent
    return None


def load_authorization(path: str):
    """解析任务属性勾选与授权范围。返回 (klass, hosts)；未勾选 klass=None。

    多勾 fail-closed：勾选数≠1 视为登记无效（klass=None → gate_class exit(4)），
    须重新登记后方可服务端验收（政策文档同款口径）。"""
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    klass = None
    hits = [num for mark, num in CLASS_MARKS.items() if re.search(r"\[x\]\s*" + re.escape(mark), text)]
    if len(hits) == 1:
        klass = hits[0]
    hosts = []
    scope = re.search(r"授权范围[^\n:：]*[：:]\s*([^\n]+)", text)
    if scope:
        for token in re.split(r"[,，;；\s]+", scope.group(1).strip()):
            if token and not token.startswith("<"):
                hosts.append(token)
    return klass, hosts


def gate_class(klass):
    if klass not in (1, 2, 3):
        print(f"[verify] 服务端验收被红线 3 拦截：AUTHORIZATION.md 任务属性 klass={klass}"
              "（须勾选 ①/②/③）。仅可执行算法自检（verify-algo.py）。")
        sys.exit(4)


def gate_host(allowed_hosts, target_host):
    hit = any(target_host == h or target_host.endswith("." + h) for h in allowed_hosts)
    if not hit:
        print(f"[verify] 服务端验收被红线 3 拦截：目标域 {target_host!r} 不在授权范围 {allowed_hosts}。"
              "仅可执行算法自检（verify-algo.py）。")
        sys.exit(4)


def audit_server_verify(auth_path: str, host: str, klass: int, scope_source: str, round_no: int, total: int):
    """服务端验收留痕：追加到授权文件同目录 audit.log（验收工具自动副作用，
    不属于模型过程记录义务——见 docs/reference/legal-and-case-safety-policy.md）。"""
    mark = "①②③"[klass - 1]
    line = (f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} server-verify "
            f"host={host} round={round_no}/{total} auth={mark} scope_source={scope_source}\n")
    try:
        with open(os.path.join(os.path.dirname(auth_path), "audit.log"), "a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError:
        print("[verify] warn: audit.log 留痕失败（不阻断）。", file=sys.stderr)


def load_impl(path: str):
    spec = importlib.util.spec_from_file_location("impl", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "generate"):
        raise SystemExit(f"[verify] {path} 必须暴露 generate(ctx, pinned=None) -> dict")
    return mod


# ===================== 按目标站点实现下面三个函数 =====================

def build_context() -> dict:
    """构造一次请求所需的上下文（每轮调用，应产生新鲜的随机/时间戳）。
    例如：{'url': ..., 'cookies': ..., 'body': ..., 'ts': now_ms()}"""
    raise NotImplementedError("TODO: 按目标站点构造请求上下文")


def build_request(ctx: dict, sign_params: dict):
    """把 generate() 产出的签名参数组装进真实请求并发送，返回 response。
    用 requests / httpx。"""
    raise NotImplementedError("TODO: 组装并发送真实请求")


def is_accepted(resp) -> bool:
    """判定服务器是否【接受】：业务成功标志，且非 403 / 非业务拒绝。
    例如：resp.status_code == 200 and resp.json().get('code') == 0"""
    raise NotImplementedError("TODO: 判定服务器是否接受")

# ====================================================================


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--impl", required=True, help="本地实现文件，暴露 generate(ctx, pinned=None)->dict")
    ap.add_argument("--rounds", type=int, default=5, help="验收轮数（默认5；多轮均通过才算稳定）")
    ap.add_argument("--interval-ms", type=int, default=3000, help="轮间间隔毫秒（默认3000，仅 rounds>1 生效）")
    ap.add_argument("--authorization", default=None, help="AUTHORIZATION.md 路径（缺省从 --impl 目录向上探测）")
    ap.add_argument("--authorized-scope", default=None, help="授权域补充（逗号分隔；仅与授权文件取并集，不能替代登记）")
    args = ap.parse_args()

    impl = load_impl(args.impl)
    _assert_offline()  # 加载实现后立刻检查：实现是否偷偷拉起了浏览器

    # 红线 3 闸门之一：授权文件存在 + 属性已勾选 ①②③（先于 build_context，仓库态可冒烟）
    auth_path = args.authorization or find_authorization(os.path.dirname(os.path.abspath(args.impl)))
    if not auth_path or not os.path.isfile(auth_path):
        print("[verify] 服务端验收被红线 3 拦截：未找到 AUTHORIZATION.md"
              "（基于 --impl 目录向上探测；可用 --authorization 指定）。"
              "先完成授权登记，或仅执行算法自检（verify-algo.py）。")
        sys.exit(4)
    klass, hosts = load_authorization(auth_path)
    if args.authorized_scope:
        hosts += [h for h in re.split(r"[,，\s]+", args.authorized_scope.strip()) if h]
    scope_source = "file" + ("+arg" if args.authorized_scope else "")
    gate_class(klass)

    ok = 0
    for i in range(args.rounds):
        ctx = build_context()
        # 红线 3 闸门之二：目标域必须在授权范围内（先于 generate/build_request，不发请求即拦）
        gate_host(hosts, urlparse(str(ctx.get("url", ""))).hostname or "")
        sign = impl.generate(ctx)          # 本地实现：每轮随机照常参与
        resp = build_request(ctx, sign)
        accepted = is_accepted(resp)
        ok += accepted
        host_now = urlparse(str(ctx.get("url", ""))).hostname or ""
        audit_server_verify(auth_path, host_now, klass, scope_source, i + 1, args.rounds)
        print(f"[round {i+1}/{args.rounds}] accepted={accepted}")
        if i + 1 < args.rounds and args.interval_ms > 0:
            time.sleep(args.interval_ms / 1000.0)

    rate = ok / args.rounds
    print(f"\n[verify] 通过率 {ok}/{args.rounds} = {rate:.0%}")
    if rate < 1.0:
        print("[verify] 未全部通过 → 实现或输入仍有问题，回实现与输入逐项排查。")
        sys.exit(1)
    if args.rounds == 1:
        print("[verify] OK 单发通过（单样本，不构成稳定验收；稳定验收需 --rounds ≥ 3）。")
    else:
        print("[verify] OK 验收通过：本地实现生成的参数被服务器稳定接受。")


if __name__ == "__main__":
    main()
