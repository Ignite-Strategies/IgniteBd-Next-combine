function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateRetainerSlug(
  companyName: string,
  retainerName: string,
  serialCode: string
): { slug: string; companySlug: string; part: string } {
  const companySlug = slugify(companyName || "company") || "company";
  const retainerSlug = slugify(retainerName || "retainer") || "retainer";
  const shortId = serialCode.replace(/[^a-z0-9]/gi, "").slice(-8) || "ret";
  const part = `${retainerSlug}-${shortId}`;
  return {
    slug: `${companySlug}/${part}`,
    companySlug,
    part,
  };
}
