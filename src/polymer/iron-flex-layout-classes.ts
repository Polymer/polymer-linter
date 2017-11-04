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
import {FixableWarning, Replacement} from '../warning';

import stripIndent = require('strip-indent');

import {elementSelectorToPredicate, getIndentationInside} from '../html/util';

const p = dom5.predicates;

const styleModules = [
  {
    module: 'iron-flex',
    selector: elementSelectorToPredicate(
        '.layout.horizontal, .layout.vertical, .layout.inline, .layout.wrap,' +
        '.layout.no-wrap, .layout.center, .layout.center-center, ' +
        '.layout.center-justified, .flex, .flex-auto, .flex-none')
  },
  {
    module: 'iron-flex-reverse',
    selector: elementSelectorToPredicate(
        '.layout.horizontal-reverse, .layout.vertical-reverse, ' +
        '.layout.wrap-reverse')
  },
  {
    module: 'iron-flex-alignment',
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
    module: 'iron-flex-factors',
    // Skip `.flex` as it's already defined in the `iron-flex` module.
    selector: elementSelectorToPredicate(
        '.flex-1, .flex-2, .flex-3, .flex-4, .flex-5, .flex-6, .flex-7, ' +
        '.flex-8, .flex-9, .flex-10, .flex-11, .flex-12')
  },
  {
    module: 'iron-positioning',
    // Skip `[hidden]` as it's a too generic selector.
    selector: elementSelectorToPredicate(
        '.block, .invisible, .relative, .fit, body.fullbleed, ' +
        '.scroll, .fixed-bottom, .fixed-left, .fixed-top, .fixed-right')
  }
];

declare interface StyleModule {
  module: string;
  node: dom5.Node;
}

const styleModulesRegex = /iron-(flex|positioning)/;

const isStyleInclude = p.AND(p.hasTagName('style'), p.hasAttr('include'));

class IronFlexLayoutClasses extends HtmlRule {
  code = 'iron-flex-layout-classes';
  description = stripIndent(`
      Warns when iron-flex-layout classes are used without including the style modules.

      This:

          <link rel="import" href="../iron-flex-layout/iron-flex-layout-classes.html">
          <dom-module>
            <template>
              <style>
                :host { diplay: block; }
              </style>
              <div class="layout vertical">hello</div>
            </template>
          <dom-module>

      Should instead be written as:

          <link rel="import" href="../iron-flex-layout/iron-flex-layout-classes.html">
          <dom-module>
            <template>
              <style include="iron-flex">
                :host { diplay: block; }
              </style>
              <div class="layout vertical">hello</div>
            </template>
          <dom-module>
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    // Search in the dom-modules.
    for (const domModule of document.getFeatures({kind: 'dom-module'})) {
      const misplacedStyle =
          dom5.query(domModule.astNode, p.hasTagName('style'));
      if (misplacedStyle) {
        warnings.push(new FixableWarning({
          code: 'iron-flex-layout-classes',
          message:
              `Style outside template. Run \`move-style-into-template\` rule.`,
          parsedDocument,
          severity: Severity.ERROR,
          sourceRange: parsedDocument.sourceRangeForStartTag(misplacedStyle)!
        }));
        continue;
      }
      const template = dom5.query(domModule.astNode, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const templateContent = treeAdapters.default.getTemplateContent(template);
      const missingModules = getMissingStyleModules(templateContent);
      if (!missingModules.length) {
        continue;
      }
      // TODO(valdrin): update the warning location to be at the spot where
      // the class is used.
      const warning = createWarning(parsedDocument, missingModules);
      const modules = missingModules.map((m) => m.module).join(' ');
      const styleNode = getStyleNodeToEdit(templateContent);
      if (!styleNode) {
        const indent = getIndentationInside(templateContent);
        warning.fix = [prependContent(parsedDocument, template, `
${indent}<style include="${modules}"></style>`)];
      } else if (dom5.hasAttribute(styleNode, 'include')) {
        const include = dom5.getAttribute(styleNode, 'include')!;
        warning.fix = [{
          replacementText: `"${include} ${modules}"`,
          range:
              parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
        }];
      } else {
        warning.fix =
            [addAttribute(parsedDocument, styleNode, 'include', modules)];
      }
      warnings.push(warning);
    }
    const body = dom5.query(parsedDocument.ast, p.hasTagName('body'));
    // Handle files like `<dom-module></dom-module> <body><p>hello</p></body>`
    // where a "fake" body node would be created by dom-module. Skip these
    // cases, dear user please write proper HTML ¯\_(ツ)_/¯
    if (!body || !body.__location) {
      return warnings;
    }
    const missingModules = getMissingStyleModules(parsedDocument.ast);
    if (!missingModules.length) {
      return warnings;
    }
    // TODO(valdrin): update the warning location to be at the spot where
    // the class is used.
    const warning = createWarning(parsedDocument, missingModules);
    const modules = missingModules.map((m) => m.module).join(' ');
    const indent = getIndentationInside(body);
    warning.fix = [prependContent(parsedDocument, body, `
${indent}<custom-style>
${indent}  <style is="custom-style" include="${modules}"></style>
${indent}</custom-style>`)];
    warnings.push(warning);
    return warnings;
  }
}

function getMissingStyleModules(rootNode: dom5.Node): StyleModule[] {
  let includes = '';
  const modules = {};
  dom5.nodeWalkAll(rootNode, (node: dom5.Node) => {
    if (dom5.isElement(node)) {
      if (isStyleInclude(node)) {
        includes += ' ' + dom5.getAttribute(node, 'include')!;
      } else {
        styleModules.forEach((m) => {
          if (!modules[m.module] && m.selector(node)) {
            modules[m.module] = node;
          }
        });
      }
    }
    return false;
  });
  const res = [];
  for (const module in modules) {
    if (includes.indexOf(module) === -1) {
      res.push({module, node: modules[module]});
    }
  }
  return res;
}

function createWarning(
    parsedDocument: ParsedHtmlDocument, missingModules: StyleModule[]) {
  const multi = missingModules.length > 1;
  const node = missingModules[0].node;
  const modules = missingModules.map((m) => m.module).join(' ');
  return new FixableWarning({
    code: 'iron-flex-layout-classes',
    message: `Style module${multi ? 's are' : ' is'} used but not imported:

  ${modules}

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

function addAttribute(
    parsedDocument: ParsedHtmlDocument,
    node: dom5.Node,
    attribute: string,
    attributeValue: string): Replacement {
  const tagRange = parsedDocument.sourceRangeForStartTag(node)!;
  const range = {
    file: tagRange.file,
    start: {line: tagRange.end.line, column: tagRange.end.column - 1},
    end: {line: tagRange.end.line, column: tagRange.end.column - 1}
  };
  const replacementText = ` ${attribute}="${attributeValue}"`;
  return {replacementText, range};
}

function prependContent(
    parsedDocument: ParsedHtmlDocument,
    node: dom5.Node,
    replacementText: string): Replacement {
  const tagRange = parsedDocument.sourceRangeForStartTag(node)!;
  const range = {
    file: tagRange.file,
    start: {line: tagRange.end.line, column: tagRange.end.column},
    end: {line: tagRange.end.line, column: tagRange.end.column}
  };
  return {replacementText, range};
}

registry.register(new IronFlexLayoutClasses());