/**
 * dsh-ocgo-usage locale dictionaries (zh/en).
 * @module dsh-ocgo-usage/client/locales
 */
/** Dictionary namespace this package registers. */
export declare const NS = "ocgo";
/** Chinese copy. */
export declare const zh: {
    readonly 'ocgo.unavailable': "用量不可用";
    readonly 'ocgo.error': "查询失败：{code}";
    readonly 'ocgo.noconfig': "未配置：请在「设置 → OpenCode Go 用量」里填入 API key，或设置 OPENCODE_GO_API_KEY";
    readonly 'ocgo.refresh': "刷新";
    readonly 'ocgo.fetchedAt': "upd {time}";
    readonly 'ocgo.rolling': "5h 滚动";
    readonly 'ocgo.weekly': "每周";
    readonly 'ocgo.monthly': "每月";
    readonly 'ocgo.rateLimited': "已限流";
    readonly 'ocgo.resetsIn': "剩余 {duration}";
    readonly 'ocgo.expand': "展开用量详情";
    readonly 'ocgo.collapse': "收起";
    readonly 'ocgo.sep': "·";
    readonly 'ocgo.set': "设置";
    readonly 'ocgo.save': "保存";
    readonly 'ocgo.apiKey': "API key";
    readonly 'ocgo.setHint': "点击外部或按 Esc 保存";
    readonly 'ocgo.settingsNav': "OpenCode Go";
    readonly 'ocgo.settingsTitle': "OpenCode Go 用量";
    readonly 'ocgo.settingsIntro': "用量直接读取 OpenCode Go 的 /usage 接口，用的是你选模型时同一个 API key —— 不再需要浏览器 cookie。";
    readonly 'ocgo.credentials': "取数凭证";
    readonly 'ocgo.keySource': "当前生效的 key 来自：{source}";
    readonly 'ocgo.keyMissing': "当前没有可用的 key：凭据库里没有，也没有本地覆盖。";
    readonly 'ocgo.credentialsHint': "这里填写的 key 会写入 $DSH_HOME/ocgo-usage.json 并优先使用；清除后回退到 DSH 凭据库里的 OPENCODE_GO_API_KEY / OPENCODE_API_KEY。";
    readonly 'ocgo.currentUsage': "当前用量";
    readonly 'ocgo.test': "测试连接";
    readonly 'ocgo.working': "处理中…";
    readonly 'ocgo.saved': "已保存";
    readonly 'ocgo.cleared': "已清除本地覆盖，回退到凭据库";
    readonly 'ocgo.saveFailed': "保存失败";
    readonly 'ocgo.loadFailed': "读取配置失败";
    readonly 'ocgo.noChanges': "没有改动";
    readonly 'ocgo.testOk': "连接正常";
    readonly 'ocgo.clear': "清除";
    readonly 'ocgo.securityNote': "API key 等同于账号凭据。它只保存在 host 侧，页面永远只看到末尾 4 位的掩码。";
    readonly 'ocgo.visibility': "输入框展示";
    readonly 'ocgo.visAlways': "常驻展示用量";
    readonly 'ocgo.visAlwaysHint': "只要配置了 key 就显示，与当前用哪个模型无关";
    readonly 'ocgo.visProvider': "使用 opencode-go 才展示";
    readonly 'ocgo.visProviderHint': "仅当前模型走 opencode-go provider 时显示";
    readonly 'ocgo.visNever': "不展示用量";
    readonly 'ocgo.visNeverHint': "输入框不显示；本设置页仍可查看";
    readonly 'ocgo.visSaved': "已更新显示方式";
};
/** English copy. */
export declare const en: {
    readonly 'ocgo.unavailable': "usage unavailable";
    readonly 'ocgo.error': "Query failed: {code}";
    readonly 'ocgo.noconfig': "Not configured: paste an API key in Settings → OpenCode Go usage, or set OPENCODE_GO_API_KEY";
    readonly 'ocgo.refresh': "Refresh";
    readonly 'ocgo.fetchedAt': "upd {time}";
    readonly 'ocgo.rolling': "5h Rolling";
    readonly 'ocgo.weekly': "Weekly";
    readonly 'ocgo.monthly': "Monthly";
    readonly 'ocgo.rateLimited': "rate-limited";
    readonly 'ocgo.resetsIn': "resets in {duration}";
    readonly 'ocgo.expand': "Show usage details";
    readonly 'ocgo.collapse': "Collapse";
    readonly 'ocgo.sep': "·";
    readonly 'ocgo.set': "Set";
    readonly 'ocgo.save': "Save";
    readonly 'ocgo.apiKey': "API key";
    readonly 'ocgo.setHint': "click outside or press Esc to save";
    readonly 'ocgo.settingsNav': "OpenCode Go";
    readonly 'ocgo.settingsTitle': "OpenCode Go usage";
    readonly 'ocgo.settingsIntro': "Usage is read straight from the OpenCode Go /usage API with the same API key your model selection uses — no browser cookie involved.";
    readonly 'ocgo.credentials': "Fetch credential";
    readonly 'ocgo.keySource': "The effective key comes from: {source}";
    readonly 'ocgo.keyMissing': "No usable key: neither the credentials store nor a local override supplies one.";
    readonly 'ocgo.credentialsHint': "A key pasted here is stored in $DSH_HOME/ocgo-usage.json and takes precedence; clearing it falls back to OPENCODE_GO_API_KEY / OPENCODE_API_KEY in the DSH credentials store.";
    readonly 'ocgo.currentUsage': "Current usage";
    readonly 'ocgo.test': "Test connection";
    readonly 'ocgo.working': "Working…";
    readonly 'ocgo.saved': "Saved";
    readonly 'ocgo.cleared': "Local override cleared; falling back to the credentials store";
    readonly 'ocgo.saveFailed': "Save failed";
    readonly 'ocgo.loadFailed': "Could not read the configuration";
    readonly 'ocgo.noChanges': "No changes";
    readonly 'ocgo.testOk': "Connection OK";
    readonly 'ocgo.clear': "Clear";
    readonly 'ocgo.securityNote': "The API key is an account credential. It stays host-side; the page only ever sees the last-4 mask.";
    readonly 'ocgo.visibility': "Composer display";
    readonly 'ocgo.visAlways': "Always show usage";
    readonly 'ocgo.visAlwaysHint': "Shown whenever a key is configured, whichever model is selected";
    readonly 'ocgo.visProvider': "Only while using opencode-go";
    readonly 'ocgo.visProviderHint': "Shown only when the current model runs on the opencode-go provider";
    readonly 'ocgo.visNever': "Never show usage";
    readonly 'ocgo.visNeverHint': "Hidden from the composer; this settings page still reports it";
    readonly 'ocgo.visSaved': "Display mode updated";
};
/** Key type of the dictionary (for the LocaleNamespaceMap merge). */
export type OcgoKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map