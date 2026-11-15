import { NextResponse } from "next/server";
import {
  areDatabaseIntegrationsHealthy,
  checkDatabaseIntegrations,
} from "@/lib/services/database-health";
import {
  createSupabaseServerClient,
  isServerSupabaseConfigured,
} from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      {
        status: "degraded",
        phase: "Phase 3 — Database Integration",
        supabase: {
          credentialsConfigured: false,
          databaseIntegrationActive: false,
          checks: null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const checks = await checkDatabaseIntegrations(supabase);
    const healthy = areDatabaseIntegrationsHealthy(checks);

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "degraded",
        phase: "Phase 3 — Database Integration",
        businessModel: "Centrally managed dairy delivery service",
        launchArea: "Topsia, Kolkata",
        timezone: "Asia/Kolkata",
        currency: "INR (integer paise storage)",
        supabase: {
          credentialsConfigured: true,
          databaseIntegrationActive: healthy,
          dataSource: "Supabase (RLS-protected publishable/anon access)",
          checks,
        },
        timestamp: new Date().toISOString(),
      },
      { status: healthy ? 200 : 503, headers },
    );
  } catch (error) {
    console.error("[api/health] Database integration health check failed:", error);
    return NextResponse.json(
      {
        status: "degraded",
        phase: "Phase 3 — Database Integration",
        supabase: {
          credentialsConfigured: true,
          databaseIntegrationActive: false,
          checks: null,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }
}
