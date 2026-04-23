const SYSTEM_PROMPT = `
You are a senior startup strategist, product leader, operator, product marketer, and PRD writer.

Produce a polished, implementation-ready business planning document in Markdown.
The document must be specific, practical, and explicit about assumptions.

Required sections:
1. Executive Summary
2. Business Name Options with one recommendation
3. Vision, Mission, and Goals
4. Problem Statement and Opportunity
5. Target Audience and Customer Segments
6. Revenue Model
7. Cost Breakdown and Budget Projections
8. Market and Competition Analysis
9. Our Business SWOT
10. Our Business PESTLE
11. Step-by-Step Launch Plan
12. Three Execution Plans
13. Department-Wise Implementation Plan
14. PRD Section
15. AI Stack Recommendations
16. Assumptions, Risks, and Open Questions
17. Source and Model Usage Note

Rules:
- Ground every major section in the user's product or business idea.
- Start by identifying the exact product, target user, and problem from the input.
- If the input is ambiguous, explicitly say what assumption you made and keep the rest aligned to that assumption.
- Do not fabricate hard facts.
- Clearly mark estimates and strategic inferences.
- If research notes are provided, use them for grounded competitor and market analysis.
- Include top 5 competitors with concise SWOT and PESTLE analysis.
- Include zero-cost MVP, low-cost build, and large-scale implementation plans.
- Include department-wise AI tools and at least one concrete prompt per department.
- Include tables where useful.
- End with a short implementation-ready summary.
`.trim();

const INVESTOR_PROMPT = `
Prioritize investor-grade business analysis.

Emphasize:
- market size logic and expansion path
- wedge strategy and defensibility
- monetization, margins, and capital efficiency
- realistic risks, milestones, and proof points
- likely funding path, investor categories, and what traction would matter
`.trim();

const SOFTWARE_PRD_PROMPT = `
Prioritize a software-first or AI-product-first PRD.

Emphasize:
- product architecture assumptions
- clear user flows and personas
- MVP scope discipline
- feature prioritization
- technical requirements, integrations, security, and analytics
- launch metrics and product iteration loops
`.trim();

const BALANCED_PROMPT = `
Balance strategic business planning with a practical product execution plan.
The final document should work for both founder decision-making and early execution.
`.trim();

const ANALYST_PROMPT = `
Create a sharp strategy memo for this business idea.

Focus on:
- the exact product or service described by the user
- business concept and target customer
- market category and positioning
- monetization options and budget logic
- risks and assumptions
- suggested MVP scope
- recommended AI tooling by function

Keep it compact and structured. Do not give generic startup advice that is not directly tied to the described idea.
`.trim();

const FAST_PROMPT = `
Create a fast but useful business plan and PRD draft.

Priorities:
- stay tightly grounded in the user's exact idea
- keep sections concise
- avoid unnecessary elaboration
- include only the most decision-useful competitor, budget, and execution details
`.trim();

const COMPETITOR_PROMPT = `
Create a market and competitor packet for this business idea.

Output:
- a one-sentence restatement of the exact product being analyzed
- likely market category
- target segment
- top 5 competitors
- concise comparison table
- SWOT and PESTLE bullets for each competitor
- key positioning gaps the new business can exploit
`.trim();

const PRD_PROMPT = `
Create a product requirements packet for this business idea.

Include:
- a short restatement of the exact product idea in product terms
- product overview
- primary personas
- jobs to be done
- MVP feature set
- user stories
- functional requirements
- non-functional requirements
- risks, dependencies, and milestones
`.trim();

const RESEARCH_PROMPT = `
Use live web research to gather current, grounded market information for this business idea.

Return:
- likely category and market trend snapshot
- top 5 competitors with one-line positioning notes
- any visible pricing clues, funding clues, or differentiators
- noteworthy risks, regulatory issues, or market constraints
- recommended target wedge for market entry
`.trim();

