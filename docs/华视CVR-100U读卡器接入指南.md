# 华视 CVR-100U 读卡器接入指南

> 适用型号：**华视 CVR-100U**（USB 二代证阅读器）。目标：让物业租赁综合管理系统真实读取身份证信息。

## 一、关键事实（已对本机 SDK 实测验证）

1. **应用是 64 位进程，华视 SDK 的 DLL 是 32 位**——进程内 FFI（koffi）无法加载。
2. 因此系统采用**方案 X：spawn 一个 32 位 Python（card_bridge.py）子进程**加载 Termb.dll 读卡，结果以 UTF-8 JSON 回传给 64 位主进程，绕开位宽限制。
3. **Termb.dll 只导出** CVR_InitComm / CVR_Authenticate / CVR_Read_Content / CVR_CloseComm（没有 GetPeople* 字段 getter）。
4. CVR_Read_Content 读卡成功后，会在当前目录生成 wz.txt（9 行 GBK 文字）+ zp.bmp（相片）——由桥解析得到字段。
5. 通讯口：CVR_InitComm(port)，1~16=COM 串口，**1001~1016=USB 口**。华视 CVR-100U 为 USB，默认 **1001**。

## 二、需要哪些文件

把华视「二次开发包」复制到 id_card_dll_dir 配置指向的目录（本机已放置在 runtime/idcard/）：

| 文件 | 作用 | 是否必需 |
|------|------|---------|
| Termb.dll | 核心读卡 API | 必需 |
| sdtapi.dll | 安全模块通讯库 | 必需 |
| WltRS.dll | 相片解码库 | 建议 |
| card_bridge.py | 32 位读卡桥（系统自带） | 必需(系统) |
| termb.lic | 授权文件 | 建议 |

> 注意：早期资料写的是 UnPack.dll，但本机这套 V3.0 SDK 实际是 WltRS.dll。dll_dir 里放齐 Termb.dll / sdtapi.dll / WltRS.dll 即可。

## 三、32 位 Python（读卡桥运行时）

方案 X 依赖一个 **32 位 Python** 解释器（ctypes，纯标准库）。系统默认从以下路径解析：

| 场景 | 路径 |
|------|------|
| 生产 | 应用安装目录旁 runtime/python-x86/python.exe（随安装包分发） |
| 开发 | 仓库 runtime/python-x86/python.exe |

> 若位置不同，在系统参数里设 id_card_python_x86 指向 32 位 python.exe 即可。系统已把 x86 Python 放在 runtime/python-x86/。

## 四、系统里怎么配

打开系统 → **系统设置 → 系统参数中心** → 分组「系统」：

| 配置项 | 值 | 说明 |
|--------|----|------|
| id_card_provider | real | 真实读卡模式（默认 mock 是演示） |
| id_card_dll_dir | SDK 目录 | 如 安装目录/runtime/idcard |
| id_card_port | 1001 | USB 口 1（COM 串口则填 1~16） |
| id_card_python_x86 | 32 位 python.exe 路径 | 留空自动解析 runtime/python-x86 |
| id_card_photo | 1 | 是否读相片(zp.bmp)，1=读 0=不读 |

## 五、读卡流程（系统已内置）

RealIdCardProvider 会 spawn card_bridge.py（32 位），流程：

    CVR_InitComm(1001) → CVR_Authenticate() → CVR_Read_Content(1)
        → 解析 wz.txt（9 行：姓名/性别/民族/出生/地址/身份证号/签发机关/有效期段/住址）
        → 读取 zp.bmp 转 base64 → UTF-8 JSON 回传

读完自动把 姓名/性别/民族/出生/住址/身份证号/签发机关/有效期 填进租客表单。

## 六、装机步骤（部署到目标电脑）

1. **装华视 CVR-100U 的 USB 驱动**（设备管理器出现一个 COM 口）。
2. 把 Termb.dll / sdtapi.dll / WltRS.dll / termb.lic 放入 runtime/idcard/（安装目录下，随包分发）。
3. 确认 runtime/python-x86/python.exe（32 位）存在。
4. 系统参数：id_card_provider=real、id_card_dll_dir=安装目录/runtime/idcard、id_card_port=1001。

## 七、常见问题

| 现象 | 处理 |
|------|------|
| CVR_InitComm(...) 失败 返回 0 | 读卡器未连接 / USB 驱动未装好 / 端口号不对（CVR-100U 用 1001） |
| CVR_Authenticate 失败 | 身份证没放正或已读取过，移走重新放置 |
| 启动读卡桥失败 ... python.exe ENOENT | id_card_python_x86 路径不对（需 32 位 python.exe） |
| 未找到 card_bridge.py | SDK 目录没放齐 / id_card_dll_dir 配错 |
| 读出来是乱码 | wz.txt 为 GBK，桥已内置解码；仍乱码把现象发我 |

> 实际验证：本机在未接读卡器时读卡，桥能正确返回 CVR_InitComm 失败返回 0 的友好提示。接上读卡器并装好驱动后即可读到真实身份证。
