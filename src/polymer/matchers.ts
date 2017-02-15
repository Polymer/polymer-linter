/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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

const p = dom5.predicates;

export const isDomBindTemplate =
    p.AND(p.hasTagName('template'), p.hasAttrValue('is', 'dom-bind'));
export const isDomModuleTemplate = p.AND(
    p.parentMatches(p.hasTagName('dom-module')), p.hasTagName('template'));
export const isTemplate = p.hasTagName('template');
export const isTemplateDescendant = p.parentMatches(isTemplate);

export interface Template extends parse5.ASTNode { content: parse5.ASTNode; }

export function getNestedDataBindingTemplates(node: parse5.ASTNode) {
  const toplevelTemplates = dom5.queryAll(
      node,
      dom5.predicates.OR(isDomBindTemplate, isDomModuleTemplate)) as Template[];

  const matchInnerTemplate = p.AND(
      isTemplate,
      p.OR(
          p.hasAttrValue('is', 'dom-bind'),
          p.hasAttrValue('is', 'dom-if'),
          p.hasAttrValue('is', 'dom-repeat'),
          p.parentMatches(p.OR(
              p.hasTagName('dom-bind'),
              p.hasTagName('dom-if'),
              p.hasTagName('dom-repeat')))));

  const results = new Set();
  for (const template of toplevelTemplates) {
    results.add(template);

    const innerTemplates = dom5.queryAll(
        template.content,
        matchInnerTemplate,
        [],
        dom5.childNodesIncludeTemplate);
    for (const innerTemplate of innerTemplates) {
      results.add(innerTemplate);
    }
  }

  return results;
}
