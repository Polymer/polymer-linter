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
    selector: elementSelectorToPredicate(
        '.layout.start, .layout.center, .layout.center-center, .layout.end, ' +
        '.layout.baseline, .layout.start-justified, .layout.center-justified, ' +
        '.layout.center-center, .layout.end-justified, .layout.around-justified, ' +
        '.layout.justified, .self-start, .self-center, .self-end, .self-stretch, ' +
        '.self-baseline, .layout.start-aligned, .layout.end-aligned, ' +
        '.layout.center-aligned, .layout.between-aligned, .layout.around-aligned')
  },
  {
    name: 'iron-flex-factors',
    selector: elementSelectorToPredicate(
        '.flex-1, .flex-2, .flex-3, .flex-4, .flex-5, .flex-6, .flex-7, ' +
        '.flex-8, .flex-9, .flex-10, .flex-11, .flex-12')
  },
  {
    name: 'iron-positioning',
    selector: elementSelectorToPredicate(
        '.block, [hidden], .invisible, .relative, .fit, body.fullbleed, ' +
        '.scroll, .fixed-bottom, .fixed-left, .fixed-top, .fixed-right')
  }
];

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
    for (const element of document.getFeatures({kind: 'polymer-element'})) {
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
      const templateContent = treeAdapters.default.getTemplateContent(template);
      const usedModules =
          styleModules.filter((m) => !!dom5.query(templateContent, m.selector));
      if (!usedModules.length) {
        continue;
      }
      // Does it already have all the required style modules?
      const styleNode = dom5.query(templateContent, p.hasTagName('style'));
      let currentModules: string[] = [];
      if (styleNode && dom5.hasAttribute(styleNode, 'include')) {
        currentModules = dom5.getAttribute(styleNode, 'include')!.split(' ');
      }
      const missingModules =
          usedModules.filter((m) => currentModules.indexOf(m.name) === -1)
              .map((m) => m.name)
              .join(' ');
      if (!missingModules.length) {
        continue;
      }
      const multi = missingModules.indexOf(' ') > -1;
      const warning = new FixableWarning({
        code: 'iron-flex-layout-classes',
        message: `Style module${multi ? 's are' : ' is'} used but not imported:

  ${missingModules}

Import ${multi ? 'them' : 'it'} in the template style include.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForStartTag(domModule)!
      });
      if (!styleNode) {
        const indent = getIndentationInside(templateContent);
        warning.fix = [{
          replacementText:
              `\n${indent}<style include="${missingModules}"></style>`,
          range: sourceRangeForPrependContent(parsedDocument, template)
        }];
      } else if (currentModules.length) {
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
  }
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