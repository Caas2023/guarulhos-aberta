import { NextResponse } from "next/server";

export async function GET(request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const query = new URL(request.url).searchParams.get("q") || "empresas em Guarulhos SP";
  if (!key) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY não configurada", places: [] }, { status: 503 });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.primaryType,places.primaryTypeDisplayName,places.id",
    },
    body: JSON.stringify({ textQuery: `${query}, Guarulhos, SP`, languageCode: "pt-BR", regionCode: "BR", pageSize: 20 }),
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json({ error: payload.error?.message || "Google Places API error", places: [] }, { status: response.status });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
