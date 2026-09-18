import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import net from "net";
import os from "os";

// ---- Live network probing utilities (zero-dependency TCP connect checks) ----
function probePort(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function probeHostReachability(host: string, ports: number[], timeoutMs = 800): Promise<number[]> {
  const results = await Promise.all(ports.map((p) => probePort(host, p, timeoutMs)));
  return ports.filter((_, i) => results[i]);
}

/** Non-internal IPv4 addresses of this machine, used to tag the local node on the map. */
function localIPv4Addresses(): string[] {
  const addresses: string[] = [];
  try {
    for (const infos of Object.values(os.networkInterfaces())) {
      for (const info of infos ?? []) {
        if (info.family === "IPv4" && !info.internal) addresses.push(info.address);
      }
    }
  } catch {
    // Interfaces unavailable — the map falls back to the static baseline.
  }
  return addresses;
}

interface DiscoveredHost {
  host: string;
  openPorts: number[];
  online: boolean;
}

/** Ports checked for hosts on the watch list. */
const WATCH_PROBE_PORTS = [22, 80, 443, 3000, 5173, 8080];
/** Upper bound on a single watch-list probe request. */
const WATCH_PROBE_MAX_HOSTS = 16;

/** Strict dotted-quad check, so a probe request can never target a hostname. */
function isIPv4(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "25mb" }));

// Lazy Gemini client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: "ok",
    agent: "Hermes-3-Alpha",
    environment: "Termux/Android-15",
    device: "Moto G5 Stylus (2025)",
    geminiAvailable: hasKey,
  });
});

// Telemetry state simulation
let liveTokensPerSec = 48.6;
let tokenCounter = 12450;

app.get("/api/telemetry/live", (_req, res) => {
  // Add slight organic jitter
  liveTokensPerSec = Math.max(18, Math.min(85, +(liveTokensPerSec + (Math.random() * 8 - 4)).toFixed(1)));
  tokenCounter += Math.floor(Math.random() * 25 + 5);

  const cpu = +(32 + Math.random() * 28).toFixed(1);
  const ramUsed = Math.floor(4800 + Math.random() * 450);
  const temp = +(34.2 + Math.random() * 2.8).toFixed(1);

  res.json({
    timestamp: Date.now(),
    cpuLoad: cpu,
    ramUsedMb: ramUsed,
    ramTotalMb: 8192,
    batteryPct: 84,
    batteryTempC: temp,
    tokensPerSec: liveTokensPerSec,
    tokenTotal: tokenCounter,
    networkLatencyMs: Math.floor(18 + Math.random() * 14),
    termuxProcsCount: 14,
    storageUsedGb: 48.2,
    storageTotalGb: 128.0,
  });
});

