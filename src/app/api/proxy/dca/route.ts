import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // Force Node.js runtime for stability

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Forward to Jupiter DCA API
        const response = await fetch("https://dca-api.jup.ag/v1/create", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Jupiter DCA API Error (Create):", response.status, errorText);
            return NextResponse.json({ error: `Jupiter API Error: ${errorText}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Proxy DCA POST Error:", error);
        return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const wallet = searchParams.get("wallet");

        if (!wallet) {
            return NextResponse.json({ error: "Missing wallet parameter" }, { status: 400 });
        }

        const response = await fetch(`https://dca-api.jup.ag/v1/user?wallet=${wallet}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Jupiter DCA API Error (Fetch):", response.status, errorText);
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Proxy DCA GET Error:", error);
        return NextResponse.json({ error: "Proxy Fetch Error" }, { status: 500 });
    }
}
