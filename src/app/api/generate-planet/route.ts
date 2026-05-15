import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { fal } from "@fal-ai/client";
import type { PlanetType, SpectralClass } from "@/lib/types";

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const PLANET_STYLE_GUIDE: Record<PlanetType, string> = {
  rocky:
    "fractured plateaus, tectonic ridges, impact basins, weathered mineral plains, high-frequency rocky microdetail",
  gas:
    "thick turbulent cloud bands, cyclonic mega-storm systems, swirling atmospheric vortices, layered chromatic belts",
  ice:
    "glacier shelves, cryovolcanic scars, frozen rift valleys, wind-polished ice fields, cracked polar caps",
  ocean:
    "deep cobalt oceans, continental shelves, volcanic archipelagos, cloud-shadowed storm belts, bioluminescent shallows",
  desert:
    "mega-dune seas, canyon labyrinths, wind-carved mesas, salt flats, dry mineral basins",
  volcanic:
    "obsidian crust plates, magma rivers, caldera chains, sulfur plains, heat-scarred tectonic fractures",
};

type PlanetGenerationRequest = {
  prompt?: string;
  planet?: {
    name?: string;
    type?: PlanetType;
    habitable?: boolean;
    orbitRadius?: number;
    size?: number;
  };
  system?: {
    spectralClass?: SpectralClass;
    hasBlackHole?: boolean;
    temperature?: number;
  };
};

function buildPlanetPrompt(payload: PlanetGenerationRequest): string {
  if (payload.prompt?.trim()) {
    return [
      `Ultra-detailed seamless 2:1 equirectangular planet texture map of ${payload.prompt.trim()}.`,
      "Orbital cartography perspective, full-globe UV wrap for sphere mapping.",
      "No stars, no space background, no horizon line, no text, no logos, no watermark, no UI.",
      "No Man's Sky-inspired color drama with realistic geological structure and crisp terrain detail.",
    ].join(" ");
  }

  const planetType = payload.planet?.type ?? "rocky";
  const planetName = payload.planet?.name?.trim() || "uncharted exoplanet";
  const habitable = Boolean(payload.planet?.habitable);
  const orbitRadius = payload.planet?.orbitRadius;
  const radius = payload.planet?.size;
  const spectralClass = payload.system?.spectralClass;
  const hasBlackHole = Boolean(payload.system?.hasBlackHole);
  const starTemperature = payload.system?.temperature;

  const styleGuide = PLANET_STYLE_GUIDE[planetType];

  const contextBits = [
    orbitRadius ? `orbit distance ${orbitRadius.toFixed(2)} AU` : null,
    radius ? `planet radius ${radius.toFixed(2)} Earth radii` : null,
    spectralClass ? `host star class ${spectralClass}` : null,
    starTemperature ? `stellar temperature ${Math.round(starTemperature)}K` : null,
    hasBlackHole ? "nearby black-hole gravitational lensing" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `Ultra-detailed seamless 2:1 equirectangular albedo texture map for ${planetName}, a ${planetType} exoplanet.`,
    "Full-globe texture for UV sphere wrapping, seamless at left-right seam and coherent at poles.",
    `Surface features: ${styleGuide}.`,
    habitable
      ? "Subtle biosphere signatures and plausible hydrology, no cities or artificial structures."
      : "Lifeless natural geology only.",
    contextBits ? `Context: ${contextBits}.` : null,
    "No baked lighting, no directional shadows, no stars, no space background, no atmosphere halo.",
    "No text, labels, logos, watermark, spacecraft, people, or creatures.",
    "No Man's Sky-inspired vivid palette with physically coherent terrain and high-frequency detail.",
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
    console.error("Gemini planet generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fal generation (fallback)
// ---------------------------------------------------------------------------

async function generateWithFal(prompt: string): Promise<string | null> {
  try {
    const model = process.env.FAL_PLANET_MODEL === "fal-ai/flux/schnell"
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
    console.error("Fal planet generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as PlanetGenerationRequest;
    const prompt = buildPlanetPrompt(payload);

    if (!prompt) {
      return NextResponse.json({ error: "Planet payload is required" }, { status: 400 });
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
    console.error("Planet generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate planet texture" },
      { status: 500 },
    );
  }
}