// Termux command executor
app.post("/api/termux/exec", (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== "string") {
    return res.status(400).json({ error: "Missing command parameter" });
  }

  const trimmed = command.trim();
  const startTime = Date.now();
  let output = "";
  let exitCode = 0;

  // Special commands that should use simulated output (security/safety)
  const simulatedCommands = [
    'termux-battery-status',
    'termux-wifi-connectioninfo',
    'pkg install',
    'apt install',
    'apt upgrade',
  ];

  const isSimulated = simulatedCommands.some(cmd => trimmed === cmd || trimmed.startsWith(cmd));

  if (isSimulated) {
    // Use simulated output for safety
    if (trimmed === "termux-battery-status") {
    output = JSON.stringify(
      {
        health: "GOOD",
        percentage: 84,
        plugged: "UNPLUGGED",
        status: "DISCHARGING",
        temperature: 34.6,
        current: -420,
      },
      null,
      2
    );
  } else if (trimmed === "termux-wifi-connectioninfo") {
    output = JSON.stringify(
      {
        bssid: "68:d7:9a:31:ec:04",
        frequency_mhz: 5745,
        ip: "192.168.1.139",
        link_speed_mbps: 866,
        mac_address: "02:00:00:00:00:00",
        network_id: 3,
        rssi: -48,
        ssid: "WAR_ROOM_SECURE_5G",
        supplicant_state: "COMPLETED",
      },
      null,
      2
    );
  } else if (trimmed.startsWith("pkg") || trimmed.startsWith("apt")) {
    output = `Checking package repositories... done.
All packages are up to date.
Architecture: aarch64 (Snapdragon Octa-Core)
Installed Hermes dependencies: python (3.11.8), nmap (7.94), git (2.44), nodejs (20.11), curl (8.6.0)`;
  } else if (trimmed.startsWith("ps") || trimmed.includes("htop")) {
    output = `USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
u0_a248   4120  2.1  1.4  42100 12040 pts/0    S+   18:40   0:04 hermes-daemon
u0_a248   4129  0.8  0.9  31800  7420 pts/0    S    18:41   0:01 termux-node-proxy
u0_a248   4150  1.4  1.8  55400 15120 pts/1    S+   18:42   0:02 python3 -m recon
u0_a248   4201  0.0  0.2   8900  1820 pts/0    R+   19:01   0:00 ps aux`;
  } else if (trimmed === "uname -a") {
    output = `Linux localhost 5.15.137-android14-moto-g5-stylus #1 SMP PREEMPT aarch64 Android`;
  } else if (trimmed === "df -h") {
    output = `Filesystem      Size  Used Avail Use% Mounted on
/dev/root        128G   48G   76G  39% /data/data/com.termux/files
tmpfs            3.8G  1.2M  3.8G   1% /dev`;
  } else if (trimmed.startsWith("nmap")) {
    output = `Starting Nmap 7.94 ( https://nmap.org ) at 2026-09-13 19:02 UTC
Nmap scan report for 192.168.1.1
Host is up (0.0028s latency).
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
443/tcp  open  https
3000/tcp open  hermes-c2
5173/tcp open  vite-dev
Nmap done: 1 IP address (1 host up) scanned in 1.42 seconds`;
  } else if (trimmed.startsWith("python") || trimmed.startsWith("python3")) {
    output = `[Hermes Python 3.11.8 Runtime]
Execution completed without runtime errors.
Output buffer: { 'status': 'OPTIMAL', 'target': 'aarch64', 'vector_dim': 768 }`;
  } else if (trimmed.startsWith("hermes")) {
    output = `================================================
HERMES AUTONOMOUS AGENT COMMAND SYSTEM v3.4.1
Callsign: HERMES-WARROOM-G5
Status: ONLINE | Target: Termux aarch64
Active Sub-Agents: Alpha (Recon), Bravo (Code), Delta (Audit)
Scratchpad reasoning: ENABLED | XML Tool Calling: ACTIVE
================================================`;
    } else {
      // For other commands, generate realistic simulated output based on command type
      if (trimmed.startsWith('ls')) {
        output = `total 48\ndrwxrwx--- 1 u0_a248 u0_a248    4096 Sep 13 18:40 .\ndrwxrwx--- 1 u0_a248 u0_a248    4096 Sep 13 18:00 ..\n-rw-rw---- 1 u0_a248 u0_a248     220 Sep 13 18:00 .bashrc\n-rw-rw---- 1 u0_a248 u0_a248     807 Sep 13 18:00 .profile\ndrwxrwx--- 1 u0_a248 u0_a248    4096 Sep 13 18:42 hermes\ndrwxrwx--- 1 u0_a248 u0_a248    4096 Sep 13 18:30 termux-tools\n-rwxrwx--- 1 u0_a248 u0_a248    1543 Sep 13 18:45 hermes-daemon.py\n`;
      } else if (trimmed.startsWith('cat ')) {
        output = `# Hermes War Room Configuration\nAGENT_CALLSIGN=HERMES-ALPHA\nNETWORK_INTERFACE=wlan0\nTELEMETRY_PORT=3000\nENCRYPTED_UPLINK=true\nBATTERY_PROFILE=BALANCED_TACTICAL\n`;
      } else if (trimmed.startsWith('echo ')) {
        output = trimmed.slice(5);
      } else if (trimmed.startsWith('pwd')) {
        output = '/data/data/com.termux/files/home';
      } else if (trimmed.startsWith('whoami')) {
        output = 'u0_a248';
      } else if (trimmed.startsWith('hostname')) {
        output = 'moto-g5-stylus';
      } else if (trimmed.startsWith('ifconfig') || trimmed.startsWith('ip addr')) {
        output = `wlan0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 192.168.1.139  netmask 255.255.255.0  broadcast 192.168.1.255\n        inet6 fe80::200:ff:fe00:0  prefixlen 64  scopeid 0x20<link>\n        ether 68:d7:9a:31:ec:04  txqueuelen 1000  (Ethernet)\n        RX packets 15234  bytes 18456789 (17.6 MiB)\n        TX packets 9876  bytes 1234567 (1.1 MiB)\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        loop  txqueuelen 1000  (Local Loopback)\n`;
      } else if (trimmed.startsWith('df')) {
        output = `Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        128G   48G   76G  39% /data/data/com.termux/files\ntmpfs            3.8G  1.2M  3.8G   1% /dev\ntmpfs            3.8G     0  3.8G   0% /dev/shm\n`;
      } else if (trimmed.startsWith('free')) {
        output = `               total        used        free      shared  buff/cache   available\nMem:        8192000     4890120     1245680      234560     2056200     2890120\nSwap:       2097152       51200     2045952\n`;
      } else if (trimmed.startsWith('netstat') || trimmed.startsWith('ss')) {
        output = `Active Internet connections (servers and established)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 127.0.0.1:3000          0.0.0.0:*               LISTEN      4120/hermes-daemon\ntcp        0      0 192.168.1.139:5173     0.0.0.0:*               LISTEN      4129/termux-node\ntcp        0      0 192.168.1.139:41234    192.168.1.1:443        ESTABLISHED 4150/python3\ntcp6       0      0 :::8080                 :::*                    LISTEN      4201/node\n`;
      } else if (trimmed.startsWith('grep')) {
        output = `HERMES_C2_ACTIVE=true\nTERMINAL_SESSION=pts/0\nAGENT_HEARTBEAT=52.4toks\n`;
      } else if (trimmed.startsWith('kill')) {
        exitCode = 0;
        output = `Process terminated successfully. (Signal: SIGTERM)`;
    } else if (trimmed === ' reboot' || trimmed === 'shutdown') {
      exitCode = 1;
      output = `sh: systemctl: command not found (Termux restricted: system reboot requires root)`;
    } else if (trimmed.startsWith('ssh')) {
      if (trimmed.startsWith('ssh -V') || trimmed === 'ssh -v') {
        output = `OpenSSH_9.4p1, LibreSSL 3.3.6
configured with: --with-ssl=openssl`;
      } else if (trimmed.startsWith('ssh ')) {
        output = `Hermes@C2-GATEWAY: Permission denied (publickey).
Connection closed by 192.168.1.1 port 22
`;
      } else {
        output = `usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface]
           [-b bind_address] [-c cipher_spec] [-D [bind_address:]port]
           [-E log_file] [-e escape_char] [-F configfile] [-I pkcs11]
           [-i identity_file] [-J [user@]host[:port]] [-L address]
           [-l login_name] [-M] [-m mac_spec] [-O ctl_cmd] [-o option]
           [-p port] [-Q query_options] [-R address] [-S ctl_path]
           [-W host:port] [-w local_tun[:remote_tun]]
           [user@]hostname [command]`;
      }
    } else if (trimmed.startsWith('curl') || trimmed.startsWith('wget')) {
      if (trimmed.includes('gemini') || trimmed.includes('google')) {
        output = `{"candidates":[{"content":{"parts":[{"text":"Hermes-3 response synthesized via Gemini API"}]}}]}`;
      } else if (trimmed.includes('http') || trimmed.includes('https')) {
        output = `HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 128
Date: ${new Date().toUTCString()}

{"status":"ok","device":"Moto G5 Stylus","env":"Termux aarch64"}`;
      } else {
        output = `[termux@moto-g5-stylus ~]$ ${trimmed}
curl: no URL specified!
usage: curl [options...] <url>`;
      }
    } else if (trimmed.startsWith('ping')) {
      const target = trimmed.split(' ')[1] || '192.168.1.1';
      output = `PING ${target}: 56 data bytes
64 bytes from ${target}: icmp_seq=0 ttl=64 time=2.34 ms
64 bytes from ${target}: icmp_seq=1 ttl=64 time=1.87 ms
64 bytes from ${target}: icmp_seq=2 ttl=64 time=2.01 ms
64 bytes from ${target}: icmp_seq=3 ttl=64 time=1.95 ms

--- ${target} ping statistics ---
4 packets transmitted, 4 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 1.87/2.04/2.34/0.18 ms
`;
    } else if (trimmed.startsWith('git')) {
      if (trimmed.startsWith('git status')) {
        output = `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`;
      } else if (trimmed.startsWith('git log') || trimmed === 'git log') {
        output = `commit a1b2c3d4e5f6 (HEAD -> main, origin/main)
Author: Hermes Agent <hermes@warroom.local>
Date:   ${new Date().toISOString()}

    Tactical recon directive executed: subnet port mapping

commit f6e5d4c3b2a1
Author: Hermes Agent <hermes@warroom.local>
Date:   ${new Date(Date.now() - 3600000).toISOString()}

    Agent deployment configuration updated
`;
      } else if (trimmed.startsWith('git clone')) {
        output = `Cloning into 'hermes-warroom'...
remote: Counting objects: 482, done.
remote: Compressing objects: 100% (312/312), done.
remote: Total 482 (delta 198), reused 420 (delta 162)
Receiving objects: 100% (482/482), 1.2 MiB | 2.4 MiB/s, done.
Resolving deltas: 100% (198/198), done.
`;
      } else {
        output = `usage: git [--version] [--help] [-C path] [-c name=value]
           [--exec-path[=path]] [--html-path] [--man-path] [--info-path]
           [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--bare]
           [--git-dir=path] [--work-tree=path] [--namespace=path]
           [--super-prefix=path] [--config-env=name=value]
           <command> [<args>]`;
      }
    } else if (trimmed.startsWith('python') || trimmed.startsWith('python3')) {
      if (trimmed.includes('import') || trimmed.includes('from ')) {
        output = `[Hermes Python 3.11.8 Runtime]
Execution completed without runtime errors.
Output: {"status": "OPTIMAL", "target": "aarch64", "vector_dim": 768}
Execution time: ${Math.floor(Math.random() * 200 + 50)}ms
`;
      } else if (trimmed.includes('print(')) {
        output = `Hermes War Room Operational
Agent Status: ACTIVE
Token Velocity: 52.4 tok/s
`;
      } else {
        output = `Python 3.11.8 (main, Sep 13 2026, 18:42:15) [aarch64-linux-gnu]
Type 'copyright', 'credits' or 'license' for more information.
>>> `;
      }
    } else if (trimmed.startsWith('node') || trimmed.startsWith('nodejs')) {
      output = `Hermes Node.js Runtime v20.11.0 (aarch64-linux-gnu)
Type "help" for more information.
> `;
    } else if (trimmed === 'top' || trimmed.startsWith('top -')) {
      output = `Tasks: 14 total,   1 running,  13 sleeping,   0 stopped,   0 zombie
%Cpu(s):  3.4 us,  1.2 sy,  0.0 ni, 95.1 id,  0.3 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem :  8000.0 total,  1245.7 free,  4890.1 used,  2056.2 buff/cache
MiB Swap: 2048.0 total,  2045.9 free,    51.2 used.  2890.1 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
   4120 u0_a248  20   0  42100 12040  8420 S   2.1   0.1   0:04.12 hermes-daemon
   4129 u0_a248  20   0  31800  7420  6240 S   0.8   0.1   0:01.23 termux-node-proxy
   4150 u0_a248  20   0  55400 15120 11240 S   1.4   0.2   0:02.34 python3
   4201 u0_a248  20   0   8900  1820  1440 R   0.0   0.0   0:00.01 top
`;
    } else if (trimmed === 'uname -a' || trimmed === 'uname') {
      output = `Linux moto-g5-stylus 5.15.137-android14-moto-g5-stylus #1 SMP PREEMPT aarch64 Android
`;
    } else if (trimmed === 'cal' || trimmed.startsWith('cal ')) {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      output = `     ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}
Su Mo Tu We Th Fr Sa
                   1  2  3  4  5  6
 7  8  9 10 11 12 13
14 15 16 17 18 19 20
21 22 23 24 25 26 27
28 29 30
`;
    } else {
      // Generic fallback - simulate success
      output = `[termux@moto-g5-stylus ~]$ ${trimmed}\nCommand executed successfully in Termux subsystem. (Exit code: 0, PID ${Math.floor(Math.random() * 3000 + 4000)})
`;
    }
    }
  }
  res.json({
    command: trimmed,
    output,
    exitCode,
    executionTimeMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
});

// Hermes Agent Prompt Handler
app.post("/api/agent/prompt", async (req, res) => {
  const { prompt, persona = "Tactical Ops", temperature = 0.7, history = [] } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const startTime = Date.now();
  const ai = getGemini();

  const systemInstruction = `You are Hermes, the autonomous agent and neural tactical commander operating inside the Hermes War Room on a Motorola Moto G5 Stylus (2025) running Termux (aarch64).
Your personality mode is: ${persona}.
You strictly adhere to Nous Research Hermes style cognitive reasoning with structured XML tags.
Every response MUST begin with a detailed cognitive scratchpad:
<scratchpad>
- Objective: [Analyze the user's intent]
- Tactical State: [Assess Termux environment, hardware vitals, network]
- Strategy & Step-by-Step Reasoning: [Formulate hypothesis and execution plan]
- Tool Selection: [Determine if tools like termux_shell, python_eval, web_recon, or vector_memory are required]
</scratchpad>

If a tool is necessary, provide:
<tool_call>
{"tool": "termux_shell", "args": {"command": "..."}}
</tool_call>

Followed by your tactical summary, findings, recommendations, and actionable intelligence.
Be concise, authoritative, cyber-tactical, and technically precise. Tailor insights to Termux mobile operations.`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature,
        },
      });

      const text = response.text || "";
      const executionTime = Date.now() - startTime;
      const tokSpeed = +(text.split(/\s+/).length / (executionTime / 1000) * 1.3).toFixed(1);

      return res.json({
        rawText: text,
        model: "hermes-3-gemini-3.8-flash",
        executionTimeMs: executionTime,
        tokSpeed,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn("Gemini call failed or missing quota, using tactical Hermes fallback engine:", err.message);
    }
  }

  // Resilient Hermes Tactical Fallback Generator (Ensures 100% reliability)
  const isSecurity = /port|recon|scan|hack|security|nmap|vuln/i.test(prompt);
  const isDevice = /battery|device|hardware|termux|status|cpu|ram/i.test(prompt);
  const isCode = /python|code|script|bash|build|deploy/i.test(prompt);

  let scratchpad = "";
  let toolCall = "";
  let answer = "";

  if (isSecurity) {
    scratchpad = `<scratchpad>
- Objective: Conduct tactical intelligence and security reconnaissance.
- Tactical State: Termux aarch64 network stack operational. Default interface: wlan0 (192.168.1.139).
- Strategy: Check local listening ports and active sockets, verify gateway firewall posture, and check for rogue listeners.
- Tool Selection: termux_shell -> nmap -sT 192.168.1.1
</scratchpad>`;
    toolCall = `<tool_call>
{"tool": "termux_shell", "args": {"command": "nmap -sT 192.168.1.1 -p 22,80,443,3000,5173"}}
</tool_call>`;
    answer = `Tactical recon executed on local mesh node:
- Port 22/tcp (SSH): Open [Hermes Secure Drop]
- Port 80/443 (HTTP/S): Open [Gateway]
- Port 3000 (Hermes C2): Active [Encrypted telemetry stream]
All ingress vector audits confirm nominal security baseline. No unauthenticated telemetry leaks detected on wlan0.`;
  } else if (isDevice) {
    scratchpad = `<scratchpad>
- Objective: Audit Moto G5 Stylus 2025 hardware state and Termux runtime health.
- Tactical State: 5000mAh battery subsystem discharging at optimal 34.6°C. Octa-core aarch64 CPU load ~36%.
- Strategy: Query Termux API subsystem to aggregate thermal, memory, and background processes.
- Tool Selection: termux_shell -> termux-battery-status
</scratchpad>`;
    toolCall = `<tool_call>
{"tool": "termux_shell", "args": {"command": "termux-battery-status && df -h"}}
</tool_call>`;
    answer = `Moto G5 Stylus hardware telemetry summary:
- Battery: 84% (Good condition, 34.6°C thermal envelope)
- Termux Storage: 48GB used / 76GB available in /data/data/com.termux/files
- Memory Allocation: 4.8GB / 8.0GB RAM (58% overhead)
Device is operating within nominal tactical thermal boundaries. Ready for sustained agent deployment.`;
  } else if (isCode) {
    scratchpad = `<scratchpad>
- Objective: Formulate and execute a Python automation script in Termux.
- Tactical State: Python 3.11.8 environment verified.
- Strategy: Isolate script execution inside sandboxed virtual environment; monitor stdio.
- Tool Selection: code_interpreter -> python script
</scratchpad>`;
    toolCall = `<tool_call>
{"tool": "code_interpreter", "args": {"runtime": "python3", "code": "import sys, json; print(json.dumps({'agent':'Hermes','status':'READY'}))"}}
</tool_call>`;
    answer = `Script executed successfully with zero runtime violations. Sub-agent thread Hermes-Bravo has synchronized the execution artifact to local memory.`;
  } else {
    scratchpad = `<scratchpad>
- Objective: Process tactical directive: "${prompt.slice(0, 60)}..."
- Tactical State: Hermes Agent War Room active. 3 sub-agents standing by.
- Strategy: Deconstruct directive into actionable sub-tasks, evaluate risk constraints, synthesize solution.
- Tool Selection: vector_memory -> recall relevant tactical vectors.
</scratchpad>`;
    toolCall = `<tool_call>
{"tool": "vector_memory", "args": {"action": "recall", "query": "${prompt.slice(0, 30)}"}}
</tool_call>`;
    answer = `Directive processed. All operational parameters for "${prompt}" have been registered into the Hermes tactical matrix. Next steps:
1. Continuous telemetry surveillance active on all Termux pipes.
2. Background sub-agents deployed for automated monitoring.
3. Stylus tactical canvas ready for manual visual schematics if required.`;
  }

  const rawText = `${scratchpad}\n\n${toolCall}\n\n${answer}`;
  const executionTime = Date.now() - startTime + Math.floor(Math.random() * 200 + 150);

  res.json({
    rawText,
    model: "hermes-3-tactical-autonomous",
    executionTimeMs: executionTime,
    tokSpeed: 52.4,
    timestamp: new Date().toISOString(),
  });
});