const SYNTHESIS_PROMPT = `
You are synthesizing multiple AI planning packets into one final business-planning and PRD document.
Use the packets as advisory inputs, not unquestionable facts.
Merge overlapping ideas, keep the strongest recommendations, remove contradictions, and produce one final Markdown document that follows the required 17-section structure exactly.
`.trim();

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clampText(value, limit = 24000) {
  const text = (value || "").trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}\n\n[Truncated for length]`;
}

function availableProviders(env) {
  const providers = {
    demo: { label: "Demo Mode", model: "local-template", supportsResearch: false },
  };
  if (env.OPENAI_API_KEY) {
    providers.openai = { label: "OpenAI", model: env.OPENAI_MODEL || "gpt-5.2", supportsResearch: true };
  }
  if (env.GEMINI_API_KEY) {
    providers.gemini = { label: "Google Gemini", model: env.GEMINI_MODEL || "gemini-2.5-flash", supportsResearch: true };
  }
  if (env.ANTHROPIC_API_KEY) {
    providers.anthropic = { label: "Anthropic", model: env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", supportsResearch: false };
  }
  if (env.CUSTOM_OPENAI_API_KEY && env.CUSTOM_OPENAI_BASE_URL) {
    providers.custom = {
      label: env.CUSTOM_OPENAI_LABEL || "Custom OpenAI-Compatible",
      model: env.CUSTOM_OPENAI_MODEL || "grok-3-mini",
      supportsResearch: false,
    };
  }
  return providers;
}

function buildUserPrompt(payload) {
  return `
Business idea:
${clampText(payload.businessIdea, 16000) || "[No direct business idea text provided]"}

Extracted supporting material:
${clampText(payload.supportingText, 18000) || "[No supporting document text provided]"}

Additional context:
${clampText(payload.contextNotes, 4000) || "[No extra context provided]"}
`.trim();
}

function buildFocusPrompt(payload) {
  const planMode = payload.planMode || "balanced";
  const productType = payload.productType || "software";
  const parts = [`Planning mode: ${planMode}`, `Product type: ${productType}`];
  if (planMode === "investor") parts.push(INVESTOR_PROMPT);
  else if (planMode === "software_prd") parts.push(SOFTWARE_PRD_PROMPT);
  else parts.push(BALANCED_PROMPT);
  if (productType === "service") {
    parts.push("Treat this as service-led or operations-led where relevant, but still provide a digitized execution path and scalable systems plan.");
  } else if (productType === "hybrid") {
    parts.push("Assume a hybrid business with both service and software/product layers. Show how services can validate demand and later convert into scalable product workflows.");
  } else {
    parts.push("Assume the business can be executed as a software-first or AI-enabled product unless the input strongly contradicts that.");
  }
  return parts.join("\n\n");
}

function buildResearchPrompt(payload) {
  return `${buildUserPrompt(payload)}\n\n${buildFocusPrompt(payload)}\n\nPlease research this idea using live web search where available.`;
}

function buildDemoMemo(payload, heading) {
  const businessIdea = (payload.businessIdea || "A new business idea").trim();
  const contextNotes = (payload.contextNotes || "").trim() || "No extra context was provided.";
  const productType = payload.productType || "software";
  return `
${heading}

- Business concept: ${businessIdea}
- Planning mode: ${payload.planMode || "balanced"}
- Product type: ${productType}
- Context: ${contextNotes}
- Recommended monetization options: subscription, implementation services, premium support, and partnerships where relevant
- Suggested MVP scope: one narrow workflow, one core user persona, one measurable outcome, and one acquisition channel
- Operating risks: unclear positioning, overbuilding before validation, weak distribution, pricing mismatch, and underestimating operations
- AI tooling focus: research, document generation, prototyping, website creation, CRM automation, pitch deck drafting, and analytics
`.trim();
}

function buildDemoDocument(payload, packets, useResearch) {
  const businessIdea = (payload.businessIdea || "Untitled business idea").trim();
  const businessName = businessIdea.split(".")[0].slice(0, 48).trim() || "VenturePilot";
  const packetNames = packets.map((packet) => `${packet.label} (${packet.model})`).join(", ");
  return `
# ${businessName}

## 1. Executive Summary
This draft is based on the user's stated product idea: **${businessIdea}**.

This output was generated in demo mode, so it is a grounded planning draft rather than verified market research.

## 2. Business Name Options with one recommendation
| Option | Notes |
| --- | --- |
| ${businessName} | Strong direct fit based on the stated idea |
| ${businessName} Labs | Feels product-led and modern |
| ${businessName} Works | Good for services plus software |
| ${businessName} AI | Best when AI is customer-facing |

Recommended option: **${businessName}**

## 3. Vision, Mission, and Goals
**Vision:** Build a scalable business around the core idea of "${businessIdea}".

**Mission:** Deliver a clear solution to a real customer problem with fast validation, lean operations, and AI-assisted execution.

## 4. Problem Statement and Opportunity
The problem being addressed is derived directly from the user's idea: **${businessIdea}**.

