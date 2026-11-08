export interface XmlNode {
  name: string;
  text: string;
  children: XmlNode[];
}

/** Maximum element nesting depth accepted from upstream XML. */
export const MAX_XML_DEPTH = 256;

/**
 * Maximum number of nodes one traversal may visit. This bounds CPU and memory
 * for trees built outside `parseXml` as well as hostile upstream documents.
 */
const MAX_XML_TRAVERSAL_NODES = 1_000_000;

/**
 * Controlled failure for XML that exceeds the parser or traversal bounds.
 * Source adapters already downgrade a parse failure to a failed source result,
 * so a hostile feed cannot abort the whole preflight.
 */
export class XmlResourceLimitError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "XmlResourceLimitError";
  }
}

/**
 * Returns the character for a valid XML numeric character reference, or null
 * for values outside the Unicode scalar range (negative, surrogates, or above
 * U+10FFFF). Malformed upstream feeds must degrade to literal text instead of
 * throwing a RangeError mid-parse.
 */
const decodeNumericEntity = (code: number): string | null =>
  Number.isSafeInteger(code)
  && code >= 0
  && code <= 0x10ffff
  && !(code >= 0xd800 && code <= 0xdfff)
    ? String.fromCodePoint(code)
    : null;

const decodeEntities = (value: string): string => value
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, code: string) => decodeNumericEntity(Number(code)) ?? `&#${code};`)
  .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => decodeNumericEntity(Number.parseInt(code, 16)) ?? `&#x${code};`);

const normalizeName = (name: string): string => name.split(":").at(-1)!.trim().toUpperCase();

export const normalizeXmlName = normalizeName;

export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#DOCUMENT", text: "", children: [] };
  const stack: XmlNode[] = [root];
  const tokenPattern = /<!--[^]*?-->|<!\[CDATA\[[^]*?\]\]>|<\?[^]*?\?>|<!DOCTYPE[^>]*>|<[^>]+>|[^<]+/g;
  for (const token of xml.match(tokenPattern) ?? []) {
    if (token.startsWith("<!--") || token.startsWith("<?") || /^<!DOCTYPE/i.test(token)) continue;
    if (token.startsWith("<![CDATA[")) {
      stack.at(-1)!.text += token.slice(9, -3);
      continue;
    }
    if (token.startsWith("</")) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      if (/^<!/.test(token)) continue;
      const match = token.match(/^<\s*([^\s/>]+)/);
      if (!match) continue;
      const node: XmlNode = { name: normalizeName(match[1]), text: "", children: [] };
      stack.at(-1)!.children.push(node);
      if (!/\/\s*>$/.test(token)) {
        if (stack.length > MAX_XML_DEPTH) {
          throw new XmlResourceLimitError(
            `XML nesting limit exceeded (maximum ${MAX_XML_DEPTH} levels).`,
          );
        }
        stack.push(node);
      }
      continue;
    }
    const value = decodeEntities(token).replace(/\s+/g, " ").trim();
    if (value) stack.at(-1)!.text += `${stack.at(-1)!.text ? " " : ""}${value}`;
  }
  return root;
}

export function nodeText(node: XmlNode): string {
  const text: string[] = [];
  walkXml(node, (current) => {
    if (current.text) text.push(current.text);
  });
  return text.join(" ").replace(/\s+/g, " ").trim();
}

export function walkXml(node: XmlNode, visitor: (node: XmlNode) => void): void {
  const pending: Array<{ node: XmlNode; depth: number }> = [{ node, depth: 0 }];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    visited += 1;
    if (current.depth > MAX_XML_DEPTH) {
      throw new XmlResourceLimitError(
        `XML traversal limit exceeded (maximum depth ${MAX_XML_DEPTH}).`,
      );
    }
    if (
      visited > MAX_XML_TRAVERSAL_NODES
      || pending.length + current.node.children.length > MAX_XML_TRAVERSAL_NODES
    ) {
      throw new XmlResourceLimitError(
        `XML traversal limit exceeded (maximum ${MAX_XML_TRAVERSAL_NODES} nodes).`,
      );
    }
    visitor(current.node);
    for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
      pending.push({ node: current.node.children[index], depth: current.depth + 1 });
    }
  }
}

export function findDescendants(node: XmlNode, names: readonly string[]): XmlNode[] {
  const wanted = new Set(names.map(normalizeName));
  const result: XmlNode[] = [];
  walkXml(node, (candidate) => {
    if (candidate !== node && wanted.has(candidate.name)) result.push(candidate);
  });
  return result;
}

export function firstDescendantText(node: XmlNode, names: readonly string[]): string | undefined {
  const match = findDescendants(node, names)[0];
  const value = match ? nodeText(match) : "";
  return value || undefined;
}

export function allDescendantTexts(node: XmlNode, names: readonly string[]): string[] {
  return findDescendants(node, names).map(nodeText).filter(Boolean);
}

export function findLikelyRecordNodes(
  root: XmlNode,
  options: { rinNames?: string[]; semanticNames: string[]; minimumSemanticFields?: number },
): XmlNode[] {
  const rinNames = options.rinNames ?? ["RIN", "REGULATION_ID_NUMBER"];
  const semanticNames = options.semanticNames;
  const minimum = options.minimumSemanticFields ?? 2;
  const score = (node: XmlNode): number => semanticNames.reduce(
    (total, name) => total + (firstDescendantText(node, [name]) ? 1 : 0),
    0,
  );
  const hasRin = (node: XmlNode): boolean => Boolean(firstDescendantText(node, rinNames));
  const candidates: XmlNode[] = [];
  walkXml(root, (node) => {
    if (node === root || !hasRin(node) || score(node) < minimum) return;
    const nestedCandidate = node.children.some((child) => hasRin(child) && score(child) >= minimum);
    if (!nestedCandidate) candidates.push(node);
  });
  return candidates;
}

export function htmlText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
