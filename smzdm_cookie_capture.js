// 什么值得买签到抓 Cookie（QX script-request-header 专用，修复版）
// 用途：只负责抓 Cookie，不负责签到。签到仍走原来的 blackmatrix7 归档脚本
// （任务里的 smzdm_daily.js 不动），两者共用同一份 $prefs 存储，任务能直接读到。
//
// 为什么要另写一个：原脚本 getWebOrAppCookie() 必须先调通用户信息接口
// （zhiyou.smzdm.com/jsonp_get_current）拿到 smzdm_id 才肯写 Cookie，接口一挂、
// Cookie 里没有 session_id/__ckguid、Cookie 不到 200 字符，都会静默抛错、
// 一个通知都不弹——昨晚就是这么失败的，任务随后 0.006 秒报错退出。
// 本脚本：Cookie 一到手先存好再说，用户信息接口不再是前置条件；成功失败都弹通知、
// 都写日志，方便定位。
//
// 部署：推到 feng863364-bot/qx-config（main 分支，根目录），
// 然后把 qx-rewrite-local.snippet 里最后一行改成：
// ^https?:\/\/user-api\.smzdm\.com\/checkin$ url script-request-header https://raw.githubusercontent.com/feng863364-bot/qx-config/main/smzdm_cookie_capture.js
// 用户侧只需：QX 更新一下重写 → 打开什么值得买 App 进一次签到页 → 看到 🎈 通知
// → 任务列表手动跑一次验证。

var SCRIPT_NAME = "什么值得买";

function log(msg) {
  console.log("[" + SCRIPT_NAME + "] " + msg);
}

function getCookie() {
  if (typeof $request === "undefined" || !$request || !$request.headers) return "";
  return $request.headers["Cookie"] || $request.headers["cookie"] || "";
}

// 按 MagicJS 的会话格式写 $prefs：{"magic_session":true,"<会话名>": 值}
// 任务脚本 multiUsersSignIn() 就是按这个格式找会话的。
function writeSession(prefsKey, session, value) {
  var data = {};
  try {
    data = JSON.parse($prefs.valueForKey(prefsKey) || "{}");
    if (!data || typeof data !== "object") data = {};
  } catch (e) {
    data = {};
  }
  data["magic_session"] = true;
  data[session] = value;
  $prefs.setValueForKey(JSON.stringify(data), prefsKey);
}

(function () {
  try {
    var cookie = getCookie();
    log("抓Cookie：请求头 Cookie 长度 " + cookie.length);

    if (!cookie) {
      log("❌ 请求里没有 Cookie 头（可能重写没命中，或请求没走 QX 解密）");
      $notify(SCRIPT_NAME, "", "❌没抓到Cookie：请求里没有 Cookie，请确认重写已更新并重进签到页");
      $done({});
      return;
    }

    // 会话名：优先用 Cookie 自带的 smzdm_id（和原脚本拿 userInfo.smzdm_id
    // 当会话名的行为一致），其次用 session_id/__ckguid 的 "k=v" 全串，
    // 都没有就用 default。
    // cookieId 单独存 "session_id=xxx" 全串（原脚本就是这么存的，
    // 只用于下次抓取时比对是否变化，签到本身不读它）。
    var session = "default";
    var cookieId = "";
    var mId = cookie.match(/(session_id|__ckguid)=([^;.]*)/i);
    if (mId && mId[0]) cookieId = mId[0].trim();
    var m = cookie.match(/smzdm_id=([^;.]*)/i);
    if (m && m[1]) {
      session = m[1].trim();
    } else if (cookieId) {
      session = cookieId;
    }

    var hasIdKey = /(session_id|__ckguid|smzdm_id)=/i.test(cookie);
    if (cookie.length < 200 && !hasIdKey) {
      log("❌ Cookie 太短（" + cookie.length + "字符）且无 session_id/__ckguid/smzdm_id，疑似未登录或抓错请求");
      $notify(SCRIPT_NAME, "", "❌没抓到有效Cookie：长度" + cookie.length + "，请确认已登录并重进签到页");
      $done({});
      return;
    }

    // 先落袋：不等任何别的接口，直接写两份（Cookie + CookieId），任务脚本按会话名读。
    writeSession("smzdm_cookie", session, cookie);
    writeSession("smzdm_cookie_id", session, cookieId || session);
    log("已写入 Cookie，会话名 " + session + "，长度 " + cookie.length);
    $notify(SCRIPT_NAME, "", "🎈获取Cookie成功！！");
  } catch (err) {
    log("❌抓Cookie出现异常：" + err);
    $notify(SCRIPT_NAME, "", "❌抓Cookie失败：" + err);
  }
  $done({});
})();
