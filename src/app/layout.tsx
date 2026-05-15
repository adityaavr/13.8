import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SceneLoader } from "@/components/canvas/scene-loader";
import { UniverseInitializer } from "@/components/universe-initializer";
import { NavigationController } from "@/components/navigation-controller";
import { CameraControlsUI } from "@/components/camera-controls-ui";
import { OnboardingHints } from "@/components/onboarding-hints";
import { FinalReport } from "@/components/final-report";
import { AudioController } from "@/components/audio-controller";
import { TimeScrubber } from "@/components/time-scrubber";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "13.8 — The Fermi Paradox Simulator",
  description:
    "A journey through 13.8 billion years. Every civilisation that rose and fell before us.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        <SceneLoader />
        <UniverseInitializer />
        <NavigationController />
        <CameraControlsUI />
        <OnboardingHints />
        <FinalReport />
        <AudioController />
        <TimeScrubber />
        {children}
      </body>
    </html>
  );
}