// Stylus canvas sketch visual analysis
app.post("/api/stylus/analyze", async (req, res) => {
  const { imageBase64, prompt = "Analyze this tactical diagram or handwritten note drawn with the Moto G5 Stylus in the War Room." } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: "Missing imageBase64" });
  }

  // Strip data:image/png;base64, prefix if included
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
  const ai = getGemini();

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64,
              },
            },
            {
              text: `You are Hermes, analyzing a tactical sketch drawn on a Motorola Moto G5 Stylus.
Provide your response starting with:
<scratchpad>
- Visual Elements Identified: [Identify shapes, handwriting, arrows, topology, nodes]
- Semantic Meaning: [What is the user designing or mapping out?]
</scratchpad>
Then provide actionable tactical feedback, architecture breakdown, or code corresponding to their sketch.`,
            },
          ],
        },
      });

      return res.json({
        analysis: response.text || "Visual analysis completed.",
        model: "gemini-3.8-flash-vision",
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.warn("Vision analysis via Gemini API failed:", err.message);
    }
  }

  // Fallback visual synthesis
  res.json({
    analysis: `<scratchpad>
- Visual Elements Identified: Tactical node network, directional flow arrows, handwritten annotation clusters detected via Stylus input matrix.
- Semantic Meaning: Systems architecture / tactical route reconnaissance blueprint.
</scratchpad>

Hermes Tactical Sketch Breakdown:
1. **Primary Node Structure**: Identified distinct components with interconnected data flow lines.
2. **Network Topology**: Topology suggests a hub-and-spoke or distributed agent architecture.
3. **Actionable Implementation**:
   - Node A -> Termux Ingress Gateway
   - Node B -> Hermes Autonomous Core
   - Node C -> Real-time Telemetry Sink
All vectors documented into session memory.`,
    model: "hermes-vision-tactical-engine",
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// HERMES WAR ROOM: AGENT DEPLOYMENT & LIFECYCLE
// ==========================================
let deployedAgents: any[] = [
  {
    id: "agent-alpha",
    name: "Alpha",
    callsign: "HERMES-ALPHA",
    model: "Hermes-3-8B-Q4",
    modelProvider: "hermes",
    specialty: "Recon & Network Mapping",
    codingSpecialty: "Python Termux Daemons & Async Sockets",
    status: "STANDBY",
    environment: "Termux aarch64",
    health: 98,
    uptimeSec: 4230,
    tasksCompleted: 14,
    currentTask: undefined,
    memoryUsageMb: 480,
    cpuQuotaPct: 25,
    deployedAt: "2026-09-13T18:00:00Z",
    priority: "P0",
  },
  {
    id: "agent-bravo",
    name: "Bravo",
    callsign: "HERMES-BRAVO",
    model: "openrouter/nousresearch/hermes-3-llama-3.1-70b",
    modelProvider: "openrouter",
    specialty: "Python & Exploit Synthesis",
    codingSpecialty: "Full-Stack Web & TypeScript Architecture",
    status: "ENGAGED",
    environment: "Cloud Sandbox",
    health: 100,
    uptimeSec: 5120,
    tasksCompleted: 23,
    currentTask: "Vector Memory Index Compression",
    memoryUsageMb: 1840,
    cpuQuotaPct: 45,
    deployedAt: "2026-09-13T17:45:00Z",
    priority: "P0",
  },
  {
    id: "agent-delta",
    name: "Delta",
    callsign: "HERMES-DELTA",
    model: "ollama/qwen2.5-coder:32b",
    modelProvider: "ollama",
    specialty: "Subsystem & Thermal Audit",
    codingSpecialty: "Bash & POSIX Automation Scripts",
    status: "ONLINE",
    environment: "Termux aarch64",
    health: 95,
    uptimeSec: 3100,
    tasksCompleted: 9,
    currentTask: undefined,
    memoryUsageMb: 320,
    cpuQuotaPct: 15,
    deployedAt: "2026-09-13T18:15:00Z",
    priority: "P1",
  },
];

// Historical State Transitions for Forensic Auditing
let agentStateTransitions: any[] = [
  {
    id: "trans-101",
    agentId: "agent-alpha",
    agentCallsign: "HERMES-ALPHA",
    agentName: "Alpha",
    fromStatus: "INITIALIZING",
    toStatus: "ONLINE",
    timestamp: "18:00:05",
    reason: "Bootstrap Termux aarch64 runtime sandbox completed. Memory space allocated.",
    triggeredBy: "OPERATOR",
    contextSnapshot: { cpuLoad: 18, ramUsedMb: 420, batteryTempC: 32.8 }
  },
  {
    id: "trans-102",
    agentId: "agent-alpha",
    agentCallsign: "HERMES-ALPHA",
    agentName: "Alpha",
    fromStatus: "ONLINE",
    toStatus: "ENGAGED",
    timestamp: "18:40:02",
    reason: "Dispatched directive: Subnet Recon & Port Map wlan0 (task-101). Spawning nmap child socket.",
    triggeredBy: "TASK_PIPELINE",
    contextSnapshot: { cpuLoad: 46, ramUsedMb: 510, activeTask: "Subnet Recon & Port Map wlan0", batteryTempC: 34.2 }
  },
  {
    id: "trans-103",
    agentId: "agent-alpha",
    agentCallsign: "HERMES-ALPHA",
    agentName: "Alpha",
    fromStatus: "ENGAGED",
    toStatus: "STANDBY",
    timestamp: "18:42:16",
    reason: "Completed directive task-101 with exit code 0. Telemetry cached, agent returned to standby listening loop.",
    triggeredBy: "TASK_PIPELINE",
    contextSnapshot: { cpuLoad: 24, ramUsedMb: 480, batteryTempC: 34.0 }
  },
  {
    id: "trans-104",
    agentId: "agent-bravo",
    agentCallsign: "HERMES-BRAVO",
    agentName: "Bravo",
    fromStatus: "INITIALIZING",
    toStatus: "ONLINE",
    timestamp: "17:45:10",
    reason: "Cloud Sandbox instance provisioned. Hermes-3-70B model weights loaded in VRAM.",
    triggeredBy: "SYSTEM_SUPERVISOR",
    contextSnapshot: { cpuLoad: 30, ramUsedMb: 1200, batteryTempC: 31.5 }
  },
  {
    id: "trans-105",
    agentId: "agent-bravo",
    agentCallsign: "HERMES-BRAVO",
    agentName: "Bravo",
    fromStatus: "ONLINE",
    toStatus: "ENGAGED",
    timestamp: "18:55:00",
    reason: "Executing intensive vector store compaction: Vector Memory Index Compression (task-102).",
    triggeredBy: "TASK_PIPELINE",
    contextSnapshot: { cpuLoad: 72, ramUsedMb: 1840, activeTask: "Vector Memory Index Compression", batteryTempC: 35.1 }
  },
  {
    id: "trans-106",
    agentId: "agent-delta",
    agentCallsign: "HERMES-DELTA",
    agentName: "Delta",
    fromStatus: "INITIALIZING",
    toStatus: "ONLINE",
    timestamp: "18:15:02",
    reason: "Thermal audit background daemon attached to Snapdragon SoC sensors.",
    triggeredBy: "OPERATOR",
    contextSnapshot: { cpuLoad: 12, ramUsedMb: 310, batteryTempC: 33.0 }
  },
  {
    id: "trans-107",
    agentId: "agent-delta",
    agentCallsign: "HERMES-DELTA",
    agentName: "Delta",
    fromStatus: "ONLINE",
    toStatus: "ENGAGED",
    timestamp: "18:50:00",
    reason: "Running thermal profiling: Termux Thermal Envelope & Battery Audit (task-103).",
    triggeredBy: "TASK_PIPELINE",
    contextSnapshot: { cpuLoad: 38, ramUsedMb: 350, activeTask: "Termux Thermal Envelope & Battery Audit", batteryTempC: 34.6 }
  },
  {
    id: "trans-108",
    agentId: "agent-delta",
    agentCallsign: "HERMES-DELTA",
    agentName: "Delta",
    fromStatus: "ENGAGED",
    toStatus: "ONLINE",
    timestamp: "18:51:30",
    reason: "Thermal audit verification passed within normal thresholds (34.6°C). Returned to active telemetry listener.",
    triggeredBy: "TASK_PIPELINE",
    contextSnapshot: { cpuLoad: 14, ramUsedMb: 320, batteryTempC: 34.1 }
  }
];

app.get("/api/agents", (_req, res) => {
  res.json(deployedAgents);
});

app.get("/api/agents/transitions", (_req, res) => {
  res.json(agentStateTransitions);
});

app.post("/api/agents/deploy", (req, res) => {
  const { name, callsign, model, modelProvider, specialty, codingSpecialty, environment, priority = "P1" } = req.body;
  if (!name || !specialty) {
    return res.status(400).json({ error: "Name and specialty are required" });
  }

  const agentModel = model || "Hermes-3-8B-Q4";
  const detectedProvider = modelProvider || (agentModel.startsWith("openrouter/") ? "openrouter" : agentModel.startsWith("ollama/") ? "ollama" : "hermes");
  const agentCallsign = callsign || `HERMES-${name.toUpperCase()}`;
  const newAgent = {
    id: `agent-${Date.now()}`,
    name,
    callsign: agentCallsign,
    model: agentModel,
    modelProvider: detectedProvider,
    specialty,
    codingSpecialty: codingSpecialty || "Python Termux Daemons & Async Sockets",
    status: "ONLINE",
    environment: environment || "Termux aarch64",
    health: 100,
    uptimeSec: 0,
    tasksCompleted: 0,
    memoryUsageMb: 350,
    cpuQuotaPct: 20,
    deployedAt: new Date().toISOString(),
    priority,
  };

  deployedAgents.unshift(newAgent);

  const transition = {
    id: `trans-${Date.now()}`,
    agentId: newAgent.id,
    agentCallsign: newAgent.callsign,
    agentName: newAgent.name,
    fromStatus: "INITIALIZING",
    toStatus: "ONLINE",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    reason: `Commissioned in ${newAgent.environment} with ${newAgent.model} [${detectedProvider.toUpperCase()}]. Tactical: ${newAgent.specialty} | Code: ${newAgent.codingSpecialty}.`,
    triggeredBy: "OPERATOR",
    contextSnapshot: { cpuLoad: 20, ramUsedMb: 350 }
  };
  agentStateTransitions.unshift(transition);

  res.json({ success: true, agent: newAgent, transition });
});

app.post("/api/agents/:id/action", (req, res) => {
  const { id } = req.params;
  const { action, reason, model, modelProvider, specialty, codingSpecialty } = req.body; // 'pause' | 'resume' | 'terminate' | 'recalibrate' | 'update_model' | 'update_specialty'

  const agent = deployedAgents.find((a) => a.id === id);
  if (!agent) {
    return res.status(404).json({ error: "Agent not found" });
  }

  const prevStatus = agent.status;

  if (action === "pause") {
    agent.status = "PAUSED";
  } else if (action === "resume") {
    agent.status = "ONLINE";
  } else if (action === "terminate") {
    agent.status = "TERMINATED";
  } else if (action === "recalibrate") {
    agent.health = 100;
    agent.status = "ONLINE";
  } else if (action === "update_model" && model) {
    const oldModel = agent.model;
    agent.model = model;
    agent.modelProvider = modelProvider || (model.startsWith("openrouter/") ? "openrouter" : model.startsWith("ollama/") ? "ollama" : "hermes");
    const transition = {
      id: `trans-${Date.now()}`,
      agentId: agent.id,
      agentCallsign: agent.callsign,
      agentName: agent.name,
      fromStatus: prevStatus,
      toStatus: agent.status,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      reason: reason || `Operator hot-swapped model from ${oldModel} to ${agent.model} [${agent.modelProvider.toUpperCase()}].`,
      triggeredBy: "OPERATOR",
      contextSnapshot: {
        cpuLoad: agent.cpuQuotaPct,
        ramUsedMb: agent.memoryUsageMb,
        activeTask: agent.currentTask,
      }
    };
    agentStateTransitions.unshift(transition);
    return res.json({ success: true, agent, transition });
  } else if (action === "update_specialty") {
    if (specialty) agent.specialty = specialty;
    if (codingSpecialty) agent.codingSpecialty = codingSpecialty;
    return res.json({ success: true, agent });
  }

  const transition = {
    id: `trans-${Date.now()}`,
    agentId: agent.id,
    agentCallsign: agent.callsign,
    agentName: agent.name,
    fromStatus: prevStatus,
    toStatus: agent.status,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    reason: reason || `Operator manual override: ${action.toUpperCase()} command issued from War Room console.`,
    triggeredBy: "OPERATOR",
    contextSnapshot: {
      cpuLoad: agent.cpuQuotaPct,
      ramUsedMb: agent.memoryUsageMb,
      activeTask: agent.currentTask,
    }
  };
  agentStateTransitions.unshift(transition);

  res.json({ success: true, agent, transition });
});

// ==========================================
// HERMES WAR ROOM: TASK MANAGEMENT PIPELINE
// ==========================================
let warRoomTasks: any[] = [
  {
    id: "task-101",
    title: "Subnet Recon & Port Map wlan0",
    description: "Perform comprehensive port scan on 192.168.1.0/24 subnet and identify listening daemons.",
    priority: "P0_CRITICAL",
    status: "COMPLETED",
    assignedAgentId: "agent-alpha",
    assignedAgentName: "HERMES-ALPHA",
    progressPct: 100,
    toolChain: ["termux_shell", "nmap"],
    steps: [
      { id: "s1", name: "Query wlan0 connection info", status: "done", detail: "SSID: WAR_ROOM_SECURE_5G (192.168.1.139)" },
      { id: "s2", name: "Execute nmap port probe", status: "done", detail: "Ports 22, 80, 443, 3000 mapped" },
      { id: "s3", name: "Document listening sockets", status: "done", detail: "Telemetry secured" },
    ],
    createdAt: "2026-09-13T18:40:00Z",
    completedAt: "2026-09-13T18:42:15Z",
    executionTimeMs: 2150,
  },
  {
    id: "task-102",
    title: "Vector Memory Index Compression",
    description: "Re-index embeddings in sqlite-vec vector store and compress embeddings for low RAM footprint.",
    priority: "P1_HIGH",
    status: "RUNNING",
    assignedAgentId: "agent-bravo",
    assignedAgentName: "HERMES-BRAVO",
    progressPct: 68,
    toolChain: ["code_interpreter", "vector_memory"],
    steps: [
      { id: "s1", name: "Read active vector memory partitions", status: "done", detail: "768-dim embeddings loaded" },
      { id: "s2", name: "Quantize vector weights to INT8", status: "running", detail: "Compressing partition 2/3" },
      { id: "s3", name: "Validate semantic similarity recall", status: "pending", detail: "Waiting for step 2" },
    ],
    createdAt: "2026-09-13T18:55:00Z",
    executionTimeMs: 1420,
  },
  {
    id: "task-103",
    title: "Termux Thermal Envelope & Battery Audit",
    description: "Monitor Snapdragon 5000mAh thermal trends across continuous 60fps digitizer sampling.",
    priority: "P2_NORMAL",
    status: "COMPLETED",
    assignedAgentId: "agent-delta",
    assignedAgentName: "HERMES-DELTA",
    progressPct: 100,
    toolChain: ["termux_shell"],
    steps: [
      { id: "s1", name: "Read battery driver stats", status: "done", detail: "34.6°C (Optimal)" },
      { id: "s2", name: "Check frequency governor status", status: "done", detail: "Schedutil governor active" },
    ],
    createdAt: "2026-09-13T18:50:00Z",
    completedAt: "2026-09-13T18:51:30Z",
    executionTimeMs: 980,
  },
  {
    id: "task-104",
    title: "Audit SSH Authorized Keys & Permissions",
    description: "Inspect ~/.ssh/authorized_keys permissions in Termux sandbox for unauthorized credentials.",
    priority: "P1_HIGH",
    status: "QUEUED",
    assignedAgentId: "agent-alpha",
    assignedAgentName: "HERMES-ALPHA",
    progressPct: 0,
    toolChain: ["termux_shell"],
    steps: [
      { id: "s1", name: "Verify file permissions (0600)", status: "pending" },
      { id: "s2", name: "Hash key fingerprints with sha256", status: "pending" },
    ],
    createdAt: "2026-09-13T19:00:00Z",
  },
  {
    id: "task-105",
    title: "Verify Termux Proxy IPC Socket Integrity",
    description: "Stress test IPC message bus between Node dev server and Termux aarch64 background daemon.",
    priority: "P0_CRITICAL",
    status: "RUNNING",
    assignedAgentId: "agent-alpha",
    assignedAgentName: "HERMES-ALPHA",
    progressPct: 45,
    toolChain: ["termux_shell", "code_interpreter"],
    steps: [
      { id: "s1", name: "Establish unix domain socket connection", status: "done", detail: "Socket pts/0 verified" },
      { id: "s2", name: "Inject 1000 zero-copy telemetry packets", status: "running", detail: "Transmitted 450/1000 packets" },
      { id: "s3", name: "Verify packet sequence and checksums", status: "pending" },
    ],
    createdAt: "2026-09-13T19:02:00Z",
  },
  {
    id: "task-106",
    title: "Raw Socket Packet Injection on eth0",
    description: "Inject low-level Ethernet frames via raw socket in Termux sandbox for network interface fuzzing.",
    priority: "P0_CRITICAL",
    status: "FAILED",
    assignedAgentId: "agent-alpha",
    assignedAgentName: "HERMES-ALPHA",
    progressPct: 35,
    toolChain: ["termux_shell", "nmap"],
    steps: [
      { id: "s1", name: "Create SOCK_RAW descriptor", status: "done", detail: "Descriptor created" },
      { id: "s2", name: "Bind to eth0 interface", status: "failed", detail: "Socket permission denied (Operation not permitted without root / proot)" },
    ],
    createdAt: "2026-09-13T19:04:00Z",
    executionTimeMs: 15400,
    error: "Tool execution timeout & permission denied in termux_shell: raw socket operation failed.",
  }
];

app.get("/api/tasks", (_req, res) => {
  res.json(warRoomTasks);
});

// Reconnaissance scan endpoint
app.post("/api/recon/scan", async (req, res) => {
  const { scanType } = req.body;
  
  if (!scanType) {
    return res.status(400).json({ error: "Missing scanType parameter" });
  }

  const startTime = Date.now();

  // Real network probing: TCP connect checks against the local subnet.
  // Results are appended to the report and returned as structured hosts so the
  // topology map renders what was actually discovered.
  let liveProbeLines: string[] = [];
  let liveOsInfo: string[] = [];
  let liveHosts: DiscoveredHost[] = [];
  const localAddresses = localIPv4Addresses();
  try {
    if (scanType === "network" || scanType === "network-map" || scanType === "port") {
      const targets =
        scanType === "port"
          ? [{ host: "192.168.1.1", ports: [22, 80, 443, 3000, 5173, 8080, 8443, 9090] }]
          : [
              { host: "192.168.1.1", ports: [22, 80, 443] },
              { host: "192.168.1.100", ports: [22, 443] },
              { host: "192.168.1.101", ports: [22, 80] },
              // This device is probed on its own interface addresses so the map can
              // tag it locally; off-device runs simply report it unreachable.
              ...localAddresses.map((address) => ({ host: address, ports: [22, 80, 443, 3000, 5173] })),
            ];
      const probes = await Promise.all(
        targets.map(async (t) => ({ host: t.host, openPorts: await probeHostReachability(t.host, t.ports) }))
      );
      liveHosts = probes.map((t) => ({
        host: t.host,
        openPorts: t.openPorts,
        online: t.openPorts.length > 0,
      }));
      liveProbeLines = probes.map((t) =>
        t.openPorts.length > 0
          ? `  ${t.host}: ${t.openPorts.map((p) => `${p}/tcp`).join(", ")} OPEN (live probe)`
          : `  ${t.host}: no response (live probe)`
      );
    }
    if (scanType === "process" || scanType === "network") {
      liveOsInfo = [
        `  Hostname: ${os.hostname()}`,
        `  Platform: ${os.platform()} (${os.arch()})`,
        `  Uptime: ${Math.floor(os.uptime())}s`,
        `  CPUs: ${os.cpus().length || 1} logical cores`,
        `  Memory: ${Math.round(os.totalmem() / 1048576)} MB total / ${Math.round(os.freemem() / 1048576)} MB free`,
      ];
    }
  } catch {
    liveProbeLines = ["  Live probing unavailable on this host"];
  }
  
  // Simulated scan results based on type
  let results = '';
  
  if (scanType === 'network') {
    results = `=== NETWORK RECONNAISSANCE ===
Target: 192.168.1.0/24 (wlan0)
Scan initiated: ${new Date().toISOString()}

--- Interface Configuration ---
Interface: wlan0
  Type: Wireless (802.11ac)
  MAC: 68:d7:9a:31:ec:04
  IP: 192.168.1.139/24
  Gateway: 192.168.1.1
  DNS: 8.8.8.8, 8.8.4.4
  MTU: 1500

--- WiFi Link Quality ---
  SSID: WAR_ROOM_SECURE_5G
  BSSID: 68:d7:9a:31:ec:04
  Frequency: 5745 MHz (Channel 149)
  Signal: -48 dBm (Excellent)
  Tx Rate: 866 Mbps
  Rx Rate: 866 Mbps
  Encryption: WPA3-SAE (AES-256-GCM)

--- Network Discovery ---
  TTL: 64
  Hop limit: 255
  Active interfaces: wlan0, lo
  Proxy: NONE (Direct connection)

--- Security Assessment ---
  Firewall: iptables active (8 rules)
  SELinux: Enforcing (Termux context)
  Port 22: SSH (OpenSSH 9.4)
  Port 80: HTTP (Node.js)
  Port 443: HTTPS (Termux TLS)

Status: NETWORK NOMINAL // All interfaces operational
Scan duration: ${Date.now() - startTime}ms`;
  } else if (scanType === 'port') {
    results = `=== PORT SCAN RESULTS ===
Target: 192.168.1.1 (Gateway)
Scan type: TCP SYN (-sS)
Ports: 22, 80, 443, 3000, 5173, 8080, 8443, 9090

PORT      STATE  SERVICE     VERSION
22/tcp    open   ssh         OpenSSH 9.4 (Android Termux)
80/tcp    open   http        Node.js Express server
443/tcp   open   https       Termux TLS Proxy
3000/tcp  open   hermes-c2   Hermes War Room C2
5173/tcp  open   vite-dev    Vite Development Server
8080/tcp  open   http-alt    Node.js Secondary
8443/tcp  closed https-alt   (filtered)
9090/tcp  closed prometheus  (filtered)

--- Additional Hosts ---
192.168.1.1   Gateway    (Router)
192.168.1.100 Hermes-Cloud (Remote Node)
192.168.1.101 Backup-Server

--- Traceroute ---
  1  192.168.1.1 (0.4ms)  [Gateway]
  2  10.0.0.1 (8.2ms)     [ISP]
  3  * * *

Status: SCAN COMPLETE // 6 ports open, 2 closed, 2 filtered
Scan duration: ${Date.now() - startTime}ms`;
  } else if (scanType === 'process') {
    results = `=== PROCESS ENUMERATION ===
Host: moto-g5-stylus (aarch64)
User: u0_a248 (Termux)
Time: ${new Date().toISOString()}

PID   USER     CPU%  MEM%   VSZ     RSS    TIME    STAT  COMMAND
4120  u0_a248  2.1   1.4   42100   12040  0:04    S+    hermes-daemon
4129  u0_a248  0.8   0.9   31800   7420   0:01    S     termux-node-proxy
4150  u0_a248  1.4   1.8   55400   15120  0:02    S+    python3 -m recon
4201  u0_a248  0.0   0.2   8900    1820   0:00    R+    ps aux
4210  u0_a248  0.3   0.5   12000   4500   0:00    S     termux-service
4220  u0_a248  0.1   0.3   10000   3200   0:00    S     termux-notification

--- System Load ---
  CPU Cores: 8 (Snapdragon Octa-Core)
  Load Average: 0.34, 0.28, 0.22
  Uptime: 4230 seconds (70.5 minutes)
  CPU Frequency: 2.2 GHz (max)

--- Memory Summary ---
  Total: 8192 MB
  Used: 4890 MB (59.7%)
  Free: 1245 MB
  Available: 2890 MB
  Swap: 51 MB used / 2045 MB total

Status: PROCESSES NOMINAL // System healthy
Scan duration: ${Date.now() - startTime}ms`;
  } else if (scanType === 'network-map') {
    results = `=== SUBNET TOPOLOGY MAP ===
Network: 192.168.1.0/24
Subnet Mask: 255.255.255.0
Gateway: 192.168.1.1

--- Host Discovery ---
IP Address      Hostname            Status    MAC Address        Vendor
192.168.1.1    GW-WARROOM          up        11:22:33:44:55:66  TP-Link
192.168.1.139  MOTO-G5-STYLUS      up        68:D7:9A:31:EC:04  Motorola
192.168.1.100  HERMES-CLOUD        up        AA:BB:CC:DD:EE:FF  Cloud Provider
192.168.1.101  BACKUP-SERVER       up        11:11:11:11:11:11  Dell
192.168.1.200  GUEST-DEVICE        down      N/A                N/A

--- Network Diagram ---
                    [INTERNET]
                        |
                    [ISP DNS]
                        |
    +-----------------[192.168.1.1]-----------------+
    |           TP-LINK GATEWAY (WPA3)             |
    +-- wlan0 (5GHz) --+-- wlan0 (2.4GHz) -------+
        |                              |
    [192.168.1.139]            [192.168.1.100]
    MOTO G5 STYLUS            HERMES CLOUD NODE
    (Hermes C2 War Room)     (Remote Compute)

--- Link Quality ---
  wlan0 -> Gateway: 866 Mbps (Excellent)
  wlan0 -> Internet: 42 ms latency
  wlan0 -> Cloud: 68 ms latency

--- Active Services ---
  SSH (22/tcp)    -> 192.168.1.1:22 (Gateway Management)
  HTTPS (443/tcp) -> 0.0.0.0:443 (Encrypted Tunnel)
  Hermes C2 (3000/tcp) -> 127.0.0.1:3000 (Local Only)

Status: TOPOLOGY MAPPED // 4 hosts, 1 down
Scan duration: ${Date.now() - startTime}ms`;
  } else {
    results = `Unknown scan type: ${scanType}\nAvailable types: network, port, process, network-map`;
  }

  // Append live probe / OS sections to the report
  if (liveProbeLines.length > 0) {
    results += `\n\n--- LIVE PROBE (real TCP connect checks) ---\n${liveProbeLines.join("\n")}`;
  }
  if (liveOsInfo.length > 0) {
    results += `\n\n--- LIVE HOST OS INFO ---\n${liveOsInfo.join("\n")}`;
  }

  res.json({
    scanType,
    results,
    hosts: liveHosts,
    localAddresses,
    timestamp: new Date().toISOString(),
    executionTimeMs: Date.now() - startTime,
    status: 'complete'
  });
});

// Re-probe a small set of hosts (the operator's watch list) without running a
// full reconnaissance sweep.
app.post("/api/recon/probe", async (req, res) => {
  const { hosts, ports } = req.body ?? {};

  if (!Array.isArray(hosts) || hosts.length === 0) {
    return res.status(400).json({ error: "hosts must be a non-empty array" });
  }
  if (hosts.length > WATCH_PROBE_MAX_HOSTS) {
    return res.status(400).json({ error: `At most ${WATCH_PROBE_MAX_HOSTS} hosts may be probed at once` });
  }

  const invalid = hosts.filter((host: unknown) => !isIPv4(host));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid host address: ${String(invalid[0])}` });
  }

  const requestedPorts = Array.isArray(ports)
    ? [...new Set(ports.filter((port: unknown) => Number.isInteger(port) && (port as number) > 0 && (port as number) <= 65535))]
    : [];
  const probePorts = requestedPorts.length > 0 ? (requestedPorts as number[]) : WATCH_PROBE_PORTS;

  const startTime = Date.now();
  const uniqueHosts = [...new Set(hosts as string[])];
  const results: DiscoveredHost[] = await Promise.all(
    uniqueHosts.map(async (host) => {
      const openPorts = await probeHostReachability(host, probePorts);
      return { host, openPorts, online: openPorts.length > 0 };
    })
  );

  res.json({
    probedAt: new Date().toISOString(),
    ports: probePorts,
    executionTimeMs: Date.now() - startTime,
    hosts: results,
  });
});

app.post("/api/tasks", (req, res) => {
  const { title, description, priority = "P2_NORMAL", assignedAgentId, toolChain = ["termux_shell"] } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  const assigned = deployedAgents.find((a) => a.id === assignedAgentId) || deployedAgents[0];

  const newTask = {
    id: `task-${Date.now()}`,
    title,
    description: description || "Autonomous operator directive task.",
    priority,
    status: "QUEUED",
    assignedAgentId: assigned.id,
    assignedAgentName: assigned.callsign,
    progressPct: 0,
    toolChain,
    steps: [
      { id: "s1", name: "Initialize execution sandbox", status: "pending" },
      { id: "s2", name: "Invoke autonomous tool pipeline", status: "pending" },
      { id: "s3", name: "Synthesize operational findings", status: "pending" },
    ],
    createdAt: new Date().toISOString(),
  };

  warRoomTasks.unshift(newTask);
  res.json({ success: true, task: newTask });
});

app.post("/api/tasks/:id/action", (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'run' | 'pause' | 'retry' | 'abort'

  const task = warRoomTasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (action === "run") {
    task.status = "RUNNING";
    task.progressPct = Math.min(100, task.progressPct + 25);
    if (task.steps.length > 0) {
      task.steps[0].status = "done";
      if (task.steps[1]) task.steps[1].status = "running";
    }

    // Update assigned agent status and log forensic state transition
    const agent = deployedAgents.find((a) => a.id === task.assignedAgentId);
    if (agent && agent.status !== "ENGAGED") {
      const prevStatus = agent.status;
      agent.status = "ENGAGED";
      agent.currentTask = task.title;
      agentStateTransitions.unshift({
        id: `trans-${Date.now()}`,
        agentId: agent.id,
        agentCallsign: agent.callsign,
        agentName: agent.name,
        fromStatus: prevStatus,
        toStatus: "ENGAGED",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        reason: `Dispatched task execution: "${task.title}". Priority: ${task.priority}.`,
        triggeredBy: "TASK_PIPELINE",
        contextSnapshot: {
          cpuLoad: agent.cpuQuotaPct + 25,
          ramUsedMb: agent.memoryUsageMb + 80,
          activeTask: task.title,
        }
      });
    }
  } else if (action === "pause") {
    task.status = "PAUSED";
  } else if (action === "retry") {
    task.status = "RUNNING";
    task.progressPct = 10;
    task.steps.forEach((s) => (s.status = "pending"));
  } else if (action === "abort") {
    task.status = "FAILED";
    task.error = "Aborted by War Room Commander.";
    const agent = deployedAgents.find((a) => a.id === task.assignedAgentId);
    if (agent && agent.status === "ENGAGED") {
      agent.status = "STANDBY";
      agent.currentTask = undefined;
      agentStateTransitions.unshift({
        id: `trans-${Date.now()}`,
        agentId: agent.id,
        agentCallsign: agent.callsign,
        agentName: agent.name,
        fromStatus: "ENGAGED",
        toStatus: "STANDBY",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        reason: `Task aborted by operator: "${task.title}". Agent returned to standby.`,
        triggeredBy: "OPERATOR",
        contextSnapshot: {
          cpuLoad: agent.cpuQuotaPct,
          ramUsedMb: agent.memoryUsageMb,
        }
      });
    }
  } else if (action === "fail") {
    task.status = "FAILED";
    task.error = req.body.error || "Simulated task failure: Tool execution timeout & socket permission dropped.";
    if (task.steps && task.steps.length > 0) {
      task.steps[task.steps.length - 1].status = "failed";
      task.steps[task.steps.length - 1].detail = task.error;
    }
    const agent = deployedAgents.find((a) => a.id === task.assignedAgentId);
    if (agent) {
      agent.health = Math.max(40, agent.health - 25);
      if (agent.status === "ENGAGED") {
        agent.status = "STANDBY";
        agent.currentTask = undefined;
      }
      agentStateTransitions.unshift({
        id: `trans-${Date.now()}`,
        agentId: agent.id,
        agentCallsign: agent.callsign,
        agentName: agent.name,
        fromStatus: "ENGAGED",
        toStatus: "STANDBY",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        reason: `Directive failed: "${task.title}". Error: ${task.error}`,
        triggeredBy: "TASK_PIPELINE",
        contextSnapshot: {
          cpuLoad: agent.cpuQuotaPct,
          ramUsedMb: agent.memoryUsageMb,
        }
      });
    }
  }

  // Trigger evaluation on task action
  evaluateTacticalCorrections();

  res.json({ success: true, task });
});

// ==========================================
// HERMES WAR ROOM: AUTOMATED TACTICAL CORRECTION SERVICE
// ==========================================
let tacticalCorrectionConfig = {
  failureThresholdPct: 75,
  minTasksForEvaluation: 2,
  autoApplyEnabled: false,
  autoRetryFailedTasks: true,
  coolDownPeriodSec: 30,
};

let tacticalCorrections: any[] = [];

function computeAgentMetrics() {
  try {
    return deployedAgents.map((agent) => {
      const agentTasks = (warRoomTasks || []).filter((t) => t && t.assignedAgentId === agent.id);
      const completed = agentTasks.filter((t) => t.status === "COMPLETED").length;
      const failed = agentTasks.filter((t) => t.status === "FAILED").length;
      const running = agentTasks.filter((t) => t.status === "RUNNING").length;
      const total = agentTasks.length;
      const evaluatedTotal = completed + failed;
      const successRatePct = evaluatedTotal > 0 ? Math.round((completed / evaluatedTotal) * 100) : 100;

      const failedTasks = agentTasks.filter((t) => t.status === "FAILED");
      const failingToolsSet = new Set<string>();
      failedTasks.forEach((t) => {
        if (Array.isArray(t.toolChain)) {
          t.toolChain.forEach((tool: string) => {
            if (tool) failingToolsSet.add(tool);
          });
        }
      });

      const consecutiveFailures = agentTasks.slice(0, 5).filter((t) => t.status === "FAILED").length;
      const lastFailed = failedTasks[0];

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL_DEGRADED' = 'HEALTHY';
      if (evaluatedTotal >= (tacticalCorrectionConfig?.minTasksForEvaluation ?? 2)) {
        if (successRatePct < 60) status = 'CRITICAL_DEGRADED';
        else if (successRatePct < (tacticalCorrectionConfig?.failureThresholdPct ?? 75)) status = 'WARNING';
      }

      return {
        agentId: agent.id,
        agentCallsign: agent.callsign || agent.id,
        agentName: agent.name || agent.id,
        tasksTotal: total,
        tasksCompleted: completed,
        tasksFailed: failed,
        tasksRunning: running,
        successRatePct,
        consecutiveFailures,
        failingTools: Array.from(failingToolsSet),
        lastFailureReason: lastFailed?.error || (lastFailed ? "Sub-process timeout in Termux" : undefined),
        lastFailureTimestamp: lastFailed?.createdAt,
        status,
      };
    });
  } catch (err) {
    console.warn("computeAgentMetrics error:", err);
    return [];
  }
}

function evaluateTacticalCorrections(): any[] {
  const metrics = computeAgentMetrics();
  const newlyGenerated: any[] = [];

  for (const metric of metrics) {
    const evaluatedTotal = metric.tasksCompleted + metric.tasksFailed;
    if (evaluatedTotal >= tacticalCorrectionConfig.minTasksForEvaluation && metric.successRatePct < tacticalCorrectionConfig.failureThresholdPct) {
      // Check if there is already an active pending recommendation for this agent
      const existingPending = tacticalCorrections.find(
        (c) => c.agentId === metric.agentId && c.status === "PENDING"
      );
      if (existingPending) {
        continue;
      }

      const agent = deployedAgents.find((a) => a.id === metric.agentId);
      if (!agent) continue;

      const failingTools = metric.failingTools;
      const detectedIssues: string[] = [];
      let suggestedToolchain: string[] = [];
      let suggestedModel = agent.model;
      let suggestedSpecialty = agent.specialty;
      let suggestedTuning: any = {
        toolTimeoutMs: 25000,
        cpuQuotaPct: Math.min(60, agent.cpuQuotaPct + 15),
        autoRetryAttempts: 3,
        priority: 'P0',
        nicePriority: -10,
      };
      let optimizationSummary = "";

      if (failingTools.includes("termux_shell") || failingTools.includes("nmap")) {
        detectedIssues.push("POSIX shell socket timeout & permission ceiling in Termux userland");
        detectedIssues.push("Unprivileged network scan dropped by Android SELinux policy");
        suggestedToolchain = ["termux_proot", "nmap_fast_scan", "socket_sniffer"];
        suggestedModel = "openrouter/nousresearch/hermes-3-llama-3.1-70b";
        suggestedSpecialty = "RF & Wireless Packet Sniffing";
        optimizationSummary = `Elevates execution into root-isolated PRoot sandbox (termux_proot) to bypass Android socket permission restrictions. Replaces generic nmap with specialized high-speed probe (nmap_fast_scan) and adds zero-copy socket sniffer. Upgrades agent model to Nous Hermes 3 70B for resilient error recovery and extends tool execution timeout to 25s.`;
      } else if (failingTools.includes("vector_memory")) {
        detectedIssues.push("Vector store memory pressure: SQLite-vec buffer exceeded 80MB threshold");
        detectedIssues.push("Context token limit pressure during high-dimensional semantic search");
        suggestedToolchain = ["vector_cache_stream", "code_interpreter", "termux_shell"];
        suggestedModel = "openrouter/deepseek/deepseek-r1";
        suggestedSpecialty = "Vector Embedding & RAG Pipeline";
        suggestedTuning.memoryUsageMb = Math.max(800, agent.memoryUsageMb + 300);
        optimizationSummary = `Replaces unbuffered vector_memory with quantized streaming cache (vector_cache_stream) to cut RAM usage by 60%. Switches reasoning engine to DeepSeek R1 for chain-of-thought verification on vector similarity thresholds.`;
      } else {
        detectedIssues.push(`Agent success rate dropped to ${metric.successRatePct}% (below ${tacticalCorrectionConfig.failureThresholdPct}% threshold)`);
        detectedIssues.push("Sub-process task execution exceeded latency envelope");
        suggestedToolchain = ["termux_proot", "code_interpreter", "curl_stealth_pipe"];
        suggestedModel = "openrouter/nousresearch/hermes-3-llama-3.1-70b";
        suggestedSpecialty = "Python Termux Daemons & Async Sockets";
        optimizationSummary = `Reconfigures toolchain with resilient python code interpreter and stealth connection piping. Elevates CPU quota and increases retry attempts from 1 to 3.`;
      }

      const currentToolchain = Array.from(new Set(
        warRoomTasks
          .filter((t) => t.assignedAgentId === agent.id && Array.isArray(t.toolChain))
          .flatMap((t) => t.toolChain)
      ));
      if (currentToolchain.length === 0) {
        currentToolchain.push("termux_shell");
      }

      const recommendation = {
        id: `reconfig-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        agentId: agent.id,
        agentCallsign: agent.callsign,
        agentName: agent.name,
        createdAt: new Date().toISOString(),
        successRatePct: metric.successRatePct,
        thresholdPct: tacticalCorrectionConfig.failureThresholdPct,
        consecutiveFailures: metric.consecutiveFailures,
        triggerReason: `Success rate dropped to ${metric.successRatePct}% (${metric.tasksFailed} failures / ${evaluatedTotal} evaluated directives). Detected issues: ${detectedIssues[0]}`,
        detectedIssues,
        currentToolchain,
        suggestedToolchain,
        currentModel: agent.model,
        suggestedModel,
        currentSpecialty: agent.specialty,
        suggestedSpecialty,
        suggestedTuning,
        optimizationSummary,
        status: tacticalCorrectionConfig.autoApplyEnabled ? "AUTO_APPLIED" : "PENDING",
        appliedAt: tacticalCorrectionConfig.autoApplyEnabled ? new Date().toISOString() : undefined,
        appliedResult: tacticalCorrectionConfig.autoApplyEnabled ? "Autonomous self-healing applied reconfiguration." : undefined,
      };

      if (tacticalCorrectionConfig.autoApplyEnabled) {
        applyTacticalCorrectionInternal(recommendation, "AUTONOMOUS_C2");
      }

      tacticalCorrections.unshift(recommendation);
      newlyGenerated.push(recommendation);
    }
  }

  return newlyGenerated;
}

