# 华视 CVR-100U 读卡器接入指南

> 适用型号：**华视 CVR-100U**（USB 二代证阅读器）。目标：让物业租赁综合管理系统真实读取身份证信息。
> 本指南随产品 v1.0.4 更新：SDK 已升级为华视最新开发包（支持居民身份证、外国人永居证、港澳台居住证、新版外国人等证件，含指纹），并改为结构化 API 取数，不再依赖 wz.txt 文件。
> 修订（2026-09-11）：修复 **SDK 缓冲区结尾 NUL** 导致真实读卡报 `SQLITE_ERROR: unrecognized token` 的问题（详见第六节），并新增**读卡失败诊断日志**。

## 一、关键事实（已实测验证）

1. **应用是 64 位进程，华视 SDK 的 DLL 是 32 位**——进程内 FFI 无法加载。因此系统采用**方案 X：spawn 一个 32 位 Python（card_bridge.py）子进程**加载 Termb.dll 读卡，结果以 UTF-8 JSON 回传给 64 位主进程，绕开位宽限制。
2. **新版 SDK（Termb.dll 3.78MB）导出完整的 `GetPeople*` 结构化接口**（GetPeopleName / GetPeopleIDCode / GetPeopleSex / GetPeopleNation / GetPeopleBirthday / GetPeopleAddress / GetDepartment / GetStartDate / GetEndDate / GetPeopleChineseName / Getbase64BMPData / GetCertType 等），读卡后直接经这些接口取字段，**不再依赖 wz.txt/zp.bmp 落盘中间文件**。
3. 新版 SDK 支持读取**多类证件**：居民身份证、外国人永居证、港澳台居民居住证、新版外国人（通过 `GetCertType` 返回 空 / "I" / "J" / "Y" 区分）。默认仅取出核心字段（姓名/性别/民族/出生/地址/身份证号/签发机关/有效期/相片）填入租客表单。
4. 通讯口：`CVR_InitComm(port)`，1~16 = COM 串口，**1001~1016 = USB 口**。华视 CVR-100U 为 USB，默认 **1001**。
5. 相片读取依赖 `license.dat` 授权文件（缺失时无法生成相片）。

## 二、需要哪些文件

SDK 与桥已随安装包分发在 `runtime/idcard/`（electron-builder extraResources 从磁盘打包），**部署无需手工放置**：

| 文件 | 作用 | 是否必需 |
|------|------|---------|
| Termb.dll | 核心读卡 API（新版，含 GetPeople*） | 必需 |
| sdtapi.dll | 安全模块通讯库 | 必需 |
| WltRS.dll | 相片解码库 | 建议 |
| DLL_File.dll | 新版 SDK 附带动态库 | 建议 |
| license.dat | 授权文件（出相片必需） | 建议 |
| card_bridge.py | 32 位读卡桥（系统自带） | 必需(系统) |

> 说明：早期 SDK 用 `termb.lic`，新版用 `license.dat`。dll_dir 里放齐 Termb.dll / sdtapi.dll / WltRS.dll / DLL_File.dll / license.dat + card_bridge.py 即可。

## 三、32 位 Python（读卡桥运行时）

方案 X 依赖一个 **32 位 Python** 解释器（ctypes，纯标准库）。系统默认从以下路径解析：

| 场景 | 路径 |
|------|------|
| 生产 | 应用安装目录旁 `runtime/python-x86/python.exe`（随安装包分发） |
| 开发 | 仓库 `runtime/python-x86/python.exe` |

> 若位置不同，在「身份证读卡器 → 高级设置」里设 `Python 桥` 指向 32 位 python.exe 即可。

## 四、系统里怎么配（v1.0.4 起：在读卡器页配置，无需进系统参数中心）

打开系统 → **系统设置 → 身份证读卡器**：

### 1. 切换读卡模式

页面顶部「**读卡模式**」单选：

- **演示模式**（默认）：返回内置演示身份（张伟），用于无硬件时演示建档流程，结果明确标注为演示数据。
- **真实读卡器**：接入华视 CVR-100U 真实读卡器，需读卡器已连接且驱动已装。切换需**管理员权限 + 登录密码二次确认**。

### 2. 高级设置（一般保持默认）

页面「**读卡器高级设置**」卡片，含：通讯端口（默认 1001，USB 口 1）、是否读取相片、SDK 目录、Python 桥路径（后两者留空使用内置默认）。

## 五、读卡流程（系统已内置）

`RealIdCardProvider` 会 spawn 32 位 `card_bridge.py`，流程：

    CVR_InitComm(port) → CVR_Authenticate() → CVR_Read_Content(1)
        → GetPeopleName / IDCode / Sex / Nation / Birthday / Address / Department / StartDate / EndDate
        → Getbase64BMPData(相片 base64) → UTF-8 JSON 回传

读完自动把 姓名/性别/民族/出生/住址/身份证号/签发机关/有效期/相片 填进租客表单。

## 六、数据规范化与必知陷阱（2026-09-11 修订）

### 1. 字段规范化

桥返回的字段在 `RealIdCardProvider` 内统一整理后再进业务：

