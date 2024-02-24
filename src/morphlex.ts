type IdSet = Set<string>;
type IdMap = Map<Node, IdSet>;

export function morph(node: ChildNode, guide: ChildNode): void {
	const idMap: IdMap = new Map();

	if (isElement(node) && isElement(guide)) {
		populateIdMapForNode(node, idMap);
		populateIdMapForNode(guide, idMap);
	}

	morphNodes(node, guide, idMap);
}

function morphNodes(node: ChildNode, guide: ChildNode, idMap: IdMap, insertBefore?: Node, parent?: Node): void {
	if (parent && insertBefore && insertBefore !== node) parent.insertBefore(guide, insertBefore);

	if (isText(node) && isText(guide)) {
		if (node.textContent !== guide.textContent) node.textContent = guide.textContent;
	} else if (isElement(node) && isElement(guide) && node.tagName === guide.tagName) {
		if (node.hasAttributes() || guide.hasAttributes()) morphAttributes(node, guide);
		if (node.hasChildNodes() || guide.hasChildNodes()) morphChildNodes(node, guide, idMap);
	} else node.replaceWith(guide.cloneNode(true));
}

function morphAttributes(elem: Element, guide: Element): void {
	for (const { name } of elem.attributes) guide.hasAttribute(name) || elem.removeAttribute(name);
	for (const { name, value } of guide.attributes) elem.getAttribute(name) !== value && elem.setAttribute(name, value);

	if (isInput(elem) && isInput(guide) && elem.value !== guide.value) elem.value = guide.value;
	else if (isOption(elem) && isOption(guide) && elem.selected !== guide.selected) elem.selected = guide.selected;
	else if (isTextArea(elem) && isTextArea(guide) && elem.value !== guide.value) elem.value = guide.value;
}

function morphChildNodes(elem: Element, guide: Element, idMap: IdMap): void {
	for (let i = 0; i < guide.childNodes.length; i++) {
		const childA = [...elem.childNodes].at(i);
		const childB = [...guide.childNodes].at(i);

		if (childA && childB) morphChildNode(childA, childB, idMap, elem);
		else if (childB) elem.appendChild(childB.cloneNode(true));
	}

	// This is separate because the loop above might modify the length of the element's child nodes.
	while (elem.childNodes.length > guide.childNodes.length) elem.lastChild?.remove();
}

function morphChildNode(child: ChildNode, guide: ChildNode, idMap: IdMap, parent: Element): void {
	if (isElement(child) && isElement(guide)) morphChildElement(child, guide, idMap, parent);
	else morphNodes(child, guide, idMap);
}

function morphChildElement(child: Element, guide: Element, idMap: IdMap, parent: Element): void {
	const guideIdSet = idMap.get(guide);

	let current: ChildNode | null = child;
	let nextMatchByTagName: ChildNode | null = null;

	// Try find a match by idSet, while also looking out for the next best match by tagName.
	while (current) {
		if (isElement(current)) {
			if (current.id !== "" && current.id === guide.id) {
				// Exact match by id.
				return morphNodes(current, guide, idMap, child, parent);
			} else {
				const currentIdSet = idMap.get(current);

				if (currentIdSet && guideIdSet && [...currentIdSet].some((it) => guideIdSet.has(it))) {
					// Match by idSet.
					return morphNodes(current, guide, idMap, child, parent);
				} else if (!nextMatchByTagName && current.tagName === guide.tagName) {
					nextMatchByTagName = current;
				}
			}
		}

		current = current.nextSibling;
	}

	if (nextMatchByTagName) morphNodes(nextMatchByTagName, guide, idMap, child, parent);
	else child.replaceWith(guide.cloneNode(true));
}

function populateIdMapForNode(node: ParentNode, idMap: IdMap): void {
	const elementsWithIds: NodeListOf<Element> = node.querySelectorAll("[id]");

	for (const elementWithId of elementsWithIds) {
		const id = elementWithId.id;
		if (id === "") continue;
		let current: Element | null = elementWithId;

		while (current) {
			const idSet: IdSet | undefined = idMap.get(current);
			idSet ? idSet.add(id) : idMap.set(current, new Set([id]));
			if (current === elementWithId) break;
			current = current.parentElement;
		}
	}
}

// We cannot use `instanceof` when nodes might be from different documents,
// so we use type guards instead. This keeps TypeScript happy, while doing
// the necessary checks at runtime.

function isText(node: Node): node is Text {
	return node.nodeType === 3;
}

function isElement(node: Node): node is Element {
	return node.nodeType === 1;
}

function isInput(element: Element): element is HTMLInputElement {
	return element.localName === "input";
}

function isOption(element: Element): element is HTMLOptionElement {
	return element.localName === "option";
}

function isTextArea(element: Element): element is HTMLTextAreaElement {
	return element.localName === "textarea";
}