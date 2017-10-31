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
import {treeAdapters} from 'parse5';
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {FixableWarning} from '../warning';

import stripIndent = require('strip-indent');

import cssWhat = require('css-what');

const p = dom5.predicates;

const styleIncludeModules = ['iron-flex', 'iron-flex-reverse', 'iron-flex-alignment', 'iron-flex-factors', 'iron-positioning'];
const styleIncludeValue = styleIncludeModules.join(' ');
const ironFlexLayoutClasses = p.OR(
  // iron-flex
  elementSelectorToPredicate('.layout.horizontal, .layout.vertical, .layout.inline, .layout.wrap, .layout.no-wrap, .layout.center, .layout.center-center, .layout.center-justified, .flex, .flex-auto, .flex-none'),
  // iron-flex-reverse
  elementSelectorToPredicate('.layout.horizontal-reverse, .layout.vertical-reverse, .layout.wrap-reverse'),
  // iron-flex-alignment
  elementSelectorToPredicate('.layout.start, .layout.center, .layout.center-center, .layout.end, .layout.baseline, .layout.start-justified, .layout.center-justified, .layout.center-center, .layout.end-justified, .layout.around-justified, .layout.justified, .self-start, .self-center, .self-end, .self-stretch, .self-baseline, .layout.start-aligned, .layout.end-aligned, .layout.center-aligned, .layout.between-aligned, .layout.around-aligned'),
  // iron-flex-factors
  elementSelectorToPredicate('.flex-1, .flex-2, .flex-3, .flex-4, .flex-5, .flex-6, .flex-7, .flex-8, .flex-9, .flex-10, .flex-11, .flex-12'),
  // iron-positioning
  elementSelectorToPredicate('.block, [hidden], .invisible, .relative, .fit, body.fullbleed, .scroll, .fixed-bottom, .fixed-left, .fixed-top, .fixed-right'),
);