| 字段 | 处理 |
|------|------|
| 出生日期 / 有效期起 / 有效期止 | 8 位日期（如 `20000204`）统一规范化为 `YYYY-MM-DD`（如 `2000-02-04`） |
| 有效期 | 优先取 `GetStartDate` / `GetEndDate`；仅当两者缺省时才回退拆分 `dateRange` |
| 身份证号 | 剔除 NUL/控制字符后 trim（见第 2 条） |

### 2. 陷阱：SDK 缓冲区结尾的 NUL 字节（曾导致读卡报 SQLITE_ERROR）

**症状**：接上读卡器真实读卡时报

    SQLITE_ERROR: unrecognized token: "'440513200002045032"

且读卡日志里的身份证号尾部带一个看不见的字符。

**根因**：华视 SDK 的 `GetPeopleIDCode` 缓冲区**结尾带 `\0`（NUL）**。桥接（Python→JSON→Node）后若不剔除，身份证号会变成 19 字符（18 位 + `\0`）。而 Sequelize 的 sqlite 方言会把 `WHERE` 的值**内联**进 SQL 字符串（`= '...'` 而非绑定参数），SQLite 的 tokenizer 把 **NUL 当作字符串结束**，于是 SQL 在 NUL 处被截断、收尾的 `'` 丢失 → `unrecognized token`。

**修复（纵深防御，v1.0.4 2026-09-11 修订起）**：

1. `runtime/idcard/card_bridge.py` 的 `call_str_getter`：`raw.rstrip(b'\x00')` + 解码后再 `replace('\x00', '')`；
2. `backend/src/services/id-card-service.ts` 导出 `sanitizeIdNumber()`（剔 `[\u0000-\u001f\u007f]` 后 trim），在 `checkDuplicateIdNumber()`（内联 SQL 的入口）与 `readCard()` 拿到卡数据后调用；
3. `backend/src/services/id-card-provider.ts` 在数据源头剔除；
4. `backend/src/routes/tenants.ts` 创建租客前清理 `req.body.idNumber`。

> 通用原则：**任何把设备/用户提供的字符串内联进 SQL 之前，先剔除 NUL 等控制字符**。

### 3. 读卡失败诊断日志

`readCard()` 出错时会把**完整错误信息 + 完整 SQL + 报错堆栈**写入：

- `安装目录\resources\backend\logs\id-card-error.log`（JSON 行，每次失败一行）
- 同时 `console.error` 输出 → 进后端启动日志 `%APPDATA%\property-rental-system\logs\startup-*.log` 的 `[读卡失败]` 段
- 读卡日志页「失败原因」列也保存**完整 SQL**（不再截断）

排查读卡问题时先看这两处。

## 七、装机步骤（部署到目标电脑）

1. **安装华视 CVR-100U 的 USB 内核驱动**：
   - 打开「系统设置 → 身份证读卡器」，在「**读卡器驱动（华视 CVR-100U / Windows）**」卡片点【检测】，查看「驱动器状态 / 设备识别 / 内置驱动包」三项。
   - 若「内置驱动包」为「已随包分发」而「驱动器状态」为「未安装」，点【**安装驱动（需管理员）**】，在 Windows 授权框点「是」。系统用 `pnputil /add-driver USBDrvCo.inf /install` 一键安装并即时绑定读卡器。
   - 装完再点【检测】，应显示「已安装 / 已识别设备」。（应用内置华视 V3.5 64 位 WHQL 签名驱动：`runtime/idcard-driver` 的 USBDrv.sys / USBDrvCo.inf / sdt_s_drv_x64.cat / samcoins.dll / USBDrv3.0-x64.msi）
2. 确认 `runtime/idcard/`（SDK + 桥 + license.dat）与 `runtime/python-x86/`（32 位 Python）随包分发存在。
3. 读卡器页顶部「读卡模式」切到「**真实读卡器**」。
4. 测试：把身份证放在读卡器上，点设备行的【测试读卡】，应弹出读到的身份信息。

## 八、常见问题

| 现象 | 处理 |
|------|------|
| CVR_InitComm(...) 返回 0 | 读卡器未连接 / USB 驱动未装好 / 端口号不对（CVR-100U 用 1001） |
| CVR_Authenticate 失败 | 身份证没放正或已读取过，移走重新放置 |
| 启动读卡桥失败 … python.exe ENOENT | 高级设置里 Python 桥路径不对（需 32 位 python.exe） |
| 未找到 card_bridge.py / Termb.dll | SDK 目录没放齐 / 高级设置里 SDK 目录配错 |
| 读不出相片 | license.dat 未随包分发或未授权，检查 runtime/idcard/license.dat |
| 读卡结果乱码 | 桥已内置 GBK/UTF-8 解码；仍乱码请把现象发来 |
| 读卡报 `SQLITE_ERROR: unrecognized token` | 旧包 bug：SDK 缓冲区结尾 NUL 被内联进 SQL 导致语句截断。请升级到含 2026-09-11 修订的 v1.0.4（桥与服务层均已剔除 NUL）；细节查 `logs/id-card-error.log` |

> 实际验证：开发机未接读卡器时读卡，桥能正确返回 `CVR_InitComm` 失败（返回 0）的友好提示；接上读卡器并装好驱动后即可读到真实证件。
