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

import {elementSelectorToPredicate} from '../html/util';

const p = dom5.predicates;

const styleModules = [
  {
    name: 'iron-flex',
    selector: elementSelectorToPredicate(
        '.layout.horizontal, .layout.vertical, .layout.inline, .layout.wrap,' +
        '.layout.no-wrap, .layout.center, .layout.center-center, ' +
        '.layout.center-justified, .flex, .flex-auto, .flex-none')
  },
  {
    name: 'iron-flex-reverse',
    selector: elementSelectorToPredicate(
        '.layout.horizontal-reverse, .layout.vertical-reverse, ' +
        '.layout.wrap-reverse')
  },
  {
    name: 'iron-flex-alignment',
    // Skip `.layout.center, .layout.center-center, .layout.center-justified`
    // as they're already defined in the `iron-flex` module.
    selector: elementSelectorToPredicate(
        '.layout.start, .layout.end, .layout.baseline, .layout.start-justified, ' +
        '.layout.end-justified, .layout.around-justified, .layout.justified, ' +
        '.self-start, .self-center, .self-end, .self-stretch, .self-baseline, ' +
        '.layout.start-aligned, .layout.end-aligned, .layout.center-aligned, ' +
        '.layout.between-aligned, .layout.around-aligned')
  },
  {
    name: 'iron-flex-factors',
    // Skip `.flex` as it's already defined in the `iron-flex` module.
    selector: elementSelectorToPredicate(
        '.flex-1, .flex-2, .flex-3, .flex-4, .flex-5, .flex-6, .flex-7, ' +
        '.flex-8, .flex-9, .flex-10, .flex-11, .flex-12')
  },
  {
    name: 'iron-positioning',
    // Skip `[hidden]` as it's a too generic selector.
    selector: elementSelectorToPredicate(
        '.block, .invisible, .relative, .fit, body.fullbleed, ' +
        '.scroll, .fixed-bottom, .fixed-left, .fixed-top, .fixed-right')
  }
];

const styleModulesRegex = /iron-(flex|positioning)/;

const isStyleInclude = p.AND(p.hasTagName('style'), p.hasAttr('include'));

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
    // Search in the dom-modules.
    for (const domModule of document.getFeatures({kind: 'dom-module'})) {
      const template = dom5.query(domModule.astNode, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const templateContent = treeAdapters.default.getTemplateContent(template);
      const missingModules = getMissingStyleModules(templateContent);
      if (!missingModules) {
        continue;
      }
      // TODO(valdrin): update the warning location to be at the spot where
      // the class is used.
      const warning =
          createWarning(parsedDocument, domModule.astNode, missingModules);
      const styleNode = getStyleNodeToEdit(templateContent);
      if (!styleNode) {
        const indent = getIndentationInside(templateContent);
        warning.fix = [{
          replacementText: `
${indent}<style include="${missingModules}"></style>`,
          range: sourceRangeForPrependContent(parsedDocument, template)
        }];
      } else if (dom5.hasAttribute(styleNode, 'include')) {
        warning.fix = [{
          replacementText: ` ${missingModules}`,
          range: sourceRangeForAppendAttributeValue(
              parsedDocument, styleNode, 'include')!
        }];
      } else {
        warning.fix = [{
          replacementText: ` include="${missingModules}"`,
          range: sourceRangeForAddAttribute(parsedDocument, styleNode)
        }];
      }
      warnings.push(warning);
    }
    const body = dom5.query(parsedDocument.ast, p.hasTagName('body'));
    // Handle files like `<dom-module></dom-module> <body><p>hello</p></body>`
    // where a "fake" body node would be created by dom-module. Skip these
    // cases, dear user please write proper HTML ¯\_(ツ)_/¯
    if (!body || !body.__location) {
      return;
    }
    const missingModules = getMissingStyleModules(body);
    if (!missingModules) {
      return;
    }
    // TODO(valdrin): update the warning location to be at the spot where
    // the class is used.
    const warning = createWarning(parsedDocument, body, missingModules);
    const indent = getIndentationInside(body);
    warning.fix = [{
      replacementText: `
${indent}<custom-style>
${indent}  <style is="custom-style" include="${missingModules}"></style>
${indent}</custom-style>`,
      range: sourceRangeForPrependContent(parsedDocument, body)
    }];
    warnings.push(warning);
  }
}

function getMissingStyleModules(node: dom5.Node) {
  const usedModules = styleModules.filter((m) => !!dom5.query(node, m.selector))
                          .map((m) => m.name);
  if (!usedModules.length) {
    return;
  }
  const styleNodes = dom5.queryAll(node, isStyleInclude);
  let currentModules: string[] = [];
  for (const style of styleNodes) {
    currentModules =
        [...currentModules, ...dom5.getAttribute(style, 'include')!.split(' ')];
  }
  const missingModules =
      usedModules.filter((m) => currentModules.indexOf(m) === -1);
  if (missingModules.length) {
    return missingModules.join(' ');
  }
}

function createWarning(
    parsedDocument: ParsedHtmlDocument,
    node: dom5.Node,
    missingModules: string) {
  const multi = missingModules.indexOf(' ') > -1;
  return new FixableWarning({
    code: 'iron-flex-layout-classes',
    message: `Style module${multi ? 's are' : ' is'} used but not imported:

  ${missingModules}

Import ${multi ? 'them' : 'it'} in the template style include.`,
    parsedDocument,
    severity: Severity.WARNING,
    sourceRange: parsedDocument.sourceRangeForStartTag(node)!
  });
}

function getStyleNodeToEdit(node: dom5.Node) {
  let styleToEdit = null;
  for (const style of dom5.queryAll(node, isStyleInclude)) {
    // Get the first one of the styles with include attribute, otherwise
    // prefer styles that already include iron-flex-layout modules.
    if (!styleToEdit ||
        styleModulesRegex.test(dom5.getAttribute(style, 'include')!)) {
      styleToEdit = style;
    }
  }
  // Fallback to style without include attribute.
  return styleToEdit || dom5.query(node, p.hasTagName('style'));
}

function sourceRangeForAppendAttributeValue(
    parsedDocument: ParsedHtmlDocument, node: dom5.Node, attr: string) {
  const tagRange = parsedDocument.sourceRangeForAttributeValue(node, attr)!;
  return {
    file: tagRange.file,
    start: {line: tagRange.end.line, column: tagRange.end.column - 1},
    end: {line: tagRange.end.line, column: tagRange.end.column - 1}
  };
}

function sourceRangeForAddAttribute(
    parsedDocument: ParsedHtmlDocument, node: dom5.Node) {
  const tagRange = parsedDocument.sourceRangeForStartTag(node)!;
  return {
    file: tagRange.file,
    start: {line: tagRange.end.line, column: tagRange.end.column - 1},
    end: {line: tagRange.end.line, column: tagRange.end.column - 1}
  };
}

function sourceRangeForPrependContent(
    parsedDocument: ParsedHtmlDocument, node: dom5.Node) {
  const tagRange = parsedDocument.sourceRangeForStartTag(node)!;
  return {
    file: tagRange.file,
    start: {line: tagRange.end.line, column: tagRange.end.column},
    end: {line: tagRange.end.line, column: tagRange.end.column}
  };
}

registry.register(new IronFlexLayoutClasses());

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
