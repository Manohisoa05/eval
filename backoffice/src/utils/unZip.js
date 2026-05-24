import JSZip from "jszip";

/**
 * Dezip un fichier ZIP et retourne les fichiers extraits
 * sous forme de File[]
 */
export async function unZip(zipFile) {
  if (!zipFile) return [];

  const zip = await JSZip.loadAsync(zipFile);

  const extractedFiles = [];

  const entries = Object.values(zip.files);

  for (const entry of entries) {

    // ignorer les dossiers
    if (entry.dir) continue;

    const blob = await entry.async("blob");

    const file = new File(
      [blob],
      entry.name,
      {
        type: blob.type || "application/octet-stream",
      }
    );

    extractedFiles.push(file);
  }

  return extractedFiles;
}