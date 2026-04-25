import { readFile } from "node:fs/promises";

const token = process.env.KANBAN_SYNC_TOKEN || process.env.GITHUB_TOKEN;
const repoOwner = requiredEnv("REPO_OWNER");
const repoName = requiredEnv("REPO_NAME");
const projectOwner = process.env.PROJECT_OWNER || repoOwner;
const projectNumber = Number.parseInt(requiredEnv("PROJECT_NUMBER"), 10);
const csvPath = process.env.CSV_PATH || ".github/workflows/kanban.csv";
const dryRun = String(process.env.DRY_RUN || "false").toLowerCase() === "true";

if (!token) {
  throw new Error(
    "Missing token. Set KANBAN_SYNC_TOKEN for Project sync or fall back to GITHUB_TOKEN if it has the required access.",
  );
}

if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
  throw new Error(`Invalid PROJECT_NUMBER: ${process.env.PROJECT_NUMBER ?? ""}`);
}

const projectFieldNames = [
  "Board Section",
  "Status",
  "Priority",
  "Estimate",
  "Area",
  "Sprint",
];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  console.log(`Reading CSV from ${csvPath}`);
  const csvText = await readFile(csvPath, "utf8");
  const rows = parseCsv(csvText);

  if (!rows.length) {
    console.log("No rows found in CSV. Nothing to sync.");
    return;
  }

  validateRows(rows);
  const currentKeys = new Set(rows.map((row) => normalizeIssueKey(row.Title)));

  const existingIssues = await listRepositoryIssues();
  const issuesByKey = new Map();
  for (const issue of existingIssues) {
    const key = extractIssueKeyFromIssue(issue);
    if (!key) {
      continue;
    }
    if (!issuesByKey.has(key)) {
      issuesByKey.set(key, issue);
    }
  }

  const project = await resolveProject(projectOwner, projectNumber);
  console.log(`Resolved project "${project.title}" (${project.ownerType})`);

  const fieldMap = new Map();
  for (const field of project.fields) {
    fieldMap.set(field.name, field);
  }
  const projectItems = await listProjectItems(project.id);
  const projectItemIdsByContentId = new Map();
  const projectItemIdsByKey = new Map();
  for (const item of projectItems) {
    const content = item.content;
    if (content?.__typename !== "Issue") {
      continue;
    }
    projectItemIdsByContentId.set(content.id, item.id);
    const key = extractIssueKeyFromIssue(content);
    if (key && !projectItemIdsByKey.has(key)) {
      projectItemIdsByKey.set(key, item.id);
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let orphanedCount = 0;
  let removedCount = 0;

  for (const row of rows) {
    const key = normalizeIssueKey(row.Title);
    const issueTitle = row.Title.trim();
    const issueBody = buildIssueBody(row, key, csvPath);
    const issueState = row.Status === "Done" ? "closed" : "open";

    let issue = issuesByKey.get(key);
    if (issue) {
      console.log(`Updating issue ${issue.number}: ${issueTitle}`);
      if (!dryRun) {
        issue = await updateIssue(issue.number, {
          title: issueTitle,
          body: issueBody,
          state: issueState,
        });
      }
      updatedCount += 1;
    } else {
      console.log(`Creating issue: ${issueTitle}`);
      if (!dryRun) {
        issue = await createIssue({
          title: issueTitle,
          body: issueBody,
        });
        if (issueState === "closed") {
          issue = await updateIssue(issue.number, { state: issueState });
        }
      } else {
        issue = {
          number: -1,
          node_id: "DRY_RUN_ISSUE_NODE",
          body: issueBody,
          title: issueTitle,
        };
      }
      createdCount += 1;
    }

    if (dryRun) {
      console.log(`[dry-run] Would add "${issueTitle}" to project and sync fields.`);
      continue;
    }

    const itemId = await ensureProjectItem(project.id, issue.node_id, projectItemIdsByContentId);
    projectItemIdsByKey.set(key, itemId);
    for (const fieldName of projectFieldNames) {
      const field = fieldMap.get(fieldName);
      const rawValue = row[fieldName];
      if (!field || !rawValue) {
        if (!field && rawValue) {
          console.warn(`Project field "${fieldName}" not found. Skipping value "${rawValue}".`);
        }
        continue;
      }
      await syncProjectFieldValue({
        projectId: project.id,
        itemId,
        field,
        rawValue,
      });
    }
  }

  for (const issue of existingIssues) {
    const key = extractIssueKeyFromIssue(issue);
    if (!key || currentKeys.has(key)) {
      continue;
    }

    console.log(`Cleaning orphaned issue ${issue.number}: ${issue.title}`);
    const cleanedBody = buildOrphanIssueBody(issue, key, csvPath);

    if (dryRun) {
      console.log(`[dry-run] Would close issue ${issue.number} and remove it from the project if present.`);
    } else {
      await updateIssue(issue.number, {
        body: cleanedBody,
        state: "closed",
      });
    }

    orphanedCount += 1;

    const itemId = projectItemIdsByContentId.get(issue.node_id) ?? projectItemIdsByKey.get(key);
    if (!itemId) {
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] Would remove project item ${itemId} for issue ${issue.number}.`);
    } else {
      await removeProjectItem(project.id, itemId);
    }
    projectItemIdsByContentId.delete(issue.node_id);
    projectItemIdsByKey.delete(key);
    removedCount += 1;
  }

  console.log(
    `Sync complete. Created ${createdCount} issue(s), updated ${updatedCount} issue(s), cleaned ${orphanedCount} orphaned issue(s), removed ${removedCount} project item(s).`,
  );
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentField += char;
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (!rows.length) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows
    .filter((row) => row.some((value) => value.trim() !== ""))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? "").trim()])),
    );
}

function validateRows(rows) {
  const seenKeys = new Set();

  for (const [index, row] of rows.entries()) {
    if (!row.Title) {
      throw new Error(`Row ${index + 2} is missing Title.`);
    }

    const key = normalizeIssueKey(row.Title);
    if (seenKeys.has(key)) {
      throw new Error(`Duplicate kanban key detected: ${key}`);
    }
    seenKeys.add(key);
  }
}

function normalizeIssueKey(title) {
  const trimmed = title.trim();
  const prefix = trimmed.match(/^([A-Za-z0-9-]+)/)?.[1];
  return prefix || trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildIssueBody(row, key, sourcePath) {
  const lines = [];

  if (row.Body) {
    lines.push(row.Body.trim(), "");
  }

  // Keep only hidden sync markers in the issue body so the visible text stays
  // exactly as written in the CSV card content.
  lines.push(
    `<!-- kanban-key: ${key} -->`,
    `<!-- kanban-source: ${sourcePath} -->`,
  );

  return lines.join("\n");
}

function buildOrphanIssueBody(issue, key, sourcePath) {
  const lines = [];
  const visibleBody = stripVisibleSyncMetadata(issue.body);

  if (visibleBody) {
    lines.push(visibleBody, "");
  }

  lines.push(
    `<!-- kanban-key: ${key} -->`,
    `<!-- kanban-source: ${sourcePath} -->`,
  );

  return lines.join("\n");
}

function extractIssueKey(body) {
  const match = body?.match(/<!--\s*kanban-key:\s*([A-Za-z0-9-]+)\s*-->/i);
  return match?.[1] ?? null;
}

function extractIssueKeyFromIssue(issue) {
  const bodyKey = extractIssueKey(issue?.body);
  if (bodyKey) {
    return bodyKey;
  }

  if (looksLikeLegacySyncedBody(issue?.body)) {
    return normalizeIssueKey(issue?.title ?? "");
  }

  return null;
}

function looksLikeLegacySyncedBody(body) {
  const text = String(body ?? "");
  return (
    text.includes("Synced from kanban.csv") ||
    /(^|\n)\s*-\s*(Board Section|Status|Priority|Estimate|Area|Sprint|Target Date):/i.test(text)
  );
}

function stripVisibleSyncMetadata(body) {
  const lines = String(body ?? "").replace(/\r/g, "").split("\n");
  const visibleLines = [];

  for (const line of lines) {
    if (/^\s*<!--\s*kanban-(key|source):/i.test(line)) {
      continue;
    }
    if (/^\s*Synced from kanban\.csv\s*$/i.test(line)) {
      continue;
    }
    if (/^\s*-\s*(Board Section|Status|Priority|Estimate|Area|Sprint|Target Date):/i.test(line)) {
      continue;
    }
    if (/^\s*---\s*$/.test(line)) {
      break;
    }
    visibleLines.push(line);
  }

  const cleanedLines = [];
  let previousBlank = true;
  for (const line of visibleLines) {
    const isBlank = line.trim() === "";
    if (isBlank && previousBlank) {
      continue;
    }
    cleanedLines.push(line);
    previousBlank = isBlank;
  }

  while (cleanedLines.length && cleanedLines[cleanedLines.length - 1].trim() === "") {
    cleanedLines.pop();
  }

  return cleanedLines.join("\n").trim();
}

async function listRepositoryIssues() {
  const issues = [];
  let page = 1;

  while (true) {
    const batch = await restJson(
      "GET",
      `/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues?state=all&per_page=100&page=${page}`,
    );

    const issueBatch = batch.filter((item) => !item.pull_request);
    issues.push(...issueBatch);

    if (batch.length < 100) {
      break;
    }
    page += 1;
  }

  return issues;
}

async function createIssue(payload) {
  return restJson(
    "POST",
    `/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues`,
    payload,
  );
}

async function updateIssue(issueNumber, payload) {
  return restJson(
    "PATCH",
    `/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/issues/${issueNumber}`,
    payload,
  );
}

async function resolveProject(owner, number) {
  const ownerType = await resolveOwnerType(owner);
  const rootField = ownerType === "organization" ? "organization" : "user";
  const query = `
    query($login: String!, $number: Int!) {
      ${rootField}(login: $login) {
        projectV2(number: $number) {
          id
          title
          fields(first: 100) {
            nodes {
              __typename
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
              ... on ProjectV2IterationField {
                id
                name
                dataType
                configuration {
                  iterations {
                    id
                    title
                    startDate
                    duration
                  }
                  completedIterations {
                    id
                    title
                    startDate
                    duration
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await graphQl(query, { login: owner, number });
  const project = data[rootField]?.projectV2;

  if (!project) {
    throw new Error(
      `Project #${number} was not found under "${owner}". Check KANBAN_PROJECT_OWNER, KANBAN_PROJECT_NUMBER and token permissions.`,
    );
  }

  return {
    ownerType,
    id: project.id,
    title: project.title,
    fields: project.fields.nodes.filter(Boolean),
  };
}

async function resolveOwnerType(owner) {
  const result = await restJson("GET", `/users/${encodeURIComponent(owner)}`);
  const rawType = String(result?.type || "").toLowerCase();

  if (rawType === "organization") {
    return "organization";
  }

  return "user";
}

async function listProjectItems(projectId) {
  const items = [];
  let after = null;

  while (true) {
    const query = `
      query($projectId: ID!, $after: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $after) {
              nodes {
                id
                content {
                  __typename
                  ... on Issue {
                    id
                    number
                    title
                    body
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      }
    `;

    const data = await graphQl(query, { projectId, after });
    const connection = data.node?.items;
    if (!connection) {
      throw new Error(`Unable to load items for project ${projectId}.`);
    }

    items.push(...connection.nodes.filter(Boolean));

    if (!connection.pageInfo.hasNextPage) {
      break;
    }
    after = connection.pageInfo.endCursor;
  }

  return items;
}

async function ensureProjectItem(projectId, contentId, existingItemsByContentId) {
  const existingItemId = existingItemsByContentId.get(contentId);
  if (existingItemId) {
    return existingItemId;
  }

  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }
  `;

  const data = await graphQl(mutation, { projectId, contentId });
  const itemId = data.addProjectV2ItemById.item.id;
  existingItemsByContentId.set(contentId, itemId);
  return itemId;
}

async function removeProjectItem(projectId, itemId) {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!) {
      deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) {
        deletedItemId
      }
    }
  `;

  await graphQl(mutation, { projectId, itemId });
}

async function syncProjectFieldValue({ projectId, itemId, field, rawValue }) {
  switch (field.__typename) {
    case "ProjectV2SingleSelectField":
      await setSingleSelectField(projectId, itemId, field, rawValue);
      return;
    case "ProjectV2IterationField":
      await setIterationField(projectId, itemId, field, rawValue);
      return;
    case "ProjectV2Field":
      await setPrimitiveField(projectId, itemId, field, rawValue);
      return;
    default:
      console.warn(`Unsupported project field type ${field.__typename} for field "${field.name}".`);
  }
}

async function setSingleSelectField(projectId, itemId, field, rawValue) {
  const option = field.options.find((candidate) => candidate.name === rawValue);
  if (!option) {
    console.warn(`Option "${rawValue}" not found in project field "${field.name}".`);
    return;
  }

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `;

  await graphQl(mutation, {
    projectId,
    itemId,
    fieldId: field.id,
    optionId: option.id,
  });
}

async function setIterationField(projectId, itemId, field, rawValue) {
  const iterations = [
    ...(field.configuration?.iterations ?? []),
    ...(field.configuration?.completedIterations ?? []),
  ];
  const match = iterations.find((iteration) => iteration.title === rawValue);

  if (!match) {
    console.warn(`Iteration "${rawValue}" not found in project field "${field.name}".`);
    return;
  }

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: String!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { iterationId: $iterationId }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
  `;

  await graphQl(mutation, {
    projectId,
    itemId,
    fieldId: field.id,
    iterationId: match.id,
  });
}

async function setPrimitiveField(projectId, itemId, field, rawValue) {
  if (field.dataType === "NUMBER") {
    const numberValue = Number(rawValue);
    if (!Number.isFinite(numberValue)) {
      console.warn(`Value "${rawValue}" is not a valid number for field "${field.name}".`);
      return;
    }

    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $number: Float!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { number: $number }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphQl(mutation, {
      projectId,
      itemId,
      fieldId: field.id,
      number: numberValue,
    });
    return;
  }

  if (field.dataType === "DATE") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
      console.warn(`Value "${rawValue}" is not a valid YYYY-MM-DD date for field "${field.name}".`);
      return;
    }

    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { date: $date }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphQl(mutation, {
      projectId,
      itemId,
      fieldId: field.id,
      date: rawValue,
    });
    return;
  }

  if (field.dataType === "TEXT") {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId
            itemId: $itemId
            fieldId: $fieldId
            value: { text: $text }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await graphQl(mutation, {
      projectId,
      itemId,
      fieldId: field.id,
      text: rawValue,
    });
    return;
  }

  console.warn(`Unsupported primitive field data type ${field.dataType} for field "${field.name}".`);
}

async function restJson(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "foodbank-kanban-sync",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub REST API failed (${response.status}) ${method} ${path}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

async function graphQl(query, variables) {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "foodbank-kanban-sync",
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(
      `GitHub GraphQL API failed: ${JSON.stringify(payload.errors ?? payload, null, 2)}`,
    );
  }

  return payload.data;
}