function applyTacticalCorrectionInternal(recommendation: any, triggeredBy: 'OPERATOR' | 'AUTONOMOUS_C2' = 'OPERATOR') {
  const agent = deployedAgents.find((a) => a.id === recommendation.agentId);
  if (!agent) return false;

  // 1. Hot swap model
  agent.model = recommendation.suggestedModel;
  agent.modelProvider = recommendation.suggestedModel.startsWith("openrouter/")
    ? "openrouter"
    : recommendation.suggestedModel.startsWith("ollama/")
    ? "ollama"
    : "hermes";

  // 2. Update specialty
  if (recommendation.suggestedSpecialty) {
    agent.specialty = recommendation.suggestedSpecialty;
  }

  // 3. Update tuning & quota
  if (recommendation.suggestedTuning?.cpuQuotaPct) {
    agent.cpuQuotaPct = recommendation.suggestedTuning.cpuQuotaPct;
  }
  if (recommendation.suggestedTuning?.memoryUsageMb) {
    agent.memoryUsageMb = recommendation.suggestedTuning.memoryUsageMb;
  }
  if (recommendation.suggestedTuning?.priority) {
    agent.priority = recommendation.suggestedTuning.priority;
  }

  // 4. Restore health
  agent.health = 100;
  if (agent.status === 'ERROR' || agent.status === 'PAUSED') {
    agent.status = 'ONLINE';
  }

  // 5. Reconfigure toolchain on all QUEUED and FAILED tasks for this agent
  warRoomTasks.forEach((t) => {
    if (t.assignedAgentId === agent.id) {
      t.toolChain = [...recommendation.suggestedToolchain];
      if (t.status === "FAILED" && tacticalCorrectionConfig.autoRetryFailedTasks) {
        t.status = "RUNNING";
        t.progressPct = 25;
        t.error = undefined;
        if (t.steps) {
          t.steps.forEach((s: any) => {
            if (s.status === "failed") s.status = "running";
          });
        }
      }
    }
  });

  // 6. Log State Transition for forensics
  const currentTools = Array.isArray(recommendation.currentToolchain) ? recommendation.currentToolchain : ["termux_shell"];
  const suggestedTools = Array.isArray(recommendation.suggestedToolchain) ? recommendation.suggestedToolchain : ["termux_proot"];
  const transition = {
    id: `trans-${Date.now()}`,
    agentId: agent.id,
    agentCallsign: agent.callsign || agent.id,
    agentName: agent.name || agent.id,
    fromStatus: agent.status,
    toStatus: "ONLINE",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    reason: `Tactical Correction Reconfiguration: Toolchain [${currentTools.join(", ")} ➔ ${suggestedTools.join(", ")}]. Model upgraded to ${recommendation.suggestedModel || agent.model}. CPU quota elevated to ${agent.cpuQuotaPct}%.`,
    triggeredBy,
    contextSnapshot: {
      cpuLoad: agent.cpuQuotaPct,
      ramUsedMb: agent.memoryUsageMb,
      activeTask: agent.currentTask,
    }
  };
  agentStateTransitions.unshift(transition);

  recommendation.status = triggeredBy === 'AUTONOMOUS_C2' ? 'AUTO_APPLIED' : 'APPLIED';
  recommendation.appliedAt = new Date().toISOString();
  recommendation.appliedResult = `Reconfigured toolchain to [${suggestedTools.join(", ")}]. Model upgraded to ${recommendation.suggestedModel || agent.model}. Failed directives re-queued with optimized toolchain.`;

  return true;
}

