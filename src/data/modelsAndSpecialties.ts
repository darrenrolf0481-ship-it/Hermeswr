export interface ModelOption {
  id: string;
  name: string;
  provider: 'hermes' | 'openrouter' | 'ollama';
  providerLabel: 'Hermes Engine' | 'OpenRouter' | 'Ollama Cloud';
  description: string;
  contextLength?: string;
  badgeColor: string;
  recommendedRole?: string;
}

export const OPENROUTER_MODELS: ModelOption[] = [
  {
    id: 'openrouter/nousresearch/hermes-3-llama-3.1-405b',
    name: 'Nous Hermes 3 405B Instruct',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'Frontier 405B parameter reasoning model with steerable system prompts and deep agentic tool-use.',
    contextLength: '128k',
    badgeColor: 'from-purple-600 to-indigo-600 text-purple-200',
    recommendedRole: 'Deep Strategic Reasoning & Complex Planning',
  },
  {
    id: 'openrouter/nousresearch/hermes-3-llama-3.1-70b',
    name: 'Nous Hermes 3 70B Instruct',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'High-throughput Hermes model optimized for synthetic instruction following and multi-turn C2.',
    contextLength: '128k',
    badgeColor: 'from-purple-600 to-indigo-600 text-purple-200',
    recommendedRole: 'Autonomous Agent Orchestration',
  },
  {
    id: 'openrouter/deepseek/deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'Open-weights reasoning model with chain-of-thought verification for complex logic and math.',
    contextLength: '64k',
    badgeColor: 'from-blue-600 to-cyan-600 text-blue-200',
    recommendedRole: 'Algorithmic Verification & Fuzzing',
  },
  {
    id: 'openrouter/deepseek/deepseek-chat',
    name: 'DeepSeek V3 (Coder & Agents)',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'Ultra-fast 671B MoE architecture with exceptional code generation and terminal automation.',
    contextLength: '64k',
    badgeColor: 'from-blue-600 to-cyan-600 text-blue-200',
    recommendedRole: 'Full-Stack & Systems Coding',
  },
  {
    id: 'openrouter/anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'State-of-the-art coding and computer-use benchmark leader across TypeScript, Python, and Rust.',
    contextLength: '200k',
    badgeColor: 'from-amber-600 to-orange-600 text-amber-200',
    recommendedRole: 'Complex Systems Architecture',
  },
  {
    id: 'openrouter/meta-llama/llama-3.3-70b-instruct',
    name: 'Meta Llama 3.3 70B Instruct',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'Latest open frontier release from Meta with enhanced multilingual and API tool calling.',
    contextLength: '128k',
    badgeColor: 'from-sky-600 to-blue-600 text-sky-200',
    recommendedRole: 'Multi-Agent Network Relays',
  },
  {
    id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B Instruct',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'Dedicated coding foundation model with 92+ HumanEval pass rate and Linux shell mastery.',
    contextLength: '128k',
    badgeColor: 'from-emerald-600 to-teal-600 text-emerald-200',
    recommendedRole: 'Low-Level Code Generation & Shell Scripting',
  },
  {
    id: 'openrouter/mistralai/codestral-2501',
    name: 'Codestral 2501 (Mistral AI)',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    description: 'Specialized 22B code intelligence model with 80+ programming languages support.',
    contextLength: '256k',
    badgeColor: 'from-amber-600 to-rose-600 text-amber-200',
    recommendedRole: 'Rapid Infilling & Code Verification',
  },
];

export const OLLAMA_CLOUD_MODELS: ModelOption[] = [
  {
    id: 'ollama/qwen2.5-coder:32b',
    name: 'Qwen 2.5 Coder 32B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Hosted Ollama cloud instance executing Qwen 2.5 Coder 32B with zero local Termux RAM overhead.',
    contextLength: '32k',
    badgeColor: 'from-emerald-600 to-green-600 text-emerald-200',
    recommendedRole: 'Cloud-Assisted Code Refactoring',
  },
  {
    id: 'ollama/deepseek-coder-v2:16b',
    name: 'DeepSeek-Coder-V2 16B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Mixture-of-Experts coding model hosted on cloud Ollama daemon for low-latency dispatch.',
    contextLength: '64k',
    badgeColor: 'from-cyan-600 to-blue-600 text-cyan-200',
    recommendedRole: 'Automated Script Synthesis & Unit Tests',
  },
  {
    id: 'ollama/hermes3:8b',
    name: 'Nous Hermes 3 8B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Hermes-3 8B deployed on remote Ollama cloud cluster with GPU acceleration.',
    contextLength: '16k',
    badgeColor: 'from-purple-600 to-pink-600 text-purple-200',
    recommendedRole: 'Tactical Recon & Instruction Execution',
  },
  {
    id: 'ollama/hermes3:70b',
    name: 'Nous Hermes 3 70B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Cloud Ollama remote node with full 70B Hermes weights and unrestricted tool calling.',
    contextLength: '32k',
    badgeColor: 'from-purple-600 to-pink-600 text-purple-200',
    recommendedRole: 'Subsystem Reasoning & Deep OSINT',
  },
  {
    id: 'ollama/codellama:70b',
    name: 'CodeLlama 70B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Meta CodeLlama 70B Python fine-tuned remote inference endpoint for heavy repository audits.',
    contextLength: '16k',
    badgeColor: 'from-blue-600 to-indigo-600 text-blue-200',
    recommendedRole: 'Python & Vulnerability Research',
  },
  {
    id: 'ollama/llama3.3:70b',
    name: 'Llama 3.3 70B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Cloud-hosted Llama 3.3 70B for high-throughput multi-agent communication pipelines.',
    contextLength: '32k',
    badgeColor: 'from-sky-600 to-blue-600 text-sky-200',
    recommendedRole: 'Broad Domain Knowledge & Parsing',
  },
  {
    id: 'ollama/starcoder2:15b',
    name: 'StarCoder2 15B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'BigCode StarCoder2 15B multi-repository indexing and syntax validation engine.',
    contextLength: '16k',
    badgeColor: 'from-amber-600 to-yellow-600 text-amber-200',
    recommendedRole: 'Codebase Traversal & Dependency Audits',
  },
  {
    id: 'ollama/phi4:14b',
    name: 'Phi-4 14B (Cloud Ollama)',
    provider: 'ollama',
    providerLabel: 'Ollama Cloud',
    description: 'Microsoft Phi-4 14B compact algorithmic reasoning model hosted on Ollama cloud node.',
    contextLength: '16k',
    badgeColor: 'from-teal-600 to-emerald-600 text-teal-200',
    recommendedRole: 'Cryptographic & Math Logic Verification',
  },
];