## 5. Target Audience and Customer Segments
Primary segment: likely early adopters aligned with the business concept.

## 6. Revenue Model
- Subscription or retainer revenue
- One-time setup or implementation fees
- Premium advisory or support

## 7. Cost Breakdown and Budget Projections
| Scenario | Monthly Estimate | Notes |
| --- | --- | --- |
| Lean | $300-$1,000 | Domain, hosting, AI usage, basic tools |
| Standard | $2,000-$8,000 | Contractors, software stack, marketing tests |
| Scale | $15,000+ | Team, distribution, paid acquisition, ops |

## 8. Market and Competition Analysis
Top 5 competitors should be finalized through live research once provider keys are connected. In demo mode, these are category placeholders.

## 9. Our Business SWOT
- Strengths: speed, flexibility, focused execution, AI leverage
- Weaknesses: low initial brand trust, limited resources
- Opportunities: niche specialization, fast MVP launch
- Threats: incumbents, positioning drift, acquisition costs

## 10. Our Business PESTLE
- Political: sector-specific policy may matter
- Economic: budgets affect adoption
- Social: trust and behavior change matter
- Technological: AI lowers build cost but raises competition
- Legal: privacy, contracts, and IP need review
- Environmental: relevant if physical operations exist

## 11. Step-by-Step Launch Plan
1. Define the narrowest customer problem and success metric.
2. Validate with target users.
3. Build the smallest usable MVP.
4. Launch pilots and refine positioning.

## 12. Three Execution Plans
### Plan A: Zero-Cost MVP
- No-code tools, free tiers, and manual delivery

### Plan B: Low-Cost Product Creation
- Lightweight stack and contractor support

### Plan C: Large-Scale Implementation
- Team, analytics, compliance, and GTM expansion

## 13. Department-Wise Implementation Plan
| Department | AI Tools | Example Prompt |
| --- | --- | --- |
| Finance | Spreadsheet copilots, LLMs | "Create a 12-month startup budget for this business idea." |
| Marketing | LLMs, ad copy tools | "Build a full-funnel campaign for this target audience." |
| Product | LLMs, code copilots | "Generate a landing page structure and MVP feature architecture." |

## 14. PRD Section
**Product overview:** A solution derived from the user's idea, specifically centered on: **${businessIdea}**.

## 15. AI Stack Recommendations
- Research, writing, design, coding, marketing, sales, analytics, automation

## 16. Assumptions, Risks, and Open Questions
- This draft assumes the business is early-stage.
- The biggest unknowns are urgency, pricing, and channel fit.

## 17. Source and Model Usage Note
- Mode used: demo mode
- Providers used: ${packetNames}
- Live web research mode: ${useResearch ? "requested but not available in demo output" : "not used"}
- Verified facts vs estimates: this output is mostly strategic inference, not verified research
`.trim();
}

function chooseSynthesisProvider(selected) {
  const nonDemo = selected.filter((provider) => provider !== "demo");
  return nonDemo[0] || "demo";
}

function isQuotaError(message) {
  const lowered = (message || "").toLowerCase();
  return lowered.includes("insufficient_quota") || lowered.includes("current quota") || lowered.includes("resource has been exhausted");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiPost(url, headers, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(data)}`);
  }
  return data;
}

function extractOpenAIText(payload) {
  const chunks = [];
  for (const item of payload.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "output_text") chunks.push(content.text || "");
    }
  }
  return chunks.join("\n").trim();
}

function extractOpenAISources(payload) {
  const sources = [];
  const seen = new Set();
  for (const item of payload.output || []) {
    if (item.type === "web_search_call") {
      for (const source of item.action?.sources || []) {
        if (source.url && !seen.has(source.url)) {
          seen.add(source.url);
          sources.push({ title: source.title || source.url, url: source.url });
        }
      }
    }
  }
  return sources;
}

async function callOpenAI(env, model, system, prompt, { useResearch = false, maxOutputTokens = 5000 } = {}) {
  const payload = {
    model,
    instructions: system,
    input: prompt,
    max_output_tokens: maxOutputTokens,
  };
  if (useResearch) {
    payload.tools = [{ type: "web_search", search_context_size: "medium", user_location: { country: "IN" } }];
    payload.tool_choice = "auto";
    payload.include = ["web_search_call.action.sources"];
  }
  const data = await apiPost("https://api.openai.com/v1/responses", {
    Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  }, payload);
  return { text: extractOpenAIText(data), sources: extractOpenAISources(data) };
}

