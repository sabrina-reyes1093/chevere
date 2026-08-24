export type SiteContentSource = {
  source: string;
  usedFallback: boolean;
  error?: unknown;
};

type Options = {
  githubConfigured: boolean;
  bundledSource: string;
  loadRemote: () => Promise<string | null>;
  loadLocal: () => Promise<string>;
  validateSource: (source: string) => void;
};

export async function resolveSiteContentSource({
  githubConfigured,
  bundledSource,
  loadRemote,
  loadLocal,
  validateSource,
}: Options): Promise<SiteContentSource> {
  if (githubConfigured) {
    try {
      const source = await loadRemote();
      if (source === null) throw new Error("site-content.json was not found in the repository.");
      validateSource(source);
      return { source, usedFallback: false };
    } catch (error) {
      if (!bundledSource) throw error;
      validateSource(bundledSource);
      return { source: bundledSource, usedFallback: true, error };
    }
  }

  try {
    const source = await loadLocal();
    validateSource(source);
    return { source, usedFallback: false };
  } catch (error) {
    if (!bundledSource) throw error;
    validateSource(bundledSource);
    return { source: bundledSource, usedFallback: true, error };
  }
}
