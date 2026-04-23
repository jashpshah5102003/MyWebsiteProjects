const businessIdeaEl = document.getElementById("businessIdea");
const supportingFileEl = document.getElementById("supportingFile");
const contextNotesEl = document.getElementById("contextNotes");
const planModeEl = document.getElementById("planMode");
const productTypeEl = document.getElementById("productType");
const speedModeEl = document.getElementById("speedMode");
const useResearchEl = document.getElementById("useResearch");
const providerListEl = document.getElementById("providerList");
const generateBtn = document.getElementById("generateBtn");
const statusEl = document.getElementById("status");
const fileSummaryEl = document.getElementById("fileSummary");
const previewEl = document.getElementById("preview");
const metaEl = document.getElementById("meta");
const copyBtn = document.getElementById("copyBtn");
const downloadMdBtn = document.getElementById("downloadMdBtn");
const downloadDocxBtn = document.getElementById("downloadDocxBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const sourcesPanelEl = document.getElementById("sourcesPanel");
const sourceBadgeEl = document.getElementById("sourceBadge");

let extractedFileText = "";
let latestMarkdown = "";
let latestSources = [];
let providers = {};

const pdfModule = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
pdfModule.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

function setStatus(message, tone = "idle") {
  statusEl.textContent = message;
  statusEl.className = `status ${tone}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function selectedProviders() {
  return [...providerListEl.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function selectedProviderSupportsResearch() {
  return selectedProviders().some((providerId) => providers[providerId]?.supportsResearch);
}

function setDownloadState(disabled) {
  copyBtn.disabled = disabled;
  downloadMdBtn.disabled = disabled;
  downloadDocxBtn.disabled = disabled;
  downloadPdfBtn.disabled = disabled;
}

function syncResearchAvailability() {
  if (!selectedProviderSupportsResearch()) {
    useResearchEl.checked = false;
  }
  useResearchEl.disabled = !selectedProviderSupportsResearch();
}

async function readTextFile(file) {
  return file.text();
}

async function readPdfFile(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await pdfModule.getDocument({ data: bytes }).promise;
  const pages = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ");
    pages.push(`Page ${pageIndex}\n${text}`);
  }

  return pages.join("\n\n");
}

async function readDocxFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function readPptxFile(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const parser = new DOMParser();
  const slides = [];

  for (const slideName of slideNames) {
    const xmlText = await zip.files[slideName].async("text");
    const xml = parser.parseFromString(xmlText, "application/xml");
    const texts = [...xml.getElementsByTagName("a:t")].map((node) => node.textContent?.trim()).filter(Boolean);
    slides.push(`${slideName.split("/").pop()?.replace(".xml", "")}\n${texts.join("\n")}`);
  }

  return slides.join("\n\n");
}

async function extractFileText(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json") || name.endsWith(".csv")) {
    return readTextFile(file);
  }

  if (name.endsWith(".pdf")) {
    return readPdfFile(file);
  }

  if (name.endsWith(".doc") || name.endsWith(".docx")) {
    return readDocxFile(file);
  }

  if (name.endsWith(".pptx")) {
    return readPptxFile(file);
  }

  throw new Error("Unsupported file type. Use TXT, Markdown, PDF, DOC/DOCX, PPTX, JSON, or CSV.");
}

function renderSources(sources) {
  latestSources = sources || [];

  if (!latestSources.length) {
    sourceBadgeEl.textContent = "No citations yet";
    sourcesPanelEl.className = "sources empty";
    sourcesPanelEl.textContent = "Live source citations will appear here when research-backed runs are available.";
    return;
  }

  sourceBadgeEl.textContent = `${latestSources.length} source${latestSources.length === 1 ? "" : "s"}`;
  sourcesPanelEl.className = "sources";
  sourcesPanelEl.innerHTML = latestSources.map((source, index) => `
    <a class="source-item" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
      <strong>${index + 1}. ${escapeHtml(source.title || source.url)}</strong>
      <span>${escapeHtml(source.url)}</span>
    </a>
  `).join("");
}

async function loadProviders() {
  const response = await fetch("/api/providers");
  const data = await response.json();
  providers = data.providers || {};

  if (!Object.keys(providers).length) {
    providerListEl.innerHTML = `
      <div class="provider">
        <div>
          <strong>No providers configured</strong>
          <div class="muted">Add API keys in <code>.env</code> and refresh. See the README for the exact variable names.</div>
        </div>
      </div>
    `;
    generateBtn.disabled = true;
    return;
  }

  providerListEl.innerHTML = Object.entries(providers).map(([id, info], index) => `
    <label class="provider">
      <input type="checkbox" value="${id}" ${index === 0 ? "checked" : ""}>
      <div>
        <strong>${escapeHtml(info.label)}</strong>
        <div class="muted">Model: <code>${escapeHtml(info.model)}</code></div>
        <div class="muted">${info.supportsResearch ? "Supports live research" : "Generation only"}</div>
      </div>
    </label>
  `).join("");

  providerListEl.addEventListener("change", syncResearchAvailability);
  syncResearchAvailability();
  generateBtn.disabled = false;
}

supportingFileEl.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  extractedFileText = "";

  if (!file) {
    fileSummaryEl.textContent = "No file processed yet.";
    return;
  }

  fileSummaryEl.textContent = `Processing ${file.name}...`;

  try {
    const text = await extractFileText(file);
    extractedFileText = text.trim();
    const preview = extractedFileText.slice(0, 280).replace(/\s+/g, " ");
    fileSummaryEl.innerHTML = `
      <strong>${escapeHtml(file.name)}</strong><br>
      Extracted ${extractedFileText.length.toLocaleString()} characters.<br>
      <span class="muted">${escapeHtml(preview || "No readable text detected.")}${extractedFileText.length > 280 ? "..." : ""}</span>
    `;
  } catch (error) {
    fileSummaryEl.textContent = error.message;
    setStatus(error.message, "error");
  }
});

async function generateDocument() {
  const businessIdea = businessIdeaEl.value.trim();
  const contextNotes = contextNotesEl.value.trim();
  const planMode = planModeEl.value;
  const productType = productTypeEl.value;
  const speedMode = speedModeEl.value;
  const chosenProviders = selectedProviders();
  const useResearch = useResearchEl.checked && selectedProviderSupportsResearch();

  if (!businessIdea && !extractedFileText) {
    setStatus("Add a business idea or upload a supporting document first.", "error");
    return;
  }

  if (!chosenProviders.length) {
    setStatus("Select at least one AI provider.", "error");
    return;
  }

  generateBtn.disabled = true;
  setDownloadState(true);
  setStatus(
    speedMode === "fast"
      ? "Generating a faster draft."
      : "Generating business plan, competitor packet, and PRD. This can take a little while for multi-provider runs.",
    "loading"
  );
  metaEl.textContent = "";
  renderSources([]);
  previewEl.classList.remove("empty");
  previewEl.innerHTML = "<p>Working...</p>";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessIdea,
        supportingText: extractedFileText,
        contextNotes,
        planMode,
        productType,
        speedMode,
        providers: chosenProviders,
        useResearch,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Generation failed.");
    }

    latestMarkdown = data.markdown || "";
    previewEl.innerHTML = marked.parse(latestMarkdown);
    renderSources(data.sources || []);
    const researchText = data.researchUsed ? "Live research used." : "No live research used.";
    const speedText = speedMode === "fast" ? "Fast mode." : "Detailed mode.";
    const fallbackText = data.fellBackToDemo ? " Demo fallback was used." : "";
    metaEl.textContent = `Planning models: ${data.providersUsed.map((item) => `${item.label} (${item.model})`).join(", ")}. Final synthesis: ${data.synthesizer.label} (${data.synthesizer.model}). ${speedText} ${researchText}${fallbackText}`;
    setStatus(data.warning || "Document generated successfully.", data.warning ? "error" : "success");
    setDownloadState(false);
  } catch (error) {
    previewEl.textContent = "";
    previewEl.classList.add("empty");
    previewEl.textContent = "No document generated yet.";
    renderSources([]);
    setStatus(error.message, "error");
  } finally {
    generateBtn.disabled = false;
  }
}

function downloadBlob(content, mimeType, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportDocx() {
  if (!latestMarkdown) return;

  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = window.docx;
  const lines = latestMarkdown.split("\n");
  const children = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      children.push(new Paragraph({ text: "" }));
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1 }));
      continue;
    }

    if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2 }));
      continue;
    }

    if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: line.slice(4).trim(), heading: HeadingLevel.HEADING_3 }));
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      children.push(new Paragraph({ text: line.slice(2).trim(), bullet: { level: 0 } }));
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      children.push(new Paragraph({ text: line.replace(/^\d+\.\s/, "").trim(), numbering: { reference: "numbered-list", level: 0 } }));
      continue;
    }

    children.push(new Paragraph({ children: [new TextRun(line)] }));
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "numbered-list",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: "start",
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "business-plan-prd.docx");
}

async function exportPdf() {
  if (!latestMarkdown) return;
  const element = previewEl.cloneNode(true);
  element.style.padding = "24px";
  element.style.background = "#ffffff";
  element.style.color = "#111111";

  await html2pdf()
    .set({
      margin: 0.5,
      filename: "business-plan-prd.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    })
    .from(element)
    .save();
}

generateBtn.addEventListener("click", generateDocument);

copyBtn.addEventListener("click", async () => {
  if (!latestMarkdown) return;
  await navigator.clipboard.writeText(latestMarkdown);
  setStatus("Markdown copied to clipboard.", "success");
});

downloadMdBtn.addEventListener("click", () => {
  if (!latestMarkdown) return;
  downloadBlob(latestMarkdown, "text/markdown;charset=utf-8", "business-plan-prd.md");
});

downloadDocxBtn.addEventListener("click", async () => {
  try {
    await exportDocx();
    setStatus("DOCX exported.", "success");
  } catch (error) {
    setStatus(`DOCX export failed: ${error.message}`, "error");
  }
});

downloadPdfBtn.addEventListener("click", async () => {
  try {
    await exportPdf();
    setStatus("PDF exported.", "success");
  } catch (error) {
    setStatus(`PDF export failed: ${error.message}`, "error");
  }
});

loadProviders().catch((error) => {
  setStatus(error.message, "error");
});
