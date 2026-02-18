import { 
    AgentActionKey, 
    AgentConfig, 
    AgentConstraintConfig, 
    AIModels,
    AllModels,
    LiteModels,
    RegularModels,
} from "./config.types";
import { env } from 'cloudflare:workers';

// Common configs - these are good defaults
const COMMON_AGENT_CONFIGS = {
    screenshotAnalysis: {
        name: AIModels.DISABLED,
        reasoning_effort: 'medium' as const,
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    realtimeCodeFixer: {
        name: AIModels.GROK_4_1_FAST_NON_REASONING,
        reasoning_effort: 'low' as const,
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    fastCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 2000,
        fallbackModel: AIModels.GROK_4_1_FAST_NON_REASONING,
        temperature: 1,
    },
} as const;


//======================================================================================
// ATTENTION! Platform config requires specific API keys and Cloudflare AI Gateway setup.
//======================================================================================
/* 
These are the configs used at build.cloudflare.dev 
You may need to provide API keys for these models in your environment or use 
Cloudflare AI Gateway unified billing for seamless model access without managing multiple keys.
*/
const PLATFORM_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    blueprint: {
        name: AIModels.GEMINI_2_5_FLASH, // Use cheaper model to avoid rate limits
        reasoning_effort: undefined, // Remove reasoning effort to reduce token usage
        max_tokens: 8000, // Reduced from 16000 to save tokens
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
        temperature: 1.0,
    },
    projectSetup: {
        name: AIModels.GROK_4_1_FAST,
        reasoning_effort: 'medium',
        max_tokens: 6000, // Reduced from 8000 to save tokens
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    phaseGeneration: {
        name: AIModels.GEMINI_2_5_FLASH, // Use cheaper model
        reasoning_effort: 'medium', // Remove reasoning to reduce tokens
        max_tokens: 5000, // Reduced from 8000 to save tokens
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH, // Use cheaper model
        max_tokens: 32000, // Reduced from 48000 to save tokens while maintaining quality
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH, // Use cheaper model
        max_tokens: 32000, // Reduced from 48000 to save tokens while maintaining quality
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    conversationalResponse: {
        name: AIModels.GROK_4_1_FAST,
        reasoning_effort: 'low',
        max_tokens: 4000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    deepDebugger: {
        name: AIModels.GROK_4_1_FAST,
        reasoning_effort: 'high',
        max_tokens: 5000, // Reduced from 8000 to save tokens
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    fileRegeneration: {
        name: AIModels.GROK_4_1_FAST_NON_REASONING,
        reasoning_effort: 'low',
        max_tokens: 12000, // Reduced from 16000 to save tokens (25% reduction)
        temperature: 0.0,
        fallbackModel: AIModels.GROK_CODE_FAST_1,
    },
    agenticProjectBuilder: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
};

//======================================================================================
// Default Gemini-only config (most likely used in your deployment)
//======================================================================================
/* These are the default out-of-the box gemini-only models used when PLATFORM_MODEL_PROVIDERS is not set */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
    ...COMMON_AGENT_CONFIGS,
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 1500,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
        temperature: 0.5,
    },
    blueprint: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        reasoning_effort: 'low',
        max_tokens: 5000, // Reduced from 8000 to save tokens (37.5% reduction)
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
        temperature: 0.8,
    },
    projectSetup: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 12000, // Reduced from 16000 to save tokens (25% reduction)
        temperature: 0.8,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    phaseGeneration: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 4000, // Reduced from 6000 to save tokens (33% reduction)
        temperature: 0.8,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 12000, // Reduced from 16000 to save tokens (25% reduction)
        temperature: 0.8,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 12000, // Reduced from 16000 to save tokens (25% reduction)
        temperature: 0.8,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    conversationalResponse: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        reasoning_effort: 'low',
        max_tokens: 2500,
        temperature: 0.3,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    deepDebugger: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 4000, // Reduced from 6000 to save tokens (33% reduction)
        temperature: 0.8,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    fileRegeneration: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        max_tokens: 6000, // Reduced from 8000 to save tokens (25% reduction)
        temperature: 0.4,
        fallbackModel: AIModels.GEMINI_2_5_FLASH_LITE,
    },
    agenticProjectBuilder: {
        name: AIModels.GEMINI_3_FLASH_PREVIEW,
        reasoning_effort: 'high',
        max_tokens: 6000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
};

export const AGENT_CONFIG: AgentConfig = env.PLATFORM_MODEL_PROVIDERS 
    ? PLATFORM_AGENT_CONFIG 
    : DEFAULT_AGENT_CONFIG;


export const AGENT_CONSTRAINTS: Map<AgentActionKey, AgentConstraintConfig> = new Map([
	['fastCodeFixer', {
		allowedModels: new Set([AIModels.DISABLED]),
		enabled: true,
	}],
	['realtimeCodeFixer', {
		allowedModels: new Set([AIModels.DISABLED]),
		enabled: true,
	}],
	['fileRegeneration', {
		allowedModels: new Set(AllModels),
		enabled: true,
	}],
	['phaseGeneration', {
		allowedModels: new Set(AllModels),
		enabled: true,
	}],
	['projectSetup', {
		allowedModels: new Set([...RegularModels, AIModels.GEMINI_2_5_PRO]),
		enabled: true,
	}],
	['conversationalResponse', {
		allowedModels: new Set(RegularModels),
		enabled: true,
	}],
	['templateSelection', {
		allowedModels: new Set(LiteModels),
		enabled: true,
	}],
]);