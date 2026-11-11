// 网易云音乐签到抓会话（QX script-request-body 专用，自研修复版）
// 用途：只负责抓会话，不负责签到。签到仍走 chavyleung 的 neteasemusic.js
// （任务里的网易云音乐签到不动），两者共用同一份 $prefs 存储，任务能直接读到。
//
// 为什么要另写一个：原脚本（chavyleung neteasemusic.cookie.js）的问题不在逻辑，
// 而在它“跑起来才说话”——Safari 的请求如果根本没进 QX 解密（QUIC 嫌疑），
// 或用户在 Safari 里根本没登上（手机版页面藏了登录入口），它全程静默，
// 用户分不清是“没触发”“没登录”还是“抓错请求”。
// 本脚本：只要被触发，成功失败都弹通知、都写日志；还会校验登录态
// （Cookie 里必须有 MUSIC_U），没登录就直说，不让用户等到 00:03 任务失败才发现。
//
// 存储格式：和原脚本完全一致，写进 "chavy_cookie_neteasemusic"：
//   JSON.stringify({url, body, headers})，其中 url 必须是
//   https://music.163.com/weapi/user/level（任务脚本就是按这个 URL 认新版会话的，
//   换别的 URL 存进去任务会认错，所以本脚本只认这一条，别的请求不存）。
//
// 部署：推到 feng863364-bot/qx-config（main 分支，根目录），
// 然后把 qx-rewrite-local.snippet 里网易云那条抓取规则的脚本地址改成：
// https://raw.githubusercontent.com/feng863364-bot/qx-config/main/netease_cookie_capture.js
// 用户侧只需：QX 更新一下重写 → Safari 打开 music.163.com 登录
// → 再打开 music.163.com/#/user/level 停几秒 → 看到「获取会话：成功！」
// → 任务列表把「网易云音乐签到」加回来，明天 00:03 自己跑。
// 注意：网易云 App 不发这个请求，只能走 Safari 网页版；手机版页面没有登录入口时，
// 先用桌面版（地址栏 AA → 请求桌面网站）登录，或直接开 music.163.com/m/login。

var SCRIPT_NAME = "网易云音乐";

function log(msg) {
  console.log("[" + SCRIPT_NAME + "] " + msg);
}

(function () {
  try {
    if (typeof $request === "undefined" || !$request || !$request.url) {
      log("❌ 没有请求信息（重写没命中，或请求没走 QX 解密）");
      $notify(SCRIPT_NAME, "", "❌没抓到会话：没有请求信息，请确认重写已更新、QX 已重连");
      $done({});
      return;
    }

    var url = $request.url;
    log("抓会话：触发 URL " + url);

    // 只认等级接口这一条：任务脚本靠这个 URL 认新版会话，别的 URL 存进去会认错
    if (url.indexOf("music.163.com/weapi/user/level") === -1) {
      log("❌ 不是等级接口请求，不存（避免写坏任务要读的会话格式）");
      $notify(SCRIPT_NAME, "", "❌抓错请求了：这不是等级接口，请打开 music.163.com/#/user/level 再试");
      $done({});
      return;
    }

    var headers = $request.headers || {};
    var cookie = headers["Cookie"] || headers["cookie"] || "";
    if (!cookie) {
      log("❌ 请求里没有 Cookie 头（重写没命中，或请求没走 QX 解密——Safari 走 QUIC 时会这样）");
      $notify(SCRIPT_NAME, "", "❌没抓到会话：请求里没有 Cookie，请确认重写已更新、QX 已重连，再刷新等级页");
      $done({});
      return;
    }
    if (cookie.indexOf("MUSIC_U=") === -1) {
      log("❌ Cookie 里没有 MUSIC_U，Safari 里还没登录（长度 " + cookie.length + "）");
      $notify(SCRIPT_NAME, "", "❌没登录：Cookie 里没有 MUSIC_U，请先在 Safari 里登录网易云再打开等级页");
      $done({});
      return;
    }

    var session = {};
    session.url = url;
    session.body = $request.body || "";
    session.headers = {};
    for (var k in headers) {
      if (k.toLowerCase() !== "content-length") session.headers[k] = headers[k];
    }

    $prefs.setValueForKey(JSON.stringify(session), "chavy_cookie_neteasemusic");
    log("已写入会话，Cookie 长度 " + cookie.length + "，body 长度 " + (session.body || "").length);
    $notify(SCRIPT_NAME, "", "获取会话：成功！");
  } catch (err) {
    log("❌抓会话出现异常：" + err);
    $notify(SCRIPT_NAME, "", "获取会话：失败！原因：" + err);
  }
  $done({});
})();
