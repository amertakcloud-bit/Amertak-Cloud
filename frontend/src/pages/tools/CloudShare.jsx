import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../services/api";
import { useFeedback } from "../../components/ui/Feedback";
import { useLanguage } from "../../context/LanguageContext";

const EXPIRATION_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "1h", label: "In 1 hour" },
  { value: "1d", label: "In 1 day" },
  { value: "7d", label: "In 7 days" },
];

export default function CloudShare() {
  const { toast } = useFeedback();
  const { t } = useLanguage();
  const [available, setAvailable] = useState(true);

  // Ask the server whether file storage exists on this deployment (it does not on Vercel).
  useEffect(() => {
    fetch(`${API_URL}/cloudshare/config`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAvailable(d?.config?.available !== false))
      .catch(() => {});
  }, []);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expiresIn, setExpiresIn] = useState("never");
  const [view, setView] = useState("select");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [shareLink, setShareLink] = useState("");
  const fileInputRef = useRef(null);

  const updateSelectedFile = (file) => {
    setSelectedFile(file);
    setErrorMessage("");
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast.info(t("csChooseFile"));
      return;
    }
    if (!available) {
      toast.error(t("csUnavailable"));
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (expiresIn && expiresIn !== "never") {
      formData.append("expiresIn", expiresIn);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/cloudshare/upload`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setUploadProgress(percent);
    };

    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}");

        if (xhr.status >= 200 && xhr.status < 300) {
          const nextLink =
            payload?.file?.downloadUrl || payload?.file?.url || "";
          setShareLink(nextLink);
          setView("success");
          setErrorMessage("");
          setUploadProgress(100);
          return;
        }

        const message =
          xhr.status === 413
            ? t("csTooLarge")
            : payload?.error?.message || payload?.message || "Upload failed. Please try again.";
        setErrorMessage(message);
        setView("error");
        toast.error(message);
      } catch {
        const message = xhr.status === 413 ? t("csTooLarge") : t("csBadResponse");
        setErrorMessage(message);
        setView("error");
        toast.error(message);
      }
    };

    xhr.onerror = () => {
      const message = t("err_NETWORK");
      setErrorMessage(message);
      setView("error");
      toast.error(message);
    };

    setUploadProgress(0);
    setErrorMessage("");
    setView("uploading");
    xhr.send(formData);
  };

  const handleBrowse = () => fileInputRef.current?.click();

  const handleCopy = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success(t("copied"));
    } catch {
      const field = document.getElementById("share-link");
      if (field) {
        field.select();
        document.execCommand("copy");
        toast.success(t("copied"));
      }
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setShareLink("");
    setUploadProgress(0);
    setErrorMessage("");
    setView("select");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      updateSelectedFile(file);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return (
    <div className="page">
      <h1 className="page-heading" style={{ marginBottom: 8 }}>
        Cloud Share
      </h1>
      <p className="page-subtitle" style={{ maxWidth: 620, marginBottom: 24 }}>
        Upload a file, get a share link, and send it anywhere.
      </p>

      {!available && (
        <div className="tk-alert err" role="alert" style={{ marginBottom: 16 }}>
          <i className="ri-error-warning-line" />
          {t("csUnavailable")}
        </div>
      )}

      <main className="cloud-container">
        <section className="hero">
          <h1 className="grad">Share files simply.</h1>
          <p className="subtitle">
            Upload a file, generate a link, and share it in seconds.
          </p>
        </section>

        <section className="card">
          {view === "select" && (
            <div className="left">
              <div id="view-select">
                <div
                  className="dropzone"
                  onClick={handleBrowse}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDrop={handleDrop}
                >
                  <svg
                    className="dz-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                  </svg>
                  <p className="dz-title">
                    {selectedFile ? selectedFile.name : "Drag & Drop your file"}
                  </p>
                  <p className="dz-or">or</p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleBrowse}
                  >
                    Browse files
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="visually-hidden"
                  tabIndex="-1"
                  aria-label="Choose a file to upload"
                  onChange={(event) =>
                    updateSelectedFile(event.target.files?.[0] || null)
                  }
                />

                <div className="options">
                  <label htmlFor="expires">Link expires</label>
                  <select
                    id="expires"
                    value={expiresIn}
                    onChange={(event) => setExpiresIn(event.target.value)}
                  >
                    {EXPIRATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="note">
                Maximum file size:{" "}
                <span id="max-size">
                  {Number(import.meta.env.VITE_CLOUD_MAX_SIZE || 100)} MB
                </span>
              </p>

              <div className="center" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-block upload-btn"
                  onClick={handleUpload}
                  disabled={!selectedFile}
                  style={{
                    opacity: selectedFile ? 1 : 0.6,
                    cursor: selectedFile ? "pointer" : "not-allowed",
                  }}
                >
                  Upload file
                </button>
              </div>
            </div>
          )}

          <div className="right">
            {view === "uploading" && (
              <div id="view-uploading">
                <p className="status-title" id="upload-title">
                  Uploading...
                </p>
                <div className="file-row">
                  <div className="file-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                    </svg>
                  </div>
                  <div className="file-meta">
                    <p className="file-name" id="upload-name">
                      {selectedFile?.name || "File"}
                    </p>
                    <p className="file-size" id="upload-size">
                      {selectedFile
                        ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
                        : ""}
                    </p>
                  </div>
                </div>
                <div
                  className="progress"
                  id="progress"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={uploadProgress}
                  aria-labelledby="upload-title"
                >
                  <div
                    className="progress-fill"
                    id="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="progress-label" id="progress-label">
                  {uploadProgress}%
                </p>
                <div className="center">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={resetUpload}
                  >
                    Cancel upload
                  </button>
                </div>
              </div>
            )}

            {view === "error" && (
            <div id="view-error" role="alert">
              <p className="status-title is-error">Upload failed</p>
              <p className="error-text" id="error-message">
                {errorMessage ||
                  "Something went wrong while uploading your file."}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => setView("select")}
              >
                Try again
              </button>
            </div>
          )}
          </div>

          {view === "success" && (
            <div id="view-success">
              <p className="status-title is-success">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Upload Complete
              </p>
              <div className="file-row">
                <div className="file-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                  </svg>
                </div>
                <div className="file-meta">
                  <p className="file-name" id="success-name">
                    {selectedFile?.name || "Uploaded file"}
                  </p>
                  <p className="file-size" id="success-size">
                    {selectedFile
                      ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
                      : ""}
                  </p>
                </div>
              </div>

              <p className="label">Your share link:</p>
              <div className="link-box">
                <input
                  type="text"
                  id="share-link"
                  readOnly
                  value={shareLink}
                  aria-label="Share link"
                />
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCopy}
                >
                  Copy Link
                </button>
                <a
                  className="btn btn-secondary"
                  href={shareLink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Link
                </a>
              </div>

              <div className="center">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetUpload}
                >
                  Upload another file
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="visually-hidden" id="status-live" aria-live="polite" />
      </main>
    </div>
  );
}