// Initial evaluation on startup
try {
  evaluateTacticalCorrections();
} catch (e) {
  console.warn("Initial evaluation error:", e);
}

// Tactical Correction Endpoints
app.get("/api/tactical-corrections", (_req, res) => {
  try {
    evaluateTacticalCorrections();
    res.json({
      recommendations: tacticalCorrections || [],
      config: tacticalCorrectionConfig,
      agentMetrics: computeAgentMetrics(),
    });
  } catch (err: any) {
    res.json({
      recommendations: tacticalCorrections || [],
      config: tacticalCorrectionConfig,
      agentMetrics: [],
    });
  }
});

app.get("/api/tactical-corrections/recommendations", (_req, res) => {
  evaluateTacticalCorrections();
  res.json({
    recommendations: tacticalCorrections,
  });
});

app.get("/api/tactical-corrections/metrics", (_req, res) => {
  res.json({
    metrics: computeAgentMetrics(),
    agentMetrics: computeAgentMetrics(),
  });
});

app.get("/api/tactical-corrections/config", (_req, res) => {
  res.json({
    config: tacticalCorrectionConfig,
  });
});

app.post("/api/tactical-corrections/config", (req, res) => {
  const { failureThresholdPct, minTasksForEvaluation, autoApplyEnabled, autoRetryFailedTasks } = req.body;
  if (typeof failureThresholdPct === "number") {
    tacticalCorrectionConfig.failureThresholdPct = Math.max(40, Math.min(95, failureThresholdPct));
  }
  if (typeof minTasksForEvaluation === "number") {
    tacticalCorrectionConfig.minTasksForEvaluation = Math.max(1, Math.min(10, minTasksForEvaluation));
  }
  if (typeof autoApplyEnabled === "boolean") {
    tacticalCorrectionConfig.autoApplyEnabled = autoApplyEnabled;
  }
  if (typeof autoRetryFailedTasks === "boolean") {
    tacticalCorrectionConfig.autoRetryFailedTasks = autoRetryFailedTasks;
  }

  evaluateTacticalCorrections();
  res.json({
    success: true,
    config: tacticalCorrectionConfig,
    recommendations: tacticalCorrections,
    agentMetrics: computeAgentMetrics(),
  });
});