class IronFlexLayoutClasses extends HtmlRule {
  code = 'iron-flex-layout-classes';
  description = stripIndent(`
      Warns when iron-flex-layout classes are used without including the style modules.
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, document: Document,
      warnings: FixableWarning[]) {
    for (const element of document.getFeatures({ kind: 'polymer-element' })) {
      const domModule = element.domModule;
      if (!domModule) {
        continue;
      }
      // Does it have a template?
      const template = dom5.query(domModule, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      // Does it use any of the iron-flex-layout classes?
      // TODO(valdrin) group by style modules used instead of adding them all.
      const templateContent = treeAdapters.default.getTemplateContent(template);
      if (!dom5.query(templateContent, ironFlexLayoutClasses)) {
        continue;
      }
      // Does it already have all the required style includes?
      const styleNode = dom5.query(templateContent, p.hasTagName('style'));
      let includes: string[] = [];
      if (styleNode && dom5.hasAttribute(styleNode, 'include')) {
        includes = dom5.getAttribute(styleNode, 'include')!.split(' ');
        let hasRequiredIncludes = true;
        styleIncludeModules.forEach((module) => {
          if (includes.indexOf(module) === -1) {
            includes.push(module);
            hasRequiredIncludes = false;
          }
        });
        if (hasRequiredIncludes) {
          continue;
        }
      }

      const warning = new FixableWarning({
        code: 'iron-flex-layout-classes',
        message:
            `Missing style includes for iron-flex-layout classes. ` +
            `Include these style modules:

            <dom-module id="my-element">
              <template>
                <style include="${styleIncludeValue}">
                  ...
                </style>
                ...
              </template>`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForStartTag(domModule)!
      });
      if (!styleNode) {
        const indent = getIndentationInside(templateContent);
        warning.fix = [{
          replacementText: `\n${indent}<style include="${styleIncludeValue}"></style>`,
          range: sourceRangeForPrependContent(parsedDocument, template)
        }];
      } else if (includes.length) {
        warning.fix = [{
          replacementText: `"${includes.join(' ')}"`,
          range: parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
        }];
      } else {
        warning.fix = [{
          replacementText: ` include="${styleIncludeValue}"`,
          range: sourceRangeForAddAttribute(parsedDocument, styleNode)
        }];
      }
      warnings.push(warning);
    }
  }
}

function sourceRangeForAddAttribute(parsedDocument: ParsedHtmlDocument, node: dom5.Node) {
  const tagRange = parsedDocument.sourceRangeForStartTag(node)!;
  return {
    file: tagRange.file,
    start: { line: tagRange.end.line, column: tagRange.end.column - 1 },
    end: { line: tagRange.end.line, column: tagRange.end.column - 1 }
  };
}

function sourceRangeForPrependContent(parsedDocument: ParsedHtmlDocument, node: dom5.Node) {
  const tagRange = parsedDocument.sourceRangeForStartTag(node)!;
  return {
    file: tagRange.file,
    start: { line: tagRange.end.line, column: tagRange.end.column },
    end: { line: tagRange.end.line, column: tagRange.end.column }
  };
}

registry.register(new IronFlexLayoutClasses());

// TODO(valdrin) move this in commons or something.
/* ---- START copy-pasted from content-to-slot-usages. --- */
function elementSelectorToPredicate(simpleSelector: string): dom5.Predicate {
  const parsed = cssWhat(simpleSelector);
  // The output of cssWhat is two levels of arrays. The outer level are any
  // selectors joined with a comma, so it matches if any of the inner selectors
  // match. The inner array are simple selectors like `.foo` and `#bar` which
  // must all match.
  return dom5.predicates.OR(...parsed.map((simpleSelectors) => {
    return dom5.predicates.AND(
        ...simpleSelectors.map(simpleSelectorToPredicate));
  }));
}

function simpleSelectorToPredicate(selector: cssWhat.Simple) {
  switch (selector.type) {
    case 'adjacent':
    case 'child':
    case 'descendant':
    case 'parent':
    case 'sibling':
    case 'pseudo':
      throw new Error(`Unsupported CSS operator: ${selector.type}`);
    case 'attribute':
      return attributeSelectorToPredicate(selector);
    case 'tag':
      return dom5.predicates.hasTagName(selector.name);
    case 'universal':
      return () => true;
  }
  const never: never = selector;
  throw new Error(`Unexpected node type from css parser: ${never}`);
}

function attributeSelectorToPredicate(selector: cssWhat.Attribute):
    dom5.Predicate {
  switch (selector.action) {
    case 'exists':
      return dom5.predicates.hasAttr(selector.name);
    case 'equals':
      return dom5.predicates.hasAttrValue(selector.name, selector.value);
    case 'start':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.startsWith(selector.value);
      };
    case 'end':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.endsWith(selector.value);
      };
    case 'element':
      return dom5.predicates.hasSpaceSeparatedAttrValue(
          selector.name, selector.value);
    case 'any':
      return (el) => {
        const attrValue = dom5.getAttribute(el, selector.name);
        return attrValue != null && attrValue.includes(selector.value);
      };
  }
  const never: never = selector.action;
  throw new Error(
      `Unexpected type of attribute matcher from CSS parser ${never}`);
}
/* ---- END copy-paste from content-to-slot-usages. --- */

// TODO(valdrin) move this in commons or something.
/* ---- START copy-paste from move-style-into-template. ---- */
function getIndentationInside(parentNode: dom5.Node) {
  if (!parentNode.childNodes || parentNode.childNodes.length === 0) {
    return '';
  }
  const firstChild = parentNode.childNodes[0];
  if (!dom5.isTextNode(firstChild)) {
    return '';
  }
  const text = dom5.getTextContent(firstChild);
  const match = text.match(/(^|\n)([ \t]+)/);
  if (!match) {
    return '';
  }
  // If the it's an empty node with just one line of whitespace, like this:
  //     <div>
  //     </div>
  // Then the indentation of actual content inside is one level deeper than
  // the whitespace on that second line.
  if (parentNode.childNodes.length === 1 && text.match(/^\n[ \t]+$/)) {
    return match[2] + '  ';
  }
  return match[2];
}
/* ---- END copy-paste from move-style-into-template. ---- */