function extractGeminiText(payload) {
  const chunks = [];
  for (const candidate of payload.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function extractGeminiSources(payload) {
  const sources = [];
  const seen = new Set();
  for (const candidate of payload.candidates || []) {
    for (const chunk of candidate.groundingMetadata?.groundingChunks || []) {
      const url = chunk.web?.uri;
      if (url && !seen.has(url)) {
        seen.add(url);
        sources.push({ title: chunk.web?.title || url, url });
      }
    }
  }
  return sources;
}

async function callGemini(env, model, system, prompt, { useResearch = false } = {}) {
  const fallbackModel = env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
  const models = model === fallbackModel ? [model] : [model, fallbackModel];
  const errors = [];
  for (const modelName of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const payload = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: prompt }] }],
      };
      if (useResearch) payload.tools = [{ google_search: {} }];
      try {
        const data = await apiPost(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
          "x-goog-api-key": env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        }, payload);
        return { text: extractGeminiText(data), sources: extractGeminiSources(data), resolvedModel: modelName };
      } catch (error) {
        const message = String(error.message || error);
        errors.push(`${modelName} attempt ${attempt + 1}: ${message}`);
        const retryable = message.includes("503") || message.toLowerCase().includes("unavailable") || message.toLowerCase().includes("high demand");
        if (retryable && attempt < 2) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(`Gemini failed after retries/fallback: ${errors.join(" | ")}`);
}

