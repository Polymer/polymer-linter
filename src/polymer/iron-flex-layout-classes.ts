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
      const missingModules =
          getMissingStyleModules(parsedDocument, templateContent, warnings);
      if (!missingModules) {
        continue;
      }
      // Add fix on last warning, we'll add all the missing modules in the same
      // style node.
      const warning = warnings[warnings.length - 1];
      const styleNode = getStyleNodeToEdit(templateContent);
      if (!styleNode) {
        const indent = getIndentationInside(templateContent);
        warning.fix = [prependContent(parsedDocument, template, `
${indent}<style include="${missingModules}"></style>`)];
      } else if (dom5.hasAttribute(styleNode, 'include')) {
        const include = dom5.getAttribute(styleNode, 'include')!;
        warning.fix = [{
          replacementText: `"${include} ${missingModules}"`,
          range:
              parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
        }];
      } else {
        warning.fix = [addAttribute(
            parsedDocument, styleNode, 'include', missingModules)];
      }
    }
    const body = dom5.query(parsedDocument.ast, p.hasTagName('body'));
    // Handle files like `<dom-module></dom-module> <body><p>hello</p></body>`
    // where a "fake" body node would be created by dom-module. Skip these
    // cases, dear user please write proper HTML ¯\_(ツ)_/¯
    if (!body || !body.__location) {
      return warnings;
    }
    const missingModules =
        getMissingStyleModules(parsedDocument, parsedDocument.ast, warnings);
    if (!missingModules) {
      return warnings;
    }
    // Add fix on last warning, we'll add all the missing modules in the same
    // style node.
    const warning = warnings[warnings.length - 1];
    const indent = getIndentationInside(body);
    warning.fix = [prependContent(parsedDocument, body, `
${indent}<custom-style>
${indent}  <style is="custom-style" include="${missingModules}"></style>
${indent}</custom-style>`)];
    return warnings;
  }
}

function getMissingStyleModules(
    parsedDocument: ParsedHtmlDocument,
    rootNode: dom5.Node,
    warnings: FixableWarning[]): string {
  const {modules, includes} = searchUsedModulesAndIncludes(rootNode);
  let missingModules = '';
  for (const module in modules) {
    if (includes.indexOf(module) === -1) {
      modules[module].forEach((node: dom5.Node) => {
        warnings.push(new FixableWarning({
          code: 'iron-flex-layout-classes',
          message: `"${module}" style module is used but not imported.
Import it in the template style include.`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange:
              parsedDocument.sourceRangeForAttributeValue(node, 'class')!
        }));
      });
      missingModules += ' ' + module;
    }
  }
  return missingModules.trim();
}

function searchUsedModulesAndIncludes(
    rootNode: dom5.Node, modules: Object = {}, includes: string[] = []):
    {modules: Object, includes: string[]} {
  dom5.nodeWalkAll(rootNode, (node: dom5.Node) => {
    if (!dom5.isElement(node)) {
      return false;
    }
    // Ensure we don't search into dom-module's templates.
    if (p.hasTagName('template')(node) &&
        !p.hasTagName('dom-module')(node.parentNode!)) {
      const templateContent = treeAdapters.default.getTemplateContent(node);
      searchUsedModulesAndIncludes(templateContent, modules, includes);
    } else if (isStyleInclude(node)) {
      dom5.getAttribute(node, 'include')!.split(' ').forEach((include) => {
        if (includes.indexOf(include) === -1) {
          includes.push(include);
        }
      });
    } else {
      styleModules.forEach((m) => {
        if (m.selector(node)) {
          modules[m.module] = modules[m.module] || [];
          modules[m.module].push(node);
        }
      });
    }
    return false;
  });
  return {modules, includes};
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