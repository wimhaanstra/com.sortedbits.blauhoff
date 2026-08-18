# CFE / Smart Energy PLAT findings

## What the hardware is

These are CF Energy residential batteries with a **Hi-Flying HF-LPD130E** WiFi module (confirmed on `10.210.5.21`, firmware V1.12, web UI 1.0.14).

The phone app **Smart Energy PLAT** does not talk to the battery on the LAN for telemetry. The module is a UART-to-TCP bridge:

- BMS UART: 115200 8N1
- Socket mode: **TCP Client**
- Cloud: **`47.88.9.64:9090`** (Alibaba Cloud; TCP, no HTTP banner)

That is why local TCP **9090 is closed** on the battery. Port 9090 is the *destination* the module connects to, not a listen port. The `#909090` in the web UI CSS is a gray color, unrelated.

Local TCP 8899 is also closed because the module is in client mode, not TCP-server mode. Switching it to TCP server would break the official app.

## Local HTTP (module config only)

`http://10.210.5.21/` is the Hi-Flying config UI.

- Unauthenticated: `401`, `WWW-Authenticate: Basic realm="USER LOGIN"`, `Server: HTTPD`
- Documented default login: **`admin` / `admin`**
- After login it pretends to be `Microsoft-IIS/5.0`
- Pages: system info, STA/AP WiFi, serial/network socket, account, OTA, reboot, factory reset
- This UI does **not** expose SOC / voltage / current. Those stay on the UART and are uploaded to the cloud.

Useful probe:

```
npx tsx src/index.ts probe-local 10.210.5.21
```

## Cloud API (same as the app)

The Android app (`com.cfenergygroup.smartenergy` 1.2.2, uni-app) uses:

- Base: `https://smartenergy.cfe-group.cn`
- `Content-Type: application/x-www-form-urlencoded`
- Auth header after login: `token: <userinfo.token>`
- Success: `code === 1`

Login (user role):

```
POST /api/user/login
account=<email or username>
password=<password>
```

Telemetry:

```
POST /api/user/battery_list     page, pagesize, status, battery_number
POST /api/user/battery_detail   battery_id
POST /api/user/battery_monitor  battery_id
```

Other useful endpoints: `/api/user/battery_count`, `/api/user/battery_fault`, `/api/index/timezone`, `/api/index/online_status`.

Public check (no login) already works: `/api/index/timezone` returns `code: 1`.

Live login on this account succeeded. Three packs named BLH, all Online. Useful monitor fields:

- `battery_detail.battery_number`, `is_host`, firmware versions
- `battery_data.soc`, `soh`, `total_voltage`, `total_current`, `charge_discharge_status`
- `battery_data.single_voltage.voltage[]` (mV)
- `battery_data.cell_temperature.cell_temperature[]` (°C)
- Host pack also returns `battery_info` with stack totals (here ~157 V / three 52 V modules)

```
npx tsx src/index.ts probe-cloud
```

Set `PLAT_ACCOUNT` and `PLAT_PASSWORD` in `.env` (same login as the iOS app). Homey can later collect those from the user.

## Probe runs

Newest runs are appended below.

## 2026-08-18T05:58:20.779Z

### Hi-Flying UDP discovery (48899)
- no replies

### 10.210.5.21
- open TCP: 80
- HTTP:
  - 200 http://10.210.5.21:80/ (text/html) <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"> <html xmlns="http://www.w3.org/1999/xhtml"> <head> <meta http-equiv="Content-Type" content="text/html; charset=gb2312"…
  - FAIL http://10.210.5.21:80/api fetch failed
  - FAIL http://10.210.5.21:80/status fetch failed
  - FAIL http://10.210.5.21:80/info fetch failed
  - FAIL http://10.210.5.21:80/cell fetch failed
- Hi-Flying: HF-LPD130E V1.12 mode=APSTA STA=energy/10.210.5.21 socket=TCP CLIENT 47.88.9.64:9090

## Cloud 2026-08-18T06:02:41.570Z

- API: https://smartenergy.cfe-group.cn
- login: Wim Haanstra (user)
- batteries: 3

- BLH id=44798 serial=1417907SLKOPG020040 host=No
  status=Online soc=68 soh=95
  pack V=52.30 A=-3.88 mode=discharge
  stack V=n/a A=n/a work=n/a
  ts=2026-08-18 06:01:38

- BLH id=44799 serial=1417907SLKOPG020113 host=Yes
  status=Online soc=68 soh=95
  pack V=52.30 A=-3.95 mode=discharge
  stack V=157.39 A=-3.93 work=Discharging
  ts=2026-08-18 06:01:38

- BLH id=46788 serial=1418330SLKOPG020269 host=No
  status=Online soc=68 soh=96
  pack V=52.60 A=-4.00 mode=discharge
  stack V=n/a A=n/a work=n/a
  ts=2026-08-18 06:01:38

