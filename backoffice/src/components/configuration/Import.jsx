import { useEffect, useState } from "react";
import Sidebar from "../layout/Sidebar.jsx";
import { importCSV, csvToJson, jsonToXml } from "../../utils/csv.import.js";
import { importWorkflowFromFiles } from "../../services/import.js";
import { unZip } from "../../utils/unZip.js";

function Import() {
  const [previewContent, setPreviewContent] = useState(null);
  const [previewFormat, setPreviewFormat] = useState("json");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importPhoto, setImportPhoto] = useState(false);

  // stockage des fichiers
  const [csvFiles, setCsvFiles] = useState({
    fichier1: null,
    fichier2: null,
    fichier3: null,
  });

  const [zipFile, setZipFile] = useState(null);

  const [previewFiles, setPreviewFiles] = useState([]);
  const [importStatus, setImportStatus] = useState(null);

  useEffect(() => {
    if (!previewFiles.length) return;
    if (!previewFiles[previewIndex]) return;

    loadPreview(previewFiles[previewIndex].file, previewFormat);
  }, [previewFiles, previewIndex, previewFormat]);

  function handleCsvFile(key, file) {
    const updatedFiles = {
      ...csvFiles,
      [key]: file,
    };

    setCsvFiles(updatedFiles);

    // génération des fichiers preview
    const previews = Object.entries(updatedFiles)
      .filter(([_, value]) => value)
      .map(([key, value]) => ({
        key,
        file: value,
      }));

    setPreviewFiles(previews);

    if (previews.length > 0) {
      setPreviewIndex(0);
    }
  }

  function handleZipFile(file) {
    setZipFile(file);
  }

  async function loadPreview(file, format) {
    setLoading(true);

    try {
      const csv = await importCSV(file);
      const json = csvToJson(csv).slice(0, 50);

      if (format === "xml") {
        const xml = jsonToXml(json, {
          rootName: "rows",
          itemName: "row",
        });

        setPreviewContent(xml);
      } else {
        setPreviewContent(JSON.stringify(json, null, 2));
      }
    } catch (err) {
      console.error(err);
      setPreviewContent(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const filesToImport = [];
    const importPhotoCheck = handleCkeckImportphoto(importPhoto);

    // ajout des csv avec prefix
    Object.entries(csvFiles).forEach(([prefix, file]) => {
      if (file) {
        const renamedFile = new File([file], `${prefix}_${file.name}`, {
          type: file.type,
        });

        filesToImport.push(renamedFile);
      }
    });

    // unzip + ajout des images
    if (zipFile) {
      try {
        const extractedFiles = await unZip(zipFile);

        filesToImport.push(...extractedFiles);
      } catch (err) {
        console.error("Erreur unzip :", err);

        setImportStatus({
          ok: false,
          message: "Erreur lors du dézippage du ZIP",
        });

        return;
      }
    }

    if (!filesToImport.length) return;

    setLoading(true);
    setImportStatus(null);

    try {
      await importWorkflowFromFiles(filesToImport, importPhotoCheck);

      setImportStatus({
        ok: true,
        message: "Import reussi",
      });
    } catch (err) {
      const msg = err?.details || err?.message || "Erreur import";

      setImportStatus({
        ok: false,
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleCkeckImportphoto(value) {
    if (value) {
      setImportPhoto(false);
    } else {
      setImportPhoto(true);
    }
    console.log("[TEST] import photo : ", importPhoto);
    return importPhoto;
  }

  function handleReset() {
    setCsvFiles({
      fichier1: null,
      fichier2: null,
      fichier3: null,
    });

    setZipFile(null);
    setPreviewFiles([]);
    setPreviewContent(null);
    setPreviewIndex(0);
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main p-4">
        <h1 className="h4">Importer CSV</h1>

        <p className="text-muted">Sélectionnez vos fichiers CSV et ZIP.</p>

        <div className="card p-3 mb-3">
          {/* CSV 1 */}
          <div className="mb-3">
            <label className="form-label">CSV 1 (prefixe : fichier1_)</label>

            <input
              type="file"
              accept=".csv,text/csv"
              className="form-control"
              onChange={(e) => handleCsvFile("fichier1", e.target.files?.[0])}
            />

            {csvFiles.fichier1 && (
              <div className="small text-muted mt-1">
                {csvFiles.fichier1.name}
              </div>
            )}
          </div>

          {/* CSV 2 */}
          <div className="mb-3">
            <label className="form-label">CSV 2 (prefixe : fichier2_)</label>

            <input
              type="file"
              accept=".csv,text/csv"
              className="form-control"
              onChange={(e) => handleCsvFile("fichier2", e.target.files?.[0])}
            />

            {csvFiles.fichier2 && (
              <div className="small text-muted mt-1">
                {csvFiles.fichier2.name}
              </div>
            )}
          </div>

          {/* CSV 3 */}
          <div className="mb-3">
            <label className="form-label">CSV 3 (prefixe : fichier3_)</label>

            <input
              type="file"
              accept=".csv,text/csv"
              className="form-control"
              onChange={(e) => handleCsvFile("fichier3", e.target.files?.[0])}
            />

            {csvFiles.fichier3 && (
              <div className="small text-muted mt-1">
                {csvFiles.fichier3.name}
              </div>
            )}
          </div>

          {/* ZIP */}
          <div className="mb-3">
            <label className="form-label">Fichier ZIP</label>

            <input
              type="file"
              accept=".zip,application/zip"
              className="form-control"
              onChange={(e) => handleZipFile(e.target.files?.[0])}
            />

            {zipFile && (
              <div className="small text-muted mt-1">{zipFile.name}</div>
            )}

            <label className="form-label">Check importation des photos</label>
            <input
              type="checkbox"
              name="import_photo"
              id="import_photo"
              onChange={(e) => handleCkeckImportphoto(importPhoto)}
            />
          </div>

          {/* Preview select */}
          {previewFiles.length > 0 && (
            <div className="d-flex flex-column flex-md-row gap-2 align-items-md-end mb-3">
              <div className="flex-grow-1">
                <label className="form-label">Aperçu du fichier</label>

                <select
                  className="form-select"
                  value={previewIndex}
                  onChange={(e) => setPreviewIndex(Number(e.target.value))}
                >
                  {previewFiles.map((item, idx) => (
                    <option key={item.key} value={idx}>
                      {item.key} - {item.file.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Format</label>

                <div
                  className="btn-group"
                  role="group"
                  aria-label="Format preview"
                >
                  <button
                    type="button"
                    className={`btn btn-outline-secondary ${
                      previewFormat === "json" ? "active" : ""
                    }`}
                    onClick={() => setPreviewFormat("json")}
                  >
                    JSON
                  </button>

                  <button
                    type="button"
                    className={`btn btn-outline-secondary ${
                      previewFormat === "xml" ? "active" : ""
                    }`}
                    onClick={() => setPreviewFormat("xml")}
                  >
                    XML
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="d-flex gap-2">
            <button
              className="btn btn-success"
              onClick={handleImport}
              disabled={loading}
            >
              Importer
            </button>

            <button className="btn btn-outline-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>

        {loading && <div>Traitement...</div>}

        {importStatus && (
          <div
            className={`alert ${
              importStatus.ok ? "alert-success" : "alert-danger"
            } mt-2`}
          >
            {importStatus.message}
          </div>
        )}

        {previewContent && (
          <section className="card p-3">
            <h2 className="h6">
              Aperçu {previewFormat.toUpperCase()} (premières lignes)
            </h2>

            <pre
              style={{
                maxHeight: 300,
                overflow: "auto",
              }}
            >
              {previewContent}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}

export default Import;