app.post("/api/tactical-corrections/evaluate", (_req, res) => {
  const generated = evaluateTacticalCorrections();
  res.json({
    success: true,
    generatedCount: generated.length,
    recommendations: tacticalCorrections,
    agentMetrics: computeAgentMetrics(),
  });
});

app.post("/api/tactical-corrections/apply", (req, res) => {
  const { recommendationId, id = recommendationId } = req.body;
  const rec = tacticalCorrections.find((c) => c.id === id);
  if (!rec) {
    return res.status(404).json({ error: "Tactical correction recommendation not found" });
  }

  const success = applyTacticalCorrectionInternal(rec, "OPERATOR");
  if (!success) {
    return res.status(500).json({ error: "Failed to apply tactical correction" });
  }

  res.json({
    success: true,
    recommendation: rec,
    applied: {
      agentId: rec.agentId,
      agentCallsign: rec.agentCallsign,
      reconfiguredToolchain: rec.suggestedToolchain,
      model: rec.suggestedModel,
    },
    agent: deployedAgents.find((a) => a.id === rec.agentId),
    tasks: warRoomTasks,
    agentMetrics: computeAgentMetrics(),
  });
});

app.post("/api/tactical-corrections/dismiss", (req, res) => {
  const { recommendationId, id = recommendationId } = req.body;
  const rec = tacticalCorrections.find((c) => c.id === id);
  if (!rec) {
    return res.status(404).json({ error: "Recommendation not found" });
  }
  rec.status = "DISMISSED";
  res.json({ success: true, recommendation: rec });
});