## Cloud 2026-08-18T06:06:22.497Z

- API: https://smartenergy.cfe-group.cn
- login: Wim Haanstra (user)
- batteries: 3

- BLH id=44798 serial=1417907SLKOPG020040 host=No
  status=Online soc=68 soh=95
  pack V=52.30 A=-3.89 mode=discharge
  stack V=n/a A=n/a work=n/a
  ts=2026-08-18 06:04:54

- BLH id=44799 serial=1417907SLKOPG020113 host=Yes
  status=Online soc=68 soh=95
  pack V=52.30 A=-3.91 mode=discharge
  stack V=157.39 A=-3.93 work=Discharging
  ts=2026-08-18 06:04:54

- BLH id=46788 serial=1418330SLKOPG020269 host=No
  status=Online soc=67 soh=96
  pack V=52.50 A=-3.91 mode=discharge
  stack V=n/a A=n/a work=n/a
  ts=2026-08-18 06:04:54

## Cloud 2026-08-18T06:08:11.233Z

- API: https://smartenergy.cfe-group.cn
- login: Wim Haanstra (user)
- batteries: 3

- BLH id=44798 serial=1417907SLKOPG020040 host=No
  status=Online soc=68 soh=95
  pack V=52.30 A=-3.73 mode=discharge
  stack V=n/a A=n/a work=n/a
  cells V (16): 3.272 3.273 3.273 3.274 3.273 3.274 3.273 3.273 3.270 3.272 3.272 3.273 3.273 3.273 3.272 3.271  min=3.270 #8 max=3.274 #3 Δ=4mV
  cells T (3): 20°C 21°C 21°C
  ts=2026-08-18 06:08:09

- BLH id=44799 serial=1417907SLKOPG020113 host=Yes
  status=Online soc=67 soh=95
  pack V=52.30 A=-3.71 mode=discharge
  stack V=157.25 A=-3.76 work=Discharging
  cells V (16): 3.270 3.270 3.270 3.271 3.271 3.271 3.271 3.271 3.271 3.272 3.272 3.272 3.276 3.276 3.277 3.276  min=3.270 #0 max=3.277 #14 Δ=7mV
  cells T (3): 20°C 20°C 20°C
  ts=2026-08-18 06:08:09

- BLH id=46788 serial=1418330SLKOPG020269 host=No
  status=Online soc=67 soh=96
  pack V=52.50 A=-3.76 mode=discharge
  stack V=n/a A=n/a work=n/a
  cells V (16): 3.283 3.280 3.282 3.283 3.282 3.281 3.288 3.287 3.278 3.279 3.289 3.284 3.283 3.287 3.285 3.282  min=3.278 #8 max=3.289 #10 Δ=11mV
  cells T (3): 20°C 20°C 20°C
  ts=2026-08-18 06:08:09

## Cloud 2026-08-18T06:08:51.741Z

- API: https://smartenergy.cfe-group.cn
- login: Wim Haanstra (user)
- batteries: 3

- BLH id=44798 serial=1417907SLKOPG020040 host=No
  status=Online soc=68 soh=95
  pack V=52.30 A=-3.62 mode=discharge
  stack V=n/a A=n/a work=n/a
  cells V (16): 3.272 3.273 3.273 3.274 3.273 3.274 3.273 3.273 3.271 3.273 3.272 3.274 3.273 3.273 3.272 3.272  min=3.271 #8 max=3.274 #3 Δ=3mV
  cells T (3): 20°C 21°C 21°C
  ts=2026-08-18 06:08:51

- BLH id=44799 serial=1417907SLKOPG020113 host=Yes
  status=Online soc=67 soh=95
  pack V=52.30 A=-3.67 mode=discharge
  stack V=157.25 A=-3.71 work=Discharging
  cells V (16): 3.270 3.270 3.270 3.271 3.271 3.271 3.271 3.271 3.271 3.272 3.272 3.272 3.276 3.276 3.277 3.276  min=3.270 #0 max=3.277 #14 Δ=7mV
  cells T (3): 20°C 20°C 20°C
  ts=2026-08-18 06:08:51

- BLH id=46788 serial=1418330SLKOPG020269 host=No
  status=Online soc=67 soh=96
  pack V=52.50 A=-3.71 mode=discharge
  stack V=n/a A=n/a work=n/a
  cells V (16): 3.284 3.280 3.283 3.282 3.282 3.281 3.287 3.287 3.277 3.279 3.289 3.284 3.283 3.287 3.285 3.282  min=3.277 #8 max=3.289 #10 Δ=12mV
  cells T (3): 20°C 20°C 20°C
  ts=2026-08-18 06:08:51