export const HERMES_NATIVE_MODELS: ModelOption[] = [
  {
    id: 'Hermes-3-8B-Q4',
    name: 'Hermes-3 8B Q4 (Termux aarch64)',
    provider: 'hermes',
    providerLabel: 'Hermes Engine',
    description: 'Quantized 4-bit weights specifically optimized for Snapdragon RAM envelope on Moto G Stylus.',
    contextLength: '8k',
    badgeColor: 'from-cyan-600 to-teal-600 text-cyan-200',
    recommendedRole: 'On-Device Termux Edge Inference',
  },
  {
    id: 'Hermes-3-70B-FP16',
    name: 'Hermes-3 70B FP16 (Cloud Mesh)',
    provider: 'hermes',
    providerLabel: 'Hermes Engine',
    description: 'Uncompressed FP16 Hermes-3 model running in War Room cloud sandbox with full precision.',
    contextLength: '32k',
    badgeColor: 'from-purple-600 to-blue-600 text-purple-200',
    recommendedRole: 'Heavy Sub-Agent Planning',
  },
  {
    id: 'Hermes-3-Flash',
    name: 'Hermes-3 Flash (Ultra-Fast 60+ tok/s)',
    provider: 'hermes',
    providerLabel: 'Hermes Engine',
    description: 'Lightweight distilled Hermes kernel engineered for real-time sensor loops and fast C2 alerts.',
    contextLength: '16k',
    badgeColor: 'from-amber-600 to-orange-600 text-amber-200',
    recommendedRole: 'Instantaneous Sensor & Telemetry Reactivity',
  },
  {
    id: 'Hermes-Vision-Tactical',
    name: 'Hermes-Vision Tactical (Multimodal Stylus)',
    provider: 'hermes',
    providerLabel: 'Hermes Engine',
    description: 'Multimodal vision model parsing Moto G Stylus whiteboard schematics and screenshots directly.',
    contextLength: '16k',
    badgeColor: 'from-rose-600 to-red-600 text-rose-200',
    recommendedRole: 'Stylus Diagram & Vector Extraction',
  },
];

export const ALL_MODELS: ModelOption[] = [
  ...HERMES_NATIVE_MODELS,
  ...OPENROUTER_MODELS,
  ...OLLAMA_CLOUD_MODELS,
];

export const TACTICAL_SPECIALTIES = [
  'Recon & Network Mapping',
  'Python & Exploit Synthesis',
  'Subsystem & Thermal Audit',
  'OSINT & Vector Analysis',
  'Cryptographic Key Verifier',
  'Autonomous C2 Relay',
  'RF & Wireless Packet Sniffing',
  'Hardware Sensor & Battery Telemetry',
];

export const CODING_SPECIALTIES = [
  'Full-Stack Web & TypeScript Architecture',
  'Python Termux Daemons & Async Sockets',
  'aarch64 ASM & Reverse Engineering',
  'Rust Memory-Safe Systems & CLI',
  'Bash & POSIX Automation Scripts',
  'C/C++ Native Android NDK Tooling',
  'Vulnerability Fuzzing & Static Analysis',
  'Vector Embedding & RAG Pipeline',
  'Go / Golang Concurrent Micro-Daemons',
  'SQL & SQLite Low-Footprint Storage',
  'API Microservices & gRPC Mesh Relay',
];

export function getModelInfo(modelId: string): ModelOption | undefined {
  return ALL_MODELS.find((m) => m.id === modelId);
}

export function detectModelProvider(modelId: string): 'hermes' | 'openrouter' | 'ollama' {
  if (modelId.startsWith('openrouter/')) return 'openrouter';
  if (modelId.startsWith('ollama/')) return 'ollama';
  return 'hermes';
}
