import { NextRequest, NextResponse } from "next/server";

// Usá esta ruta si tu proyecto tiene carpeta /app (App Router).
// Colocala en: app/api/wearbody-import/route.ts

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no está configurada en las variables de entorno del servidor" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error desconocido al contactar la API de Anthropic" },
      { status: 500 }
    );
  }
}