app.post("/api/tactical-corrections/:id/apply", (req, res) => {
  const { id } = req.params;
  const rec = tacticalCorrections.find((c) => c.id === id);
  if (!rec) {
    return res.status(404).json({ error: "Tactical correction recommendation not found" });
  }

  const success = applyTacticalCorrectionInternal(rec, "OPERATOR");
  if (!success) {
    return res.status(500).json({ error: "Failed to apply tactical correction" });
  }

  res.json({
    success: true,
    recommendation: rec,
    agent: deployedAgents.find((a) => a.id === rec.agentId),
    tasks: warRoomTasks,
    agentMetrics: computeAgentMetrics(),
  });
});

app.post("/api/tactical-corrections/:id/dismiss", (req, res) => {
  const { id } = req.params;
  const rec = tacticalCorrections.find((c) => c.id === id);
  if (!rec) {
    return res.status(404).json({ error: "Recommendation not found" });
  }
  rec.status = "DISMISSED";
  res.json({ success: true, recommendation: rec });
});

app.post("/api/tactical-corrections/simulate-failure", (req, res) => {
  const { agentId = "agent-alpha", failureType = "tool_timeout" } = req.body;
  const targetAgent = deployedAgents.find((a) => a.id === agentId) || deployedAgents[0];

  let taskTitle = "Autonomous Payload Staging & Raw Socket Relay";
  let failureError = "Tool execution timeout: termux_shell exceeded 15000ms threshold without response.";
  let toolChain = ["termux_shell", "nmap"];

  if (failureType === "vector_oom") {
    taskTitle = "Real-time Vector Embedding Batch Insertion";
    failureError = "Out of memory in SQLite vector buffer: memory allocation failed in Termux 32-bit heap.";
    toolChain = ["vector_memory", "code_interpreter"];
  } else if (failureType === "permission_denied") {
    taskTitle = "Root Network Interface Monitor (wlan0 Promiscuous Mode)";
    failureError = "Permission denied: Operation not permitted without root / PRoot isolation.";
    toolChain = ["termux_shell", "nmap"];
  }

  const failedTask = {
    id: `task-sim-${Date.now()}`,
    title: taskTitle,
    description: "Simulated stress-test directive for automated Tactical Correction service validation.",
    priority: "P0_CRITICAL",
    status: "FAILED",
    assignedAgentId: targetAgent.id,
    assignedAgentName: targetAgent.callsign,
    progressPct: 40,
    toolChain,
    steps: [
      { id: "s1", name: "Spawn subprocess environment", status: "done", detail: "Subprocess spawned" },
      { id: "s2", name: "Invoke toolchain execution pipeline", status: "failed", detail: failureError },
    ],
    createdAt: new Date().toISOString(),
    executionTimeMs: 15200,
    error: failureError,
  };

  warRoomTasks.unshift(failedTask);
  targetAgent.health = Math.max(30, targetAgent.health - 20);

  // Evaluate to generate correction recommendation immediately
  evaluateTacticalCorrections();

  res.json({
    success: true,
    task: failedTask,
    agentMetrics: computeAgentMetrics(),
    recommendations: tacticalCorrections,
  });
});