async function callAnthropic(env, model, system, prompt, { maxTokens = 5000 } = {}) {
  const data = await apiPost("https://api.anthropic.com/v1/messages", {
    "x-api-key": env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  }, {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = (data.content || []).filter((item) => item.type === "text").map((item) => item.text || "").join("\n").trim();
  return { text, sources: [] };
}

async function callCustom(env, model, system, prompt, { maxOutputTokens = 5000 } = {}) {
  const data = await apiPost(`${env.CUSTOM_OPENAI_BASE_URL.replace(/\/$/, "")}/v1/responses`, {
    Authorization: `Bearer ${env.CUSTOM_OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  }, {
    model,
    instructions: system,
    input: prompt,
    max_output_tokens: maxOutputTokens,
  });
  return { text: extractOpenAIText(data), sources: [] };
}

async function runProvider(env, providers, providerId, system, prompt, { useResearch = false, maxOutputTokens = 5000 } = {}) {
  const meta = providers[providerId];
  let result;
  if (providerId === "demo") result = { text: prompt, sources: [] };
  else if (providerId === "openai") result = await callOpenAI(env, meta.model, system, prompt, { useResearch, maxOutputTokens });
  else if (providerId === "gemini") result = await callGemini(env, meta.model, system, prompt, { useResearch });
  else if (providerId === "anthropic") result = await callAnthropic(env, meta.model, system, prompt, { maxTokens: maxOutputTokens });
  else if (providerId === "custom") result = await callCustom(env, meta.model, system, prompt, { maxOutputTokens });
  else throw new Error(`Unsupported provider: ${providerId}`);
  return { provider: providerId, label: meta.label, model: result.resolvedModel || meta.model, text: result.text, sources: result.sources || [] };
}

function mergeSources(...lists) {
  const merged = [];
  const seen = new Set();
  for (const list of lists) {
    for (const source of list || []) {
      if (source.url && !seen.has(source.url)) {
        seen.add(source.url);
        merged.push(source);
      }
    }
  }
  return merged;
}

function demoResult(payload, providers, useResearch, warning = null) {
  const packets = ["Strategy memo", "Competitor packet", "PRD packet"].map((heading) => ({
    provider: "demo",
    label: providers.demo.label,
    model: providers.demo.model,
    text: buildDemoMemo(payload, heading),
    sources: [],
  }));
  return {
    markdown: buildDemoDocument(payload, packets, useResearch),
    providersUsed: packets.map(({ provider, label, model }) => ({ provider, label, model })),
    synthesizer: { provider: "demo", label: providers.demo.label, model: providers.demo.model },
    sources: [],
    researchUsed: false,
    warning,
    fellBackToDemo: true,
  };
}

async function generateDocument(env, payload) {
  const providers = availableProviders(env);
  const selected = (payload.providers || []).filter((provider) => providers[provider]);
  const useResearch = Boolean(payload.useResearch);
  const isFast = (payload.speedMode || "fast") === "fast";
  if (!selected.length) throw new Error("No configured providers are available.");

  const userPrompt = `${buildUserPrompt(payload)}\n\n${buildFocusPrompt(payload)}`;
  const packets = [];

  try {
    for (const providerId of selected) {
      if (providerId === "demo") {
        packets.push({ provider: "demo", label: providers.demo.label, model: providers.demo.model, text: buildDemoMemo(payload, "Strategy memo"), sources: [] });
      } else {
        packets.push(await runProvider(env, providers, providerId, isFast ? FAST_PROMPT : ANALYST_PROMPT, userPrompt, { maxOutputTokens: isFast ? 2200 : 3200 }));
      }
    }
  } catch (error) {
    if (selected.includes("demo") && isQuotaError(String(error.message || error))) {
      return demoResult(payload, providers, useResearch, "Provider quota limit was reached, so the app fell back to Demo Mode.");
    }
    throw error;
  }

  const synthesisProviderId = chooseSynthesisProvider(selected);
  if (synthesisProviderId === "demo") return demoResult(payload, providers, useResearch);

  try {
    if (isFast) {
      const finalDoc = await runProvider(
        env,
        providers,
        synthesisProviderId,
        `${SYSTEM_PROMPT}\n\n${buildFocusPrompt(payload)}\n\n${FAST_PROMPT}`,
        `${userPrompt}\n\nGenerate the final document directly in one pass. Keep it concise but complete.`,
        {
          useResearch: useResearch && providers[synthesisProviderId].supportsResearch,
          maxOutputTokens: 2800,
        },
      );
      return {
        markdown: finalDoc.text,
        providersUsed: packets.map(({ provider, label, model }) => ({ provider, label, model })),
        synthesizer: { provider: finalDoc.provider, label: finalDoc.label, model: finalDoc.model },
        sources: finalDoc.sources,
        researchUsed: Boolean(useResearch && providers[synthesisProviderId].supportsResearch),
        warning: null,
        fellBackToDemo: false,
      };
    }

    let researchPacket = null;
    if (useResearch && providers[synthesisProviderId].supportsResearch) {
      researchPacket = await runProvider(env, providers, synthesisProviderId, RESEARCH_PROMPT, buildResearchPrompt(payload), { useResearch: true, maxOutputTokens: 1800 });
    }
    const competitorInput = researchPacket ? `${userPrompt}\n\nLive research notes:\n${researchPacket.text}` : userPrompt;
    const competitorPacket = await runProvider(env, providers, synthesisProviderId, COMPETITOR_PROMPT, competitorInput, { maxOutputTokens: 2200 });
    const prdPacket = await runProvider(env, providers, synthesisProviderId, PRD_PROMPT, userPrompt, { maxOutputTokens: 2200 });
    const allPackets = [...packets, competitorPacket, prdPacket];
    const packetBlocks = allPackets.map((packet) => `## ${packet.label} (${packet.model})\n${packet.text}`).join("\n\n");
    const researchBlock = researchPacket ? `\n\n## Live Research Packet\n${researchPacket.text}` : "";
    const finalDoc = await runProvider(env, providers, synthesisProviderId, `${SYSTEM_PROMPT}\n\n${SYNTHESIS_PROMPT}`, `${userPrompt}\n\nBelow are internal planning packets from multiple AI stages. Synthesize them into one final document.\n\n${packetBlocks}${researchBlock}`, { maxOutputTokens: 4200 });
    return {
      markdown: finalDoc.text,
      providersUsed: allPackets.map(({ provider, label, model }) => ({ provider, label, model })),
      synthesizer: { provider: finalDoc.provider, label: finalDoc.label, model: finalDoc.model },
      sources: mergeSources(researchPacket?.sources, competitorPacket.sources, finalDoc.sources),
      researchUsed: Boolean(researchPacket),
      warning: null,
      fellBackToDemo: false,
    };
  } catch (error) {
    if (selected.includes("demo") && isQuotaError(String(error.message || error))) {
      return demoResult(payload, providers, useResearch, "Provider quota limit was reached during generation, so the app fell back to Demo Mode.");
    }
    throw error;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/providers") {
      return jsonResponse({ providers: availableProviders(env) });
    }

    if (request.method === "POST" && url.pathname === "/api/generate") {
      try {
        const payload = await request.json();
        const result = await generateDocument(env, payload);
        return jsonResponse(result);
      } catch (error) {
        return jsonResponse({ error: String(error.message || error) }, 400);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
