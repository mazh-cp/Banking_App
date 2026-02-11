const LAKERA_GUARD_URL = 'https://api.lakera.ai/v1/guard';

export type LakeraGuardResult = {
  flagged: boolean;
  categories?: Record<string, boolean>;
  risk_score?: number;
  raw?: unknown;
};

export async function lakeraGuardInput(input: string, context?: string): Promise<LakeraGuardResult> {
  const apiKey = process.env.LAKERA_GUARD_API_KEY;
  if (!apiKey) {
    return { flagged: false, raw: { skipped: 'no_api_key' } };
  }

  const body = {
    input: input,
    ...(context && { context }),
  };

  try {
    const res = await fetch(LAKERA_GUARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Lakera Guard input scan failed:', res.status, text);
      return { flagged: false, raw: { error: text } };
    }

    const data = (await res.json()) as {
      flagged?: boolean;
      categories?: Record<string, boolean>;
      risk_score?: number;
      [k: string]: unknown;
    };
    return {
      flagged: Boolean(data.flagged),
      categories: data.categories,
      risk_score: data.risk_score,
      raw: data,
    };
  } catch (e) {
    console.error('Lakera Guard input error:', e);
    return { flagged: false, raw: { error: String(e) } };
  }
}

export async function lakeraGuardOutput(output: string): Promise<LakeraGuardResult> {
  const apiKey = process.env.LAKERA_GUARD_API_KEY;
  if (!apiKey) {
    return { flagged: false, raw: { skipped: 'no_api_key' } };
  }

  try {
    const res = await fetch(LAKERA_GUARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: output }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('Lakera Guard output scan failed:', res.status, text);
      return { flagged: false, raw: { error: text } };
    }

    const data = (await res.json()) as {
      flagged?: boolean;
      categories?: Record<string, boolean>;
      risk_score?: number;
      [k: string]: unknown;
    };
    return {
      flagged: Boolean(data.flagged),
      categories: data.categories,
      risk_score: data.risk_score,
      raw: data,
    };
  } catch (e) {
    console.error('Lakera Guard output error:', e);
    return { flagged: false, raw: { error: String(e) } };
  }
}