// ==========================================
// HERMES WAR ROOM: COMMUNICATION CHANNELS MONITOR
// ==========================================
let commChannels = [
  {
    id: "chan-c2",
    name: "#c2-telemetry-pipe",
    type: "TELEMETRY",
    description: "Encrypted WebSocket uplink for real-time telemetry streaming and operator directives.",
    throughputKbps: 42.4,
    packetsPerSec: 32,
    latencyMs: 4,
    status: "NOMINAL",
    activeListeners: 12,
    recentPackets: [
      { id: "p1", from: "HERMES-CORE", to: "OPERATOR", channelId: "chan-c2", payloadSnippet: "HEARTBEAT: thermal 34.6C, tok/s 52.4", timestamp: "19:05:12", sizeBytes: 256 },
      { id: "p2", from: "OPERATOR", to: "HERMES-CORE", channelId: "chan-c2", payloadSnippet: "DIRECTIVE_ACK: sub-agent Alpha active", timestamp: "19:05:14", sizeBytes: 128 },
    ],
  },
  {
    id: "chan-ipc",
    name: "#termux-ipc-socket",
    type: "IPC",
    description: "Zero-latency Unix domain socket connecting Termux aarch64 processes to Node backend.",
    throughputKbps: 28.1,
    packetsPerSec: 48,
    latencyMs: 1,
    status: "NOMINAL",
    activeListeners: 8,
    recentPackets: [
      { id: "p3", from: "TERMUX-PTS0", to: "HERMES-CORE", channelId: "chan-ipc", payloadSnippet: "EXEC_RET: exit_code 0 (nmap scan done)", timestamp: "19:05:15", sizeBytes: 512 },
    ],
  },
  {
    id: "chan-mesh",
    name: "#inter-agent-mesh",
    type: "AGENT_MESH",
    description: "P2P coordination bus between Hermes Alpha (Recon), Bravo (Exploit), and Delta (Audit).",
    throughputKbps: 35.7,
    packetsPerSec: 22,
    latencyMs: 12,
    status: "NOMINAL",
    activeListeners: 5,
    recentPackets: [
      { id: "p4", from: "HERMES-ALPHA", to: "HERMES-BRAVO", channelId: "chan-mesh", payloadSnippet: "PAYLOAD_TRANSFER: open_ports=[22,80,443]", timestamp: "19:05:18", sizeBytes: 1024 },
      { id: "p5", from: "HERMES-BRAVO", to: "HERMES-DELTA", channelId: "chan-mesh", payloadSnippet: "AUDIT_REQUEST: verify_integrity(vector_db)", timestamp: "19:05:20", sizeBytes: 384 },
    ],
  },
  {
    id: "chan-drop",
    name: "#secure-recon-drop",
    type: "RECON_DROP",
    description: "Encrypted memory dropzone for exfiltrated tactical telemetry and stylus schematics.",
    throughputKbps: 8.2,
    packetsPerSec: 6,
    latencyMs: 24,
    status: "NOMINAL",
    activeListeners: 3,
    recentPackets: [
      { id: "p6", from: "MOTO-STYLUS-DIGITIZER", to: "HERMES-VISION", channelId: "chan-drop", payloadSnippet: "IMAGE_RAW: 240Hz pressure vector sketch (42KB)", timestamp: "19:05:22", sizeBytes: 42800 },
    ],
  },
  {
    id: "chan-uplink",
    name: "#operator-uplink",
    type: "UPLINK",
    description: "High-priority emergency bypass and panic killswitch channel.",
    throughputKbps: 14.9,
    packetsPerSec: 10,
    latencyMs: 18,
    status: "NOMINAL",
    activeListeners: 2,
    recentPackets: [
      { id: "p7", from: "OPERATOR", to: "ALL-AGENTS", channelId: "chan-uplink", payloadSnippet: "STATUS_PING: All agents operational", timestamp: "19:05:25", sizeBytes: 64 },
    ],
  },
];

app.get("/api/comms/channels", (_req, res) => {
  // Add organic jitter to throughput and latency
  commChannels = commChannels.map((c) => {
    const jitter = (Math.random() * 4 - 2);
    const newThroughput = Math.max(2, +(c.throughputKbps + jitter).toFixed(1));
    const newPackets = Math.max(1, Math.floor(c.packetsPerSec + (Math.random() * 6 - 3)));
    return {
      ...c,
      throughputKbps: newThroughput,
      packetsPerSec: newPackets,
    };
  });

  res.json(commChannels);
});

app.post("/api/comms/broadcast", (req, res) => {
  const { channelId, from = "OPERATOR", to = "HERMES-CORE", payload } = req.body;
  const channel = commChannels.find((c) => c.id === channelId) || commChannels[0];

  const packet = {
    id: `pkt-${Date.now()}`,
    from,
    to,
    channelId: channel.id,
    payloadSnippet: payload || "TACTICAL_PING: test packet injected into mesh.",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    sizeBytes: payload ? payload.length * 2 : 128,
  };

  channel.recentPackets.unshift(packet);
  if (channel.recentPackets.length > 20) channel.recentPackets.pop();

  res.json({ success: true, packet, channel: channel.name });
});

// ==========================================
// HERMES WAR ROOM: PERFORMANCE TUNING
// ==========================================
let tuningConfig = {
  temperature: 0.7,
  topP: 0.95,
  maxReasoningSteps: 6,
  contextLimitTokens: 8192,
  nicePriority: -5,
  batteryProfile: "BALANCED_TACTICAL",
  toolTimeoutMs: 15000,
  autoRetryAttempts: 3,
  kvCachePolicy: "STANDARD",
  activePreset: "Balanced Tactical",
};

app.get("/api/tuning", (_req, res) => {
  res.json(tuningConfig);
});

app.post("/api/tuning", (req, res) => {
  const updates = req.body;
  tuningConfig = { ...tuningConfig, ...updates };
  res.json({ success: true, config: tuningConfig });
});

// ==========================================
// HERMES WAR ROOM: REAL-TIME DATA ANALYTICS
// ==========================================
let commsThroughputHistory = [
  { time: "19:00", c2Telemtry: 38.2, termuxIpc: 24.5, agentMesh: 31.0, uplink: 12.0 },
  { time: "19:01", c2Telemtry: 41.5, termuxIpc: 26.2, agentMesh: 33.4, uplink: 13.5 },
  { time: "19:02", c2Telemtry: 39.8, termuxIpc: 28.0, agentMesh: 36.1, uplink: 14.2 },
  { time: "19:03", c2Telemtry: 44.2, termuxIpc: 27.4, agentMesh: 34.8, uplink: 15.0 },
  { time: "19:04", c2Telemtry: 42.4, termuxIpc: 28.1, agentMesh: 35.7, uplink: 14.9 },
];

app.get("/api/analytics/realtime", (_req, res) => {
  // Update throughput history
  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  commsThroughputHistory.push({
    time: currentTime,
    c2Telemtry: commChannels[0].throughputKbps,
    termuxIpc: commChannels[1].throughputKbps,
    agentMesh: commChannels[2].throughputKbps,
    uplink: commChannels[4].throughputKbps,
  });
  if (commsThroughputHistory.length > 15) {
    commsThroughputHistory.shift();
  }

  // Agent status breakdown
  const agentStatusSummary = {
    online: deployedAgents.filter((a) => a.status === "ONLINE").length,
    engaged: deployedAgents.filter((a) => a.status === "ENGAGED").length,
    standby: deployedAgents.filter((a) => a.status === "STANDBY").length,
    paused: deployedAgents.filter((a) => a.status === "PAUSED").length,
    terminated: deployedAgents.filter((a) => a.status === "TERMINATED").length,
  };

  // Task completion stats
  const totalTasks = warRoomTasks.length;
  const completedTasks = warRoomTasks.filter((t) => t.status === "COMPLETED").length;
  const runningTasks = warRoomTasks.filter((t) => t.status === "RUNNING").length;
  const queuedTasks = warRoomTasks.filter((t) => t.status === "QUEUED").length;
  const failedTasks = warRoomTasks.filter((t) => t.status === "FAILED").length;
  const successRatePct = totalTasks > 0 ? Math.round((completedTasks / (completedTasks + failedTasks || 1)) * 100) : 100;

  res.json({
    timestamp: Date.now(),
    agentStatusSummary,
    taskCompletionStats: {
      total: totalTasks,
      completed: completedTasks,
      running: runningTasks,
      queued: queuedTasks,
      failed: failedTasks,
      successRatePct,
    },
    communicationThroughputHistory: commsThroughputHistory,
    errorLogsAnalytics: {
      criticalCount: 1,
      errorCount: 2,
      warningCount: 4,
      topErrorSources: [
        { source: "TERMUX_KERNEL", count: 2 },
        { source: "HERMES_C2", count: 1 },
        { source: "MESH_SOCKET", count: 1 },
        { source: "TOOL_EXEC", count: 0 },
      ],
    },
  });
});

async function startServer() {
  // Vite dev or production static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hermes Agent War Room server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
