/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as dom5 from 'dom5';
import * as parse5 from 'parse5';

const templateExtensionNames =
  ['dom-bind', 'dom-if', 'dom-repeat', 'dom-template'];

export const nodeIsTemplateExtension = (node: parse5.ASTNode) => {
  const isAttrValue = dom5.getAttribute(node, 'is');
  return !!(
    node.tagName === 'template' &&
    isAttrValue && templateExtensionNames.includes(isAttrValue)
  );
};

export const deepQuery = (rootNode: dom5.Node, selector: string): dom5.Node | null => {
  let node = dom5.query(rootNode, dom5.predicates.hasTagName(selector));
  if (!node) {
    const templates = dom5.queryAll(rootNode, dom5.predicates.hasTagName('template'));
    for (const template of templates) {
      const templateContent = parse5.treeAdapters.default.getTemplateContent(template);
      node = deepQuery(templateContent, selector);
      if (node) break;
    }
  }
  return node;
};