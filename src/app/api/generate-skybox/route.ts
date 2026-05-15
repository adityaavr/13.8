import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";
import type { SpectralClass } from "@/lib/types";

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

type SkyboxGenerationRequest = {
  colors?: string;
  system?: {
    name?: string;
    spectralClass?: SpectralClass;
    hasBlackHole?: boolean;
    temperature?: number;
    starColor?: [number, number, number];
    planetCount?: number;
  };
};

function toColorDescriptor(starColor?: [number, number, number]): string | null {
  if (!starColor || starColor.length !== 3) return null;
  const [r, g, b] = starColor;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

function buildSkyboxPrompt(payload: SkyboxGenerationRequest): string {
  const systemName = payload.system?.name?.trim() || "uncharted system";
  const spectralClass = payload.system?.spectralClass;
  const hasBlackHole = Boolean(payload.system?.hasBlackHole);
  const temperature = payload.system?.temperature;
  const planetCount = payload.system?.planetCount;
  const starColor = toColorDescriptor(payload.system?.starColor);
  const fallbackColors = payload.colors?.trim();

  const contextBits = [
    spectralClass ? `host star class ${spectralClass}` : null,
    temperature ? `${Math.round(temperature)}K stellar output` : null,
    typeof planetCount === "number" ? `${planetCount} known planets` : null,
    starColor ? `dominant stellar tint ${starColor}` : null,
    fallbackColors ? `palette accents ${fallbackColors}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Ultra-detailed seamless 2:1 equirectangular deep-space skybox for the ${systemName} star system.`,
    "360-degree environment map for an inside-out sphere, seamless left-right wrap with clean poles.",
    hasBlackHole
      ? "Feature a distant black-hole lensing phenomenon with accretion glow and warped star fields."
      : "Feature layered nebula volumes, dust lanes, and dense multi-scale star clusters.",
    contextBits ? `Mood context: ${contextBits}.` : null,
    "No foreground planets, no ships, no silhouettes, no text, no logos, no watermark, no UI.",
    "Cinematic No Man's Sky-inspired color depth, high contrast starfield detail, volumetric cosmic atmosphere.",
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Gemini generation (primary)
// ---------------------------------------------------------------------------

async function generateWithGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: "image/png",
        aspectRatio: "16:9",
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) return null;

    return `data:image/png;base64,${imageBytes}`;
  } catch (err) {
    console.error("Gemini skybox generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fal generation (fallback)
// ---------------------------------------------------------------------------

async function generateWithFal(prompt: string): Promise<string | null> {
  try {
    const model = process.env.FAL_SKYBOX_MODEL === "fal-ai/flux/schnell"
      ? ("fal-ai/flux/schnell" as const)
      : ("fal-ai/flux/dev" as const);
    const isFast = model === "fal-ai/flux/schnell";

    const result = await fal.subscribe(model, {
      input: {
        prompt,
        image_size: { width: 2048, height: 1024 },
        output_format: "png",
        acceleration: "none",
        guidance_scale: isFast ? 3.5 : 4,
        num_inference_steps: isFast ? 6 : 28,
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: true,
    });

    return result.data?.images?.[0]?.url ?? null;
  } catch (err) {
    console.error("Fal skybox generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as SkyboxGenerationRequest;
    const prompt = buildSkyboxPrompt(payload);

    if (!prompt) {
      return NextResponse.json({ error: "System payload is required" }, { status: 400 });
    }

    // Try Gemini first, fall back to Fal
    let imageUrl = await generateWithGemini(prompt);

    if (!imageUrl) {
      console.log("Gemini unavailable or failed — falling back to Fal");
      imageUrl = await generateWithFal(prompt);
    }

    if (imageUrl) {
      return NextResponse.json({ imageUrl });
    }

    return NextResponse.json({ error: "No image generated" }, { status: 500 });
  } catch (error) {
    console.error("Skybox generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate skybox" },
      { status: 500 },
    );
  }
}
