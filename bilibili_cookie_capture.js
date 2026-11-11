// B站每日任务抓 Cookie（QX script-request-header 专用，自研修复版）
// 用途：只负责抓 Cookie，不负责做任务。做任务仍走 ClydeTime 的 BiliBili.js
// （任务里的 B站每日任务不动），两者共用同一份 $prefs 存储，任务能直接读到。
//
// 为什么要另写一个：原脚本（ClydeTime BiliBili.js 当抓取脚本用）的问题不在逻辑，
// 而在它“跑起来才说话”——Safari 的请求如果根本没进 QX 解密（QUIC 嫌疑），
// 它全程静默，用户分不清是“没触发”还是“Cookie 不合格”。
// 本脚本：只要被触发，成功失败都弹通知、都写日志；校验也更直白，
// 直接告诉你缺了 DedeUserID、SESSDATA 还是 bili_jct。
//
// 存储格式：和原脚本完全一致，写进 "bilibili_daily_bonus"：
//   {"cookie": {...解析后的键值...},
//    "cookieStr": "DedeUserID=...; DedeUserID__ckMd5=...; SESSDATA=...; bili_jct=...; sid=...",
//    "key": "<URL 里带的 access_key，没有就没有>"}
// 原有 Settings（比如投币次数设置）和 user/watch/share/coins 记录会原样保留，
// 只换 cookie / cookieStr / key 三项。
//
// 部署：推到 feng863364-bot/qx-config（main 分支，根目录），
// 然后把 qx-rewrite-local.snippet 里 B站那 4 条抓取规则的脚本地址改成：
// https://raw.githubusercontent.com/feng863364-bot/qx-config/main/bilibili_cookie_capture.js
// 用户侧只需：QX 更新一下重写 → Safari 打开 www.bilibili.com（登录状态）
// 停几秒 → 看到 🎈 通知 → 任务列表把「B站每日任务」加回来，明天 07:30 自己跑。
// 注意：国际版 B站 App 不发 Cookie（只发 access_key），App 内抓这条路是死的，
// 只能走 Safari 网页版。

var SCRIPT_NAME = "B站";

function log(msg) {
  console.log("[" + SCRIPT_NAME + "] " + msg);
}

function getCookie() {
  if (typeof $request === "undefined" || !$request || !$request.headers) return "";
  return $request.headers["Cookie"] || $request.headers["cookie"] || "";
}

// "k=v; k=v" 拆成对象
function string2object(cookie) {
  var obj = {};
  cookie.split("; ").forEach(function (val) {
    var idx = val.indexOf("=");
    if (idx > 0) obj[val.slice(0, idx)] = val.slice(idx + 1);
  });
  return obj;
}

(function () {
  try {
    var cookie = getCookie();
    log("抓Cookie：请求头 Cookie 长度 " + cookie.length);

    if (!cookie) {
      log("❌ 请求里没有 Cookie 头（重写没命中，或请求没走 QX 解密——Safari 走 QUIC 时会这样）");
      $notify(SCRIPT_NAME, "", "❌没抓到Cookie：请求里没有 Cookie，请确认重写已更新、QX 已重连，再刷新网页");
      $done({});
      return;
    }

    var obj = string2object(cookie);
    var missing = [];
    if (!obj.DedeUserID) missing.push("DedeUserID");
    if (!obj.SESSDATA) missing.push("SESSDATA");
    if (!obj.bili_jct) missing.push("bili_jct");
    if (missing.length > 0) {
      log("❌ Cookie 缺关键项：" + missing.join("、") + "（可能没登录，或抓错请求）");
      $notify(SCRIPT_NAME, "", "❌Cookie不完整：缺 " + missing.join("、") + "，请确认 Safari 里 B站已登录再刷新");
      $done({});
      return;
    }

    // 按原脚本的拼法组 cookieStr（DedeUserID__ckMd5 / sid 有才拼，没有不强求）
    var parts = ["DedeUserID=" + obj.DedeUserID];
    if (obj.DedeUserID__ckMd5) parts.push("DedeUserID__ckMd5=" + obj.DedeUserID__ckMd5);
    parts.push("SESSDATA=" + obj.SESSDATA);
    parts.push("bili_jct=" + obj.bili_jct);
    if (obj.sid) parts.push("sid=" + obj.sid);
    var cookieStr = parts.join("; ");

    // 读出现存配置，保留 Settings 和已有的任务记录，只换 Cookie 相关三项
    var config = {};
    try {
      config = JSON.parse($prefs.valueForKey("bilibili_daily_bonus") || "{}");
      if (!config || typeof config !== "object") config = {};
    } catch (e) {
      config = {};
    }
    config.cookie = obj;
    config.cookieStr = cookieStr;
    if (typeof $request !== "undefined" && $request && $request.url) {
      var mKey = $request.url.match(/access_key=([^&]*)/);
      if (mKey && mKey[1]) config.key = mKey[1];
    }
    if (!config.user) config.user = {};
    if (!config.watch) config.watch = {};
    if (!config.share) config.share = {};
    if (!config.coins) config.coins = {};

    $prefs.setValueForKey(JSON.stringify(config), "bilibili_daily_bonus");
    log("已写入 Cookie，用户 DedeUserID=" + obj.DedeUserID + "，长度 " + cookie.length);
    $notify(SCRIPT_NAME, "", "🎈获取Cookie成功！！");
  } catch (err) {
    log("❌抓Cookie出现异常：" + err);
    $notify(SCRIPT_NAME, "", "❌抓Cookie失败：" + err);
  }
  $done({});
})();